
-- ---------- 2. site_stats : l'audience ----------

create or replace function public.site_stats_audience(jour0 timestamptz, jour1 timestamptz, tz text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'views_total',      (select count(*) from page_views where listing_id is not null),
    'views_today',      (select count(*) from page_views where listing_id is not null and created_at >= jour0),
    'views_7d',         (select count(*) from page_views where listing_id is not null and created_at > now() - interval '7 days'),
    'visits_today',     (select count(*) from page_views where created_at >= jour0),
    'visitors_today',   (select count(distinct viewer_key) from page_views where created_at >= jour0),
    'visits_yesterday', (select count(*) from page_views where created_at >= jour1 and created_at < jour0),
    'visitors_yesterday', (select count(distinct viewer_key) from page_views where created_at >= jour1 and created_at < jour0),
    'visits_7d',        (select count(*) from page_views where created_at > now() - interval '7 days'),
    'visitors_7d',      (select count(distinct viewer_key) from page_views where created_at > now() - interval '7 days'),
    'visitors_total',   (select count(distinct viewer_key) from page_views),
    'by_site', coalesce((
      select jsonb_object_agg(site_key, jsonb_build_object(
               'visits_today', vj, 'visitors_today', uj, 'visits_7d', v7, 'visitors_7d', u7))
      from (select case when path like '/food%' then 'food' when path like '/event%' then 'event'
                        when path like '/guide%' then 'guide' else 'tikanal' end as site_key,
                   count(*) filter (where created_at >= jour0) as vj,
                   count(distinct viewer_key) filter (where created_at >= jour0) as uj,
                   count(*) filter (where created_at > now() - interval '7 days') as v7,
                   count(distinct viewer_key) filter (where created_at > now() - interval '7 days') as u7
              from page_views group by 1) s), '{}'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', (d at time zone tz)::date, 'visits', c, 'visitors', u) order by d)
      from (select g.d, count(v.id) as c, count(distinct v.viewer_key) as u
              from generate_series(jour0 - interval '13 days', jour0, interval '1 day') g(d)
              left join page_views v on v.created_at >= g.d and v.created_at < g.d + interval '1 day'
             group by g.d) s), '[]'::jsonb));
$$;
