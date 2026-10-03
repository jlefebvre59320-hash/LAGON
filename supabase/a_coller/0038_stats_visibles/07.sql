
-- ---------- 10. Temps réel : assemblage ----------

create or replace function public.admin_temps_reel()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  tz text := 'America/St_Barthelemy';
  h24 timestamptz := now() - interval '24 hours';
  sess jsonb; cpt jsonb;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  if not exists (select 1 from pg_timezone_names where name = tz) then tz := 'America/Port_of_Spain'; end if;
  sess := public.tr_sessions(h24);
  cpt  := public.tr_comptes(h24);

  return jsonb_build_object(
    'a', now(),
    'essentiel', jsonb_build_object(
      'visiteurs_5min',    (select count(distinct viewer_key) from public.page_views where created_at > now() - interval '5 minutes'),
      'visiteurs_24h',     (select count(distinct viewer_key) from public.page_views where created_at > h24),
      'comptes_crees_24h', cpt->'comptes_crees_24h',
      'reconnexions_24h',  cpt->'reconnexions_24h'),
    'h24', jsonb_build_object(
      'pages',             (select count(*) from public.page_views where created_at > h24),
      'visiteurs_revenus', (select count(distinct a.viewer_key) from public.page_views a
                             where a.created_at > h24
                               and exists (select 1 from public.page_views b where b.viewer_key = a.viewer_key and b.created_at <= h24)),
      'connexions',        cpt->'connexions',
      'sessions',          sess->'sessions',
      'duree_moyenne_s',   sess->'duree_moyenne_s',
      'pages_par_session', sess->'pages_par_session',
      'annonces',          (select count(*) from public.listings where created_at > h24),
      'messages',          (select count(*) from public.messages where created_at > h24),
      'comptes_total',     cpt->'comptes_total',
      'visiteurs_7j',      (select count(distinct viewer_key) from public.page_views where created_at > now() - interval '7 days'),
      'comptes_crees_7j',  cpt->'comptes_crees_7j'),
    'par_heure', coalesce((
      select jsonb_agg(jsonb_build_object('t', gs, 'h', to_char((gs at time zone tz), 'HH24"h"'),
               'n', (select count(*) from public.page_views p where p.created_at >= gs and p.created_at < gs + interval '1 hour'),
               'v', (select count(distinct viewer_key) from public.page_views p where p.created_at >= gs and p.created_at < gs + interval '1 hour')) order by gs)
        from generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), interval '1 hour') gs), '[]'),
    'sessions_actives', sess->'sessions_actives',
    'appareils_24h', coalesce((select jsonb_object_agg(coalesce(device, 'inconnu'), n) from (
        select device, count(*) n from public.page_views where created_at > h24 group by device) d), '{}'),
    'sources_24h', coalesce((select jsonb_object_agg(coalesce(source, 'inconnu'), n) from (
        select source, count(*) n from public.page_views where created_at > h24 group by source) d), '{}'),
    'pages_top', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'titre', titre, 'n', n, 'visiteurs', visiteurs) order by n desc)
        from (select p.path, (select title from public.listings where id = p.listing_id) as titre,
                     count(*) n, count(distinct viewer_key) visiteurs
                from public.page_views p where p.created_at > h24
               group by p.path, p.listing_id order by count(*) desc limit 8) t), '[]'),
    'flux', coalesce((
      select jsonb_agg(jsonb_build_object('t', created_at, 'path', path, 'titre', titre,
               'device', device, 'source', source, 'cle', left(md5(viewer_key), 6)) order by created_at desc)
        from (select p.*, (select title from public.listings where id = p.listing_id) as titre
                from public.page_views p order by p.created_at desc limit 30) f), '[]'),
    'dernieres_connexions', cpt->'dernieres_connexions',
    'moderation', jsonb_build_object(
      'en_attente',       (select count(*) from public.moderation_cases where status = 'open'),
      'signalements_24h', (select count(*) from public.reports where created_at > h24),
      'en_ligne',         (select count(*) from public.listings where status = 'active' and review_state in ('published', 'watch'))));
end $$;
