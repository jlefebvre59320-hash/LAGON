-- ============================================================
-- 0037 — Temps réel : qui est là, maintenant.
--
-- Une seule fonction, admin_temps_reel(), rend tout ce que la page
-- « Temps réel » de l'administration affiche : visiteurs des cinq dernières
-- minutes, pages par minute sur l'heure écoulée, sessions en cours et
-- sessions du jour (durées, pages, rebond), appareils et provenances,
-- pages les plus vues, flux des dernières vues, comptes connectés et
-- dernières connexions, activité du jour (dépôts, messages, alertes…).
--
-- La mesure d'audience reste anonyme : une session est reconstruite à
-- partir de l'identifiant aléatoire du navigateur (deux vues à plus de
-- trente minutes d'écart font deux sessions), jamais reliée à un compte.
-- La table page_views rejoint la publication temps réel : l'administration
-- reçoit chaque vue à l'instant, la RLS n'en montre rien à personne d'autre.
-- ============================================================

create index if not exists idx_page_views_viewer_recent
  on public.page_views (viewer_key, created_at desc);

create or replace function public.admin_temps_reel()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz      text := 'America/St_Barthelemy';
  jour    timestamptz;
  result  jsonb;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  if not exists (select 1 from pg_timezone_names where name = tz) then tz := 'America/Port_of_Spain'; end if;
  jour := date_trunc('day', now() at time zone tz) at time zone tz;

  with
  -- Les vues des 36 dernières heures, avec l'écart depuis la précédente du
  -- même navigateur : plus de trente minutes, nouvelle session.
  v as (
    select viewer_key, created_at, path, listing_id, device, source,
           lag(created_at) over (partition by viewer_key order by created_at) as prec
      from public.page_views
     where created_at > now() - interval '36 hours' and viewer_key is not null
  ),
  m as (select *, case when prec is null or created_at - prec > interval '30 minutes' then 1 else 0 end as nouvelle from v),
  s as (select *, sum(nouvelle) over (partition by viewer_key order by created_at) as sid from m),
  sess as (
    select viewer_key, sid,
           min(created_at) as debut, max(created_at) as fin, count(*) as pages,
           (array_agg(path order by created_at desc))[1] as derniere,
           (array_agg(listing_id order by created_at desc))[1] as dernier_listing,
           (array_agg(device order by created_at desc))[1] as device,
           (array_agg(source order by created_at))[1] as source,
           array_agg(distinct path) as chemins
      from s group by viewer_key, sid
  ),
  actives as (select * from sess where fin > now() - interval '5 minutes'),
  du_jour as (select * from sess where debut >= jour),
  minutes as (
    select gs as t, (select count(*) from public.page_views p
                      where p.created_at >= gs and p.created_at < gs + interval '1 minute') as n
      from generate_series(date_trunc('minute', now()) - interval '59 minutes', date_trunc('minute', now()), interval '1 minute') gs
  )
  select jsonb_build_object(
    'a', now(),
    'maintenant', jsonb_build_object(
      'visiteurs_5min',  (select count(distinct viewer_key) from public.page_views where created_at > now() - interval '5 minutes'),
      'pages_5min',      (select count(*) from public.page_views where created_at > now() - interval '5 minutes'),
      'visiteurs_60min', (select count(distinct viewer_key) from public.page_views where created_at > now() - interval '60 minutes'),
      'pages_60min',     (select count(*) from public.page_views where created_at > now() - interval '60 minutes'),
      'visiteurs_jour',  (select count(distinct viewer_key) from public.page_views where created_at >= jour),
      'pages_jour',      (select count(*) from public.page_views where created_at >= jour)),
    'par_minute', (select jsonb_agg(jsonb_build_object('t', t, 'n', n) order by t) from minutes),
    'sessions_actives', coalesce((
      select jsonb_agg(jsonb_build_object(
        'cle', left(md5(viewer_key), 6), 'debut', debut, 'fin', fin,
        'duree_s', extract(epoch from fin - debut)::int, 'pages', pages,
        'device', device, 'source', source, 'derniere', derniere,
        'titre', (select title from public.listings where id = dernier_listing))
        order by fin desc)
      from actives), '[]'),
    'sessions_jour', (select jsonb_build_object(
        'nb', count(*),
        'duree_moyenne_s', coalesce(avg(extract(epoch from fin - debut)) filter (where pages > 1), 0)::int,
        'duree_mediane_s', coalesce(percentile_cont(0.5) within group (order by extract(epoch from fin - debut)) filter (where pages > 1), 0)::int,
        'duree_max_s', coalesce(max(extract(epoch from fin - debut)), 0)::int,
        'pages_moyennes', coalesce(round(avg(pages)::numeric, 1), 0),
        'rebond_pct', case when count(*) = 0 then 0 else round(100.0 * count(*) filter (where pages = 1) / count(*)) end,
        'visiteurs_revenus', (select count(*) from (select viewer_key from du_jour group by viewer_key having count(*) > 1) r))
      from du_jour),
    'appareils_60min', coalesce((select jsonb_object_agg(coalesce(device, 'inconnu'), n) from (
        select device, count(*) n from public.page_views where created_at > now() - interval '60 minutes' group by device) d), '{}'),
    'sources_60min', coalesce((select jsonb_object_agg(coalesce(source, 'inconnu'), n) from (
        select source, count(*) n from public.page_views where created_at > now() - interval '60 minutes' group by source) d), '{}'),
    'appareils_jour', coalesce((select jsonb_object_agg(coalesce(device, 'inconnu'), n) from (
        select device, count(*) n from public.page_views where created_at >= jour group by device) d), '{}'),
    'sources_jour', coalesce((select jsonb_object_agg(coalesce(source, 'inconnu'), n) from (
        select source, count(*) n from public.page_views where created_at >= jour group by source) d), '{}'),
    'pages_top', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'titre', titre, 'n', n, 'visiteurs', visiteurs) order by n desc)
        from (select p.path, (select title from public.listings where id = p.listing_id) as titre,
                     count(*) n, count(distinct viewer_key) visiteurs
                from public.page_views p where p.created_at > now() - interval '60 minutes'
               group by p.path, p.listing_id order by count(*) desc limit 10) t), '[]'),
    'flux', coalesce((
      select jsonb_agg(jsonb_build_object('t', created_at, 'path', path, 'titre', titre,
                                          'device', device, 'source', source, 'cle', left(md5(viewer_key), 6)) order by created_at desc)
        from (select p.*, (select title from public.listings where id = p.listing_id) as titre
                from public.page_views p order by p.created_at desc limit 40) f), '[]'),
    'comptes', jsonb_build_object(
      'total',           (select count(*) from auth.users),
      'connectes_30min', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 minutes'),
      'connectes_24h',   (select count(*) from auth.users where last_sign_in_at > now() - interval '24 hours'),
      'connexions_jour', (select count(*) from auth.users where last_sign_in_at >= jour),
      'nouveaux_jour',   (select count(*) from auth.users where created_at >= jour),
      'nouveaux_7j',     (select count(*) from auth.users where created_at > now() - interval '7 days'),
      'dernieres', coalesce((
        select jsonb_agg(jsonb_build_object('id', u.id, 'nom', coalesce(p.display_name, 'Membre'), 'email', u.email,
                                            'quand', u.last_sign_in_at, 'inscrit', u.created_at,
                                            'nouveau', u.created_at > now() - interval '24 hours') order by u.last_sign_in_at desc)
          from (select * from auth.users where last_sign_in_at is not null order by last_sign_in_at desc limit 15) u
          left join public.profiles p on p.id = u.id), '[]')),
    'activite_jour', jsonb_build_object(
      'annonces',      (select count(*) from public.listings where created_at >= jour),
      'annonces_60min',(select count(*) from public.listings where created_at > now() - interval '60 minutes'),
      'messages',      (select count(*) from public.messages where created_at >= jour),
      'messages_60min',(select count(*) from public.messages where created_at > now() - interval '60 minutes'),
      'conversations', (select count(*) from public.conversations c where exists (select 1 from public.messages x where x.conversation_id = c.id and x.created_at >= jour)),
      'signalements',  (select count(*) from public.reports where created_at >= jour),
      'alertes',       (select count(*) from public.search_alerts where created_at >= jour),
      'favoris',       (select count(*) from public.favorites where created_at >= jour),
      'en_attente',    (select count(*) from public.moderation_cases where status = 'open'),
      'en_ligne',      (select count(*) from public.listings where status = 'active' and review_state in ('published', 'watch')))
  ) into result;

  return result;
end $$;

revoke all on function public.admin_temps_reel() from public;
grant execute on function public.admin_temps_reel() to authenticated;

-- Chaque vue arrive à l'administration à l'instant. La RLS de page_views
-- (lecture réservée aux admins) s'applique aussi à la réplication.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'page_views') then
      alter publication supabase_realtime add table public.page_views;
    end if;
  else
    raise notice 'Publication supabase_realtime absente : activez Realtime sur page_views depuis le tableau de bord.';
  end if;
end $$;

-- Vérification (connecté en admin sur le site, pas depuis le SQL Editor) :
-- select public.admin_temps_reel()->'maintenant';
