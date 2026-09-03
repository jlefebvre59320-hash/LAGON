-- ============================================================
-- 0026 — Être prévenu d'un message reçu.
--
-- Deux canaux, pour deux situations :
--   • le site est ouvert → la pastille s'allume en direct, sans
--     rechargement, via la réplication temps réel de Postgres ;
--   • le site est fermé → un email, envoyé une fois, pas à chaque
--     réplique d'une conversation en cours.
--
-- L'email est déclenché depuis l'application, pas depuis un trigger
-- SQL : la clé d'envoi reste dans les variables d'environnement du
-- serveur web, jamais dans la base. Une base qui détient une clé
-- d'API est une base dont la moindre sauvegarde devient un secret.
-- ============================================================

-- ---------- Préférence par personne ----------

alter table public.profiles
  add column if not exists notify_email boolean not null default true;

-- Rappel : depuis 0005 et 0019, profiles n'a plus de privilège de table
-- mais des privilèges colonne par colonne. Une colonne absente de ces
-- listes est invisible et non modifiable.
grant select (notify_email) on public.profiles to anon, authenticated;
grant update (notify_email) on public.profiles to authenticated;

-- ---------- Mémoire des envois ----------

-- Un horodatage par côté : il dit « cette personne a déjà été prévenue
-- pour ce fil, à cette heure-là ». C'est ce qui évite d'envoyer un
-- email par réplique pendant une négociation animée.
alter table public.conversations
  add column if not exists buyer_notified_at  timestamptz,
  add column if not exists seller_notified_at timestamptz;

-- ---------- Temps réel ----------

-- La pastille écoute les insertions dans messages. La réplication
-- respecte la RLS déjà en place : chacun ne reçoit que les événements
-- des conversations auxquelles il participe.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;   -- déjà publiée
  when undefined_object then
    raise notice 'Publication supabase_realtime absente : activez Realtime sur la table messages depuis le tableau de bord.';
end $$;

-- ---------- Ce que le serveur d'envoi a le droit de savoir ----------

-- Appelée par la route d'envoi d'email, avec la clé de service. Elle
-- répond « faut-il prévenir quelqu'un, et à quelle adresse » — et rien
-- d'autre : ni le contenu du message, ni l'historique.
--
-- La règle du silence : on ne prévient pas si le destinataire a lu le
-- fil après le dernier message (il est déjà au courant), ni s'il a
-- reçu un email pour ce fil il y a moins de quinze minutes, ni s'il a
-- coupé les notifications.
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

  if v_lu is not null and v_lu >= v_dernier then return; end if;
  if v_prevenu is not null and v_prevenu > now() - interval '15 minutes' then return; end if;
  if not coalesce((select p.notify_email from public.profiles p where p.id = v_cible), true) then return; end if;

  return query
    select v_cible,
           coalesce((select p.display_name from public.profiles p where p.id = v_auteur), 'Un utilisateur'),
           coalesce((select l.title from public.listings l where l.id = c.listing_id), 'votre annonce'),
           c.listing_id;
end $$;

-- Marque l'envoi, du bon côté. Appelée juste après que l'email est parti :
-- en cas d'échec d'envoi, rien n'est marqué et la tentative suivante aura lieu.
create or replace function public.marquer_notifie(p_conversation_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
     set buyer_notified_at  = case when buyer_id  = p_user_id then now() else buyer_notified_at  end,
         seller_notified_at = case when seller_id = p_user_id then now() else seller_notified_at end
   where id = p_conversation_id;
end $$;

-- Ces deux fonctions ne servent qu'au serveur d'envoi, qui s'authentifie
-- avec la clé de service : aucun compte du site n'y a accès.
revoke all on function public.destinataire_a_prevenir(uuid) from public, anon, authenticated;
revoke all on function public.marquer_notifie(uuid, uuid)   from public, anon, authenticated;

-- Vérification : doit renvoyer 0 ligne sur une conversation déjà lue.
-- select * from public.destinataire_a_prevenir('...uuid...');
