-- ============================================================
-- 0028 — Bloquer quelqu'un depuis une conversation.
--
-- Une messagerie sans bouton « bloquer » est une messagerie où l'on
-- subit. Le blocage vaut pour la personne, pas pour le fil : bloquer
-- depuis une annonce doit aussi empêcher d'être recontacté depuis une
-- autre, sinon il suffit d'ouvrir une deuxième conversation.
--
-- Le blocage est réciproque dans ses effets : ni l'un ni l'autre ne
-- peut plus écrire à l'autre. Laisser celui qui bloque continuer à
-- écrire serait à sens unique, et fournirait un moyen de harceler
-- quelqu'un qui n'a plus le droit de répondre.
--
-- Rien n'est supprimé : les conversations restent lisibles des deux
-- côtés. Effacer l'historique priverait de preuve la personne qui
-- bloque, au moment précis où elle peut en avoir besoin.
-- ============================================================

create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocage_pas_soi_meme check (blocker_id <> blocked_id)
);

create index if not exists idx_blocked_par on public.blocked_users (blocked_id);

alter table public.blocked_users enable row level security;

-- On ne voit que ses propres blocages. Savoir qui vous a bloqué n'a
-- aucune utilité légitime et donne prise au harcèlement.
drop policy if exists "blocages_select_own" on public.blocked_users;
create policy "blocages_select_own" on public.blocked_users
  for select using (auth.uid() = blocker_id);

revoke all on public.blocked_users from anon, authenticated;
grant select on public.blocked_users to authenticated;

-- ---------- Poser et lever un blocage ----------

create or replace function public.bloquer_personne(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_moi uuid := auth.uid();
begin
  if v_moi is null then raise exception 'Connectez-vous.'; end if;
  if p_user_id = v_moi then raise exception 'On ne se bloque pas soi-même.'; end if;
  insert into public.blocked_users (blocker_id, blocked_id)
  values (v_moi, p_user_id)
  on conflict do nothing;
end $$;

create or replace function public.debloquer_personne(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_moi uuid := auth.uid();
begin
  if v_moi is null then return; end if;
  delete from public.blocked_users
   where blocker_id = v_moi and blocked_id = p_user_id;
end $$;

-- Vrai si l'un des deux a bloqué l'autre, dans un sens ou dans l'autre.
create or replace function public.blocage_entre(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocked_users
     where (blocker_id = a and blocked_id = b)
        or (blocker_id = b and blocked_id = a)
  );
$$;

-- ---------- Le blocage s'applique à l'envoi ----------

create or replace function public.envoyer_message(
  p_listing_id uuid,
  p_body       text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_moi      uuid := auth.uid();
  v_vendeur  uuid;
  v_statut   listing_status;
  v_autorise boolean;
  v_conv     uuid;
  v_texte    text := btrim(coalesce(p_body, ''));
begin
  if v_moi is null then
    raise exception 'Connectez-vous pour envoyer un message.';
  end if;
  if char_length(v_texte) < 1 or char_length(v_texte) > 2000 then
    raise exception 'Le message doit faire entre 1 et 2000 caractères.';
  end if;
  if public.current_user_is_banned() then
    raise exception 'Votre compte ne peut plus envoyer de messages.';
  end if;

  select l.user_id, l.status, coalesce(p.allow_messages, true)
    into v_vendeur, v_statut, v_autorise
    from public.listings l
    join public.profiles p on p.id = l.user_id
   where l.id = p_listing_id;

  if v_vendeur is null then
    raise exception 'Cette annonce n''existe plus.';
  end if;
  if v_vendeur = v_moi then
    raise exception 'C''est votre propre annonce.';
  end if;
  if public.blocage_entre(v_moi, v_vendeur) then
    raise exception 'Vous ne pouvez pas écrire à cette personne.';
  end if;
  if not v_autorise then
    raise exception 'Cette personne préfère être contactée sur WhatsApp.';
  end if;
  if v_statut <> 'active' then
    raise exception 'Cette annonce n''est plus en ligne.';
  end if;

  if (select count(*) from public.messages
       where sender_id = v_moi and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Trop de messages envoyés en une heure. Réessayez plus tard.';
  end if;
  if (select count(*) from public.conversations
       where buyer_id = v_moi and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Trop de conversations ouvertes en une heure. Réessayez plus tard.';
  end if;

  insert into public.conversations (listing_id, buyer_id, seller_id)
  values (p_listing_id, v_moi, v_vendeur)
  on conflict (listing_id, buyer_id) do update
    set last_message_at = now()
  returning id into v_conv;

  insert into public.messages (conversation_id, sender_id, body)
  values (v_conv, v_moi, v_texte);

  update public.conversations set last_message_at = now() where id = v_conv;
  return v_conv;
end $$;

create or replace function public.repondre_message(
  p_conversation_id uuid,
  p_body            text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_moi   uuid := auth.uid();
  v_conv  public.conversations;
  v_autre uuid;
  v_texte text := btrim(coalesce(p_body, ''));
begin
  if v_moi is null then
    raise exception 'Connectez-vous pour répondre.';
  end if;
  if char_length(v_texte) < 1 or char_length(v_texte) > 2000 then
    raise exception 'Le message doit faire entre 1 et 2000 caractères.';
  end if;
  if public.current_user_is_banned() then
    raise exception 'Votre compte ne peut plus envoyer de messages.';
  end if;

  select * into v_conv from public.conversations where id = p_conversation_id;
  if v_conv.id is null or (v_conv.buyer_id <> v_moi and v_conv.seller_id <> v_moi) then
    raise exception 'Conversation introuvable.';
  end if;

  v_autre := case when v_conv.buyer_id = v_moi then v_conv.seller_id else v_conv.buyer_id end;
  if public.blocage_entre(v_moi, v_autre) then
    raise exception 'Vous ne pouvez plus écrire dans cette conversation.';
  end if;

  if (select count(*) from public.messages
       where sender_id = v_moi and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Trop de messages envoyés en une heure. Réessayez plus tard.';
  end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (p_conversation_id, v_moi, v_texte);

  update public.conversations set last_message_at = now() where id = p_conversation_id;
  return p_conversation_id;
end $$;

-- ---------- La boîte connaît l'état du blocage ----------

create or replace function public.mes_conversations()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_moi uuid := auth.uid(); v_result jsonb;
begin
  if v_moi is null then
    raise exception 'Connectez-vous pour voir vos messages.';
  end if;

  select coalesce(jsonb_agg(x order by (x->>'last_message_at') desc), '[]'::jsonb)
    into v_result
  from (
    select jsonb_build_object(
      'id',              c.id,
      'listing_id',      c.listing_id,
      'listing_title',   coalesce(l.title, 'Annonce supprimée'),
      'listing_status',  l.status::text,
      'photo_key',       (select lp.storage_key from public.listing_photos lp
                           where lp.listing_id = c.listing_id
                           order by lp.position limit 1),
      'je_suis_auteur',  c.seller_id = v_moi,
      'autre_id',        autre.id,
      'autre_nom',       coalesce(autre.display_name, 'Utilisateur'),
      -- Deux états distincts : « j'ai bloqué » se lève d'un clic, « je suis
      -- bloqué » ne se lève pas. L'écran ne dit pas la même chose.
      'jai_bloque',      exists (select 1 from public.blocked_users b
                                  where b.blocker_id = v_moi and b.blocked_id = autre.id),
      'bloque',          public.blocage_entre(v_moi, autre.id),
      'last_message_at', c.last_message_at,
      'dernier',         (select m.body from public.messages m
                           where m.conversation_id = c.id
                           order by m.created_at desc limit 1),
      'non_lus',         (select count(*) from public.messages m
                           where m.conversation_id = c.id
                             and m.sender_id <> v_moi
                             and m.created_at > coalesce(
                                   case when c.seller_id = v_moi then c.seller_read_at
                                        else c.buyer_read_at end,
                                   'epoch'::timestamptz))
    ) as x
    from public.conversations c
    left join public.listings l on l.id = c.listing_id
    left join public.profiles autre
      on autre.id = case when c.seller_id = v_moi then c.buyer_id else c.seller_id end
    where c.buyer_id = v_moi or c.seller_id = v_moi
  ) s;

  return v_result;
end $$;

-- ---------- Pas de notification vers ou depuis un bloqué ----------

create or replace function public.destinataire_a_prevenir(p_conversation_id uuid)
returns table (user_id uuid, autre_nom text, listing_title text, listing_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  c public.conversations;
  v_dernier timestamptz;
  v_auteur  uuid;
  v_cible   uuid;
  v_lu      timestamptz;
  v_prevenu timestamptz;
begin
  select * into c from public.conversations where id = p_conversation_id;
  if c.id is null then return; end if;

  select m.created_at, m.sender_id into v_dernier, v_auteur
    from public.messages m
   where m.conversation_id = p_conversation_id
   order by m.created_at desc limit 1;
  if v_dernier is null then return; end if;

  if v_auteur = c.buyer_id then
    v_cible := c.seller_id; v_lu := c.seller_read_at; v_prevenu := c.seller_notified_at;
  else
    v_cible := c.buyer_id;  v_lu := c.buyer_read_at;  v_prevenu := c.buyer_notified_at;
  end if;

  if public.blocage_entre(v_auteur, v_cible) then return; end if;
  if v_lu is not null and v_lu >= v_dernier then return; end if;
  if v_prevenu is not null and v_prevenu > now() - interval '15 minutes' then return; end if;
  if not coalesce((select p.notify_email from public.profiles p where p.id = v_cible), true) then return; end if;

  return query
    select v_cible,
           coalesce((select p.display_name from public.profiles p where p.id = v_auteur), 'Un utilisateur'),
           coalesce((select l.title from public.listings l where l.id = c.listing_id), 'votre annonce'),
           c.listing_id;
end $$;

-- ---------- Droits d'exécution ----------

revoke all on function public.bloquer_personne(uuid)   from public;
revoke all on function public.debloquer_personne(uuid) from public;
revoke all on function public.blocage_entre(uuid, uuid) from public;

grant execute on function public.bloquer_personne(uuid)   to authenticated;
grant execute on function public.debloquer_personne(uuid) to authenticated;
grant execute on function public.blocage_entre(uuid, uuid) to authenticated;

-- Vérification : doit renvoyer 0 pour un compte neuf.
-- select count(*) from public.blocked_users;
