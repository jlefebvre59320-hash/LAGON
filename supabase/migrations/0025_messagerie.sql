-- ============================================================
-- 0025 — Messagerie interne, et la garantie d'être joignable.
--
-- Aujourd'hui une annonce sans numéro WhatsApp est un cul-de-sac : la
-- fiche affiche « le vendeur n'a pas renseigné de numéro » et le
-- visiteur repart. Deux réponses, posées ensemble :
--
--   1) une messagerie interne, active par défaut pour tout le monde ;
--   2) une règle au dépôt : soit un numéro WhatsApp, soit la messagerie
--      laissée active. Couper les deux devient impossible.
--
-- Toute écriture passe par des fonctions security definer : les tables
-- restent en lecture seule pour les comptes. C'est ce qui permet de
-- vérifier au même endroit l'appartenance à la conversation, le
-- bannissement et les quotas anti-spam, sans les éparpiller dans des
-- policies qu'on oublie de mettre à jour.
-- ============================================================

-- ---------- Le réglage du profil ----------

alter table public.profiles
  add column if not exists allow_messages boolean not null default true;

-- 0005 puis 0019 ont remplacé le privilège de table par des privilèges
-- colonne par colonne : une nouvelle colonne est invisible tant qu'elle
-- n'est pas ajoutée ici. C'est exactement ce qui avait produit le
-- « permission denied for table listings » de featured_until.
grant select (allow_messages) on public.profiles to anon, authenticated;
grant update (allow_messages) on public.profiles to authenticated;

-- ---------- Les conversations ----------

create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references public.listings(id) on delete cascade,
  -- L'intéressé et l'auteur de l'annonce. Les rôles sont figés à la
  -- création : ils déterminent quel horodatage de lecture mettre à jour.
  buyer_id        uuid not null references auth.users(id) on delete cascade,
  seller_id       uuid not null references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  buyer_read_at   timestamptz,
  seller_read_at  timestamptz,
  constraint conversations_deux_personnes check (buyer_id <> seller_id)
);

-- Un intéressé, une conversation par annonce : sans ça, chaque message
-- rouvrirait un fil et la boîte deviendrait illisible.
create unique index if not exists uq_conversations_listing_buyer
  on public.conversations (listing_id, buyer_id);
create index if not exists idx_conversations_buyer
  on public.conversations (buyer_id, last_message_at desc);
create index if not exists idx_conversations_seller
  on public.conversations (seller_id, last_message_at desc);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id) on delete cascade,
  body            text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at      timestamptz not null default now()
);

create index if not exists idx_messages_conversation
  on public.messages (conversation_id, created_at);
create index if not exists idx_messages_auteur
  on public.messages (sender_id, created_at desc);

-- ---------- Lecture seule, et seulement pour les participants ----------

alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

drop policy if exists "conversations_select_participant" on public.conversations;
create policy "conversations_select_participant" on public.conversations
  for select using (
    auth.uid() = buyer_id or auth.uid() = seller_id or public.is_admin()
  );

drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant" on public.messages
  for select using (
    public.is_admin() or exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- Aucune écriture directe : tout passe par les fonctions ci-dessous.
revoke insert, update, delete on public.conversations from anon, authenticated;
revoke insert, update, delete on public.messages      from anon, authenticated;
grant select on public.conversations to authenticated;
grant select on public.messages      to authenticated;

-- ---------- Écrire un message ----------

-- Ouvre la conversation si elle n'existe pas, puis dépose le message.
-- Renvoie l'identifiant de la conversation, pour que l'appelant puisse
-- ouvrir le fil dans la foulée.
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
  if not v_autorise then
    raise exception 'Cette personne préfère être contactée sur WhatsApp.';
  end if;
  if v_statut <> 'active' then
    raise exception 'Cette annonce n''est plus en ligne.';
  end if;

  -- Garde-fou anti-spam, volontairement large : gêner un démarcheur sans
  -- jamais bloquer une vraie négociation, qui tient rarement en 30 messages
  -- dans l'heure.
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

-- Répondre dans un fil déjà ouvert — des deux côtés cette fois.
create or replace function public.repondre_message(
  p_conversation_id uuid,
  p_body            text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_moi   uuid := auth.uid();
  v_conv  public.conversations;
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

  if (select count(*) from public.messages
       where sender_id = v_moi and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Trop de messages envoyés en une heure. Réessayez plus tard.';
  end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (p_conversation_id, v_moi, v_texte);

  update public.conversations set last_message_at = now() where id = p_conversation_id;
  return p_conversation_id;
end $$;

-- ---------- Lire sa boîte ----------

-- Une seule requête pour toute la boîte : le titre de l'annonce, sa
-- première photo, le nom d'en face, le dernier message et le nombre de
-- non-lus. Côté navigateur, ça évite une cascade de requêtes par fil.
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
      'autre_nom',       coalesce(other.display_name, 'Utilisateur'),
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
    left join public.profiles other
      on other.id = case when c.seller_id = v_moi then c.buyer_id else c.seller_id end
    where c.buyer_id = v_moi or c.seller_id = v_moi
  ) s;

  return v_result;
end $$;

-- Marque le fil comme lu du bon côté. Deux horodatages plutôt qu'un
-- drapeau par message : c'est O(1) à l'écriture et ça suffit à compter
-- les non-lus.
create or replace function public.marquer_conversation_lue(p_conversation_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_moi uuid := auth.uid();
begin
  if v_moi is null then return; end if;
  update public.conversations
     set seller_read_at = case when seller_id = v_moi then now() else seller_read_at end,
         buyer_read_at  = case when buyer_id  = v_moi then now() else buyer_read_at  end
   where id = p_conversation_id
     and (buyer_id = v_moi or seller_id = v_moi);
end $$;

-- Le compteur du bandeau : une seule valeur, appelée souvent, donc
-- volontairement minimale.
create or replace function public.mes_messages_non_lus()
returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(count(m.id), 0)::integer
    from public.conversations c
    join public.messages m on m.conversation_id = c.id
   where (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
     and m.sender_id <> auth.uid()
     and m.created_at > coalesce(
           case when c.seller_id = auth.uid() then c.seller_read_at else c.buyer_read_at end,
           'epoch'::timestamptz);
$$;

-- ---------- Droits d'exécution ----------

revoke all on function public.envoyer_message(uuid, text)          from public;
revoke all on function public.repondre_message(uuid, text)         from public;
revoke all on function public.mes_conversations()                  from public;
revoke all on function public.marquer_conversation_lue(uuid)       from public;
revoke all on function public.mes_messages_non_lus()               from public;

grant execute on function public.envoyer_message(uuid, text)        to authenticated;
grant execute on function public.repondre_message(uuid, text)       to authenticated;
grant execute on function public.mes_conversations()                to authenticated;
grant execute on function public.marquer_conversation_lue(uuid)     to authenticated;
grant execute on function public.mes_messages_non_lus()             to authenticated;

-- Vérification : doit renvoyer 0 et une liste vide pour un compte neuf.
-- select public.mes_messages_non_lus(), public.mes_conversations();
