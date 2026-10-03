-- ============================================================
-- 0040 — Répondre aux retours, et ranger le jardin.
--
-- 1) Les annonces d'outillage et de jardin publiées sous « Achats &
--    Ventes » rejoignent le nouvel univers (0039 doit être passée seule
--    avant).
--
-- 2) Un retour (idée, problème, avis) déposé depuis /retours recevait
--    au mieux un « Marquer lu ». L'administration peut maintenant y
--    répondre : la réponse arrive dans la messagerie de la personne
--    (pastille en direct, notification push et email envoyés par la
--    route serveur), ou par email seul si elle n'a pas de compte mais
--    a laissé une adresse.
--
--    Une conversation de support est une conversation sans annonce :
--    listing_id devient nullable, et il n'y a qu'un fil de support par
--    personne, quel que soit le nombre de retours — c'est plus lisible
--    qu'un fil par idée. Le premier administrateur qui répond en devient
--    l'interlocuteur ; un second peut y écrire via la fonction, le fil
--    reste dans la boîte du premier.
-- ============================================================

-- ---------- 1. Déménagement des annonces de jardin ----------

update public.listings
   set module = 'garden',
       subcategory = case subcategory
                       when 'Outillage' then 'Outillage à main'
                       else 'Autre jardin & outillage'
                     end
 where module = 'goods'
   and subcategory in ('Outillage', 'Bricolage & Jardin');

-- Et « Emploi » redevient l'emploi seul : les services entre particuliers
-- rejoignent l'univers Services, créé en 0030.
update public.listings
   set module = 'service', subcategory = 'Autre service'
 where module = 'job' and subcategory = 'Services entre particuliers';

-- ---------- 2. La réponse, mémorisée sur le retour ----------

alter table public.feedback
  add column if not exists reply      text,
  add column if not exists replied_at timestamptz,
  add column if not exists replied_by uuid references auth.users(id) on delete set null;

-- ---------- 3. Conversations sans annonce ----------

alter table public.conversations alter column listing_id drop not null;

-- Un seul fil de support par personne. L'index partiel sert aussi de
-- cible au « on conflict » de la fonction de réponse.
create unique index if not exists uq_conversations_support
  on public.conversations (buyer_id) where listing_id is null;

-- ---------- 4. Répondre à un retour ----------

-- Renvoie comment la réponse est partie :
--   {mode:'message', conversation_id, user_id}  → dans la messagerie ;
--   {mode:'email', contact, message, kind}      → email seul, à envoyer
--                                                 par la route serveur ;
--   {mode:'aucun'}                              → enregistrée, mais aucun
--                                                 canal (contact téléphone).
create or replace function public.admin_repondre_retour(p_feedback_id uuid, p_body text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_moi   uuid := auth.uid();
  f       public.feedback;
  v_texte text := btrim(coalesce(p_body, ''));
  v_corps text;
  v_conv  uuid;
  v_nature text;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  if char_length(v_texte) < 1 or char_length(v_texte) > 1500 then
    raise exception 'La réponse doit faire entre 1 et 1500 caractères.';
  end if;

  select * into f from public.feedback where id = p_feedback_id for update;
  if f.id is null then
    raise exception 'Retour introuvable.';
  end if;
  if f.reply is not null then
    raise exception 'Ce retour a déjà reçu une réponse.';
  end if;

  update public.feedback
     set handled = true, reply = v_texte, replied_at = now(), replied_by = v_moi
   where id = f.id;

  -- Dans la messagerie, si la personne a un compte (et n'est pas
  -- l'administrateur lui-même : une conversation a deux personnes).
  if f.user_id is not null and f.user_id <> v_moi
     and exists (select 1 from auth.users u where u.id = f.user_id) then

    -- Le message rappelle de quoi on parle : le retour date parfois de
    -- plusieurs jours, et la personne en a peut-être envoyé plusieurs.
    v_nature := case f.kind when 'idee' then 'idée' when 'probleme' then 'signalement' else 'avis' end;
    v_corps  := 'En réponse à votre ' || v_nature || ' du '
             || to_char(f.created_at at time zone 'America/St_Barthelemy', 'DD/MM/YYYY')
             || ' : « ' || left(regexp_replace(f.message, '\s+', ' ', 'g'), 160)
             || case when char_length(f.message) > 160 then '…' else '' end || ' »'
             || E'\n\n' || v_texte;

    insert into public.conversations (listing_id, buyer_id, seller_id)
    values (null, f.user_id, v_moi)
    on conflict (buyer_id) where listing_id is null
      do update set last_message_at = now()
    returning id into v_conv;

    insert into public.messages (conversation_id, sender_id, body)
    values (v_conv, v_moi, v_corps);

    return jsonb_build_object('mode', 'message', 'conversation_id', v_conv, 'user_id', f.user_id);
  end if;

  -- Sans compte : par email, si le contact en est un.
  if f.contact ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('mode', 'email', 'contact', btrim(f.contact),
                              'message', f.message, 'kind', f.kind, 'created_at', f.created_at);
  end if;

  return jsonb_build_object('mode', 'aucun', 'contact', f.contact);
end $$;

revoke all on function public.admin_repondre_retour(uuid, text) from public;
grant execute on function public.admin_repondre_retour(uuid, text) to authenticated;

-- ---------- 5. La boîte connaît les fils de support ----------

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
      'support',         c.listing_id is null,
      'listing_title',   case
                           when c.listing_id is null and c.seller_id = v_moi then 'Réponse à un retour'
                           when c.listing_id is null then 'Votre retour à l''équipe'
                           else coalesce(l.title, 'Annonce supprimée')
                         end,
      'listing_status',  l.status::text,
      'photo_key',       (select lp.storage_key from public.listing_photos lp
                           where lp.listing_id = c.listing_id
                           order by lp.position limit 1),
      'je_suis_auteur',  c.seller_id = v_moi,
      -- Du côté de la personne, l'interlocuteur est l'équipe, pas un
      -- administrateur nommé : pas de fiche à voir ni de blocage.
      'autre_id',        case when c.listing_id is null and c.seller_id <> v_moi then null else autre.id end,
      'autre_nom',       case when c.listing_id is null and c.seller_id <> v_moi then 'Équipe Ti Kanal'
                              else coalesce(autre.display_name, 'Utilisateur') end,
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

-- ---------- 6. Qui prévenir, fil de support compris ----------

-- Le type de retour change (une colonne « support » de plus) : on
-- supprime avant de recréer, « create or replace » ne le permet pas.
-- Seule la route serveur (clé de service) appelle cette fonction.
drop function if exists public.destinataire_a_prevenir(uuid);

create function public.destinataire_a_prevenir(p_conversation_id uuid)
returns table (user_id uuid, autre_nom text, listing_title text, listing_id uuid, support boolean)
language plpgsql security definer set search_path = public as $$
declare
  c public.conversations;
  v_dernier timestamptz;
  v_auteur  uuid;
  v_cible   uuid;
  v_lu      timestamptz;
  v_prevenu timestamptz;
  v_support boolean;
begin
  select * into c from public.conversations where id = p_conversation_id;
  if c.id is null then return; end if;
  v_support := c.listing_id is null;

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
  -- La réponse de l'équipe à un retour que la personne a elle-même
  -- envoyé n'est pas une sollicitation : elle part même si les emails
  -- de messagerie sont coupés. Le reste respecte le réglage.
  if not v_support and not coalesce((select p.notify_email from public.profiles p where p.id = v_cible), true) then return; end if;

  return query
    select v_cible,
           case when v_support and v_auteur <> c.buyer_id then 'L''équipe Ti Kanal'
                else coalesce((select p.display_name from public.profiles p where p.id = v_auteur), 'Un utilisateur') end,
           case when v_support then 'votre retour'
                else coalesce((select l.title from public.listings l where l.id = c.listing_id), 'votre annonce') end,
           c.listing_id,
           v_support;
end $$;

revoke all on function public.destinataire_a_prevenir(uuid) from public, anon, authenticated;

-- Vérification : doit renvoyer une ligne 'garden' si des annonces ont déménagé,
-- et la fonction de réponse doit exister.
-- select module, count(*) from public.listings group by module;
-- select proname from pg_proc where proname = 'admin_repondre_retour';
