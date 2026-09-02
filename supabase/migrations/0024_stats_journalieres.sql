-- ============================================================
-- 0024 — Statistiques du jour dans le tableau de bord.
--
-- Le tableau de bord raisonnait en fenêtres de 30 jours. Sur un site
-- qui démarre, une fenêtre d'un mois lisse tout : on ne voit ni l'effet
-- d'une publication, ni le creux d'un week-end. Les repères de 30 jours
-- laissent donc la place au jour courant, et la série quotidienne
-- compte désormais aussi les visiteurs uniques, pas seulement les pages.
--
-- Une journée se compte à l'heure de l'île, pas en UTC : à Gustavia il
-- est encore la veille quand le serveur a changé de date, et un tableau
-- « aujourd'hui » qui bascule à 20 h locale serait faux quatre heures
-- par jour. Le fuseau est résolu au moment de l'appel, avec repli sur
-- un fuseau équivalent si le nom n'existe pas dans la base.
-- ============================================================

create or replace function public.site_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
  tz     text := 'America/St_Barthelemy';
  jour0  timestamptz;   -- minuit local, aujourd'hui
  jour1  timestamptz;   -- minuit local, hier
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;

  -- Saint-Barthélemy est à UTC−4 toute l'année. Si le nom de fuseau
  -- manque dans cette installation, Port-of-Spain est strictement
  -- équivalent (AST, sans heure d'été).
  if not exists (select 1 from pg_timezone_names where name = tz) then
    tz := 'America/Port_of_Spain';
  end if;
  jour0 := date_trunc('day', now() at time zone tz) at time zone tz;
  jour1 := jour0 - interval '1 day';

  select jsonb_build_object(
    'listings_total',   (select count(*) from listings),
    'listings_active',  (select count(*) from listings where status = 'active'),
    'listings_today',   (select count(*) from listings where created_at >= jour0),
    'listings_7d',      (select count(*) from listings where created_at > now() - interval '7 days'),
    'listings_30d',     (select count(*) from listings where created_at > now() - interval '30 days'),
    'users_total',      (select count(*) from profiles),
    'users_today',      (select count(*) from profiles where created_at >= jour0),
    'users_30d',        (select count(*) from profiles where created_at > now() - interval '30 days'),
    'views_total',      (select count(*) from page_views where listing_id is not null),
    'views_today',      (select count(*) from page_views where listing_id is not null and created_at >= jour0),
    'views_7d',         (select count(*) from page_views where listing_id is not null and created_at > now() - interval '7 days'),

    -- Le jour courant, et la veille pleine pour donner un point de comparaison
    -- honnête : « 12 aujourd'hui » ne veut rien dire sans savoir qu'hier en a fait 40.
    'visits_today',     (select count(*) from page_views where created_at >= jour0),
    'visitors_today',   (select count(distinct viewer_key) from page_views where created_at >= jour0),
    'visits_yesterday', (select count(*) from page_views where created_at >= jour1 and created_at < jour0),
    'visitors_yesterday', (select count(distinct viewer_key) from page_views where created_at >= jour1 and created_at < jour0),

    'visits_7d',        (select count(*) from page_views where created_at > now() - interval '7 days'),
    'visitors_7d',      (select count(distinct viewer_key) from page_views where created_at > now() - interval '7 days'),
    'visitors_total',   (select count(distinct viewer_key) from page_views),
    'favorites_total',  (select count(*) from favorites),

    -- Fréquentation par univers, du jour et de la semaine. Un même visiteur
    -- compté une fois par univers : les totaux par section peuvent donc
    -- dépasser le total du site, qui ne compte chaque personne qu'une fois.
    'by_site', coalesce((
      select jsonb_object_agg(site_key, jsonb_build_object(
               'visits_today', vj, 'visitors_today', uj,
               'visits_7d', v7, 'visitors_7d', u7))
      from (
        select
          case
            when path like '/food%'  then 'food'
            when path like '/event%' then 'event'
            when path like '/guide%' then 'guide'
            else 'tikanal'
          end as site_key,
          count(*) filter (where created_at >= jour0) as vj,
          count(distinct viewer_key) filter (where created_at >= jour0) as uj,
          count(*) filter (where created_at > now() - interval '7 days') as v7,
          count(distinct viewer_key) filter (where created_at > now() - interval '7 days') as u7
        from page_views
        group by 1
      ) s
    ), '{}'::jsonb),

    'by_module', coalesce((
      select jsonb_object_agg(module_key, n)
      from (select module::text as module_key, count(*) as n
            from listings where status = 'active' group by module) m
    ), '{}'::jsonb),

    'by_intent', coalesce((
      select jsonb_object_agg(intent_key, n)
      from (select intent::text as intent_key, count(*) as n
            from listings where status = 'active' group by intent) i
    ), '{}'::jsonb),

    -- 14 jours pleins découpés à l'heure de l'île, jours creux inclus :
    -- un trou dans une série se lit comme une absence de données, pas
    -- comme un zéro. Visiteurs uniques en plus des pages vues : c'est la
    -- courbe qui dit si l'audience grandit, la seconde ne dit que l'activité.
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
               'day', (d at time zone tz)::date,
               'visits', c, 'visitors', u) order by d)
      from (
        select g.d,
               count(v.id) as c,
               count(distinct v.viewer_key) as u
        from generate_series(jour0 - interval '13 days', jour0, interval '1 day') g(d)
        left join page_views v
          on v.created_at >= g.d and v.created_at < g.d + interval '1 day'
        group by g.d
      ) s
    ), '[]'::jsonb),

    'top_listings', coalesce((
      select jsonb_agg(t order by (t->>'views')::bigint desc)
      from (
        select jsonb_build_object(
                 'id', l.id, 'title', l.title, 'module', l.module::text,
                 'views', count(v.id)
               ) as t
        from listings l
        left join page_views v on v.listing_id = l.id
        where l.status = 'active'
        group by l.id, l.title, l.module
        order by count(v.id) desc
        limit 8
      ) x
    ), '[]'::jsonb)
  ) into result;

  return result;
end $$;

revoke all on function public.site_stats() from public;
grant execute on function public.site_stats() to authenticated;

-- Vérification (en tant qu'admin) : doit contenir visits_today et daily[].visitors.
-- select site_stats() -> 'visits_today', site_stats() -> 'daily' -> -1;
