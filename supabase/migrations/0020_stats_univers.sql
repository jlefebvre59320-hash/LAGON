-- ============================================================
-- 0020 — Fréquentation par univers dans le tableau de bord.
--
-- Le tableau de bord donnait un total, sans dire quelle section le
-- produisait. Savoir que Food attire deux fois plus que les annonces
-- change les priorités : cette migration ventile visites et visiteurs
-- uniques par univers, à partir du chemin des pages vues.
--
-- L'univers se déduit du chemin (/food…, /event…, /guide…, le reste
-- étant Ti Kanal) : aucune colonne à ajouter, l'historique déjà
-- enregistré est donc ventilé rétroactivement.
-- ============================================================

create or replace function public.site_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;

  select jsonb_build_object(
    'listings_total',   (select count(*) from listings),
    'listings_active',  (select count(*) from listings where status = 'active'),
    'listings_30d',     (select count(*) from listings where created_at > now() - interval '30 days'),
    'listings_7d',      (select count(*) from listings where created_at > now() - interval '7 days'),
    'users_total',      (select count(*) from profiles),
    'users_30d',        (select count(*) from profiles where created_at > now() - interval '30 days'),
    'views_total',      (select count(*) from page_views where listing_id is not null),
    'views_7d',         (select count(*) from page_views where listing_id is not null and created_at > now() - interval '7 days'),
    'visits_7d',        (select count(*) from page_views where created_at > now() - interval '7 days'),
    'visitors_7d',      (select count(distinct viewer_key) from page_views where created_at > now() - interval '7 days'),
    'visits_30d',       (select count(*) from page_views where created_at > now() - interval '30 days'),
    'visitors_30d',     (select count(distinct viewer_key) from page_views where created_at > now() - interval '30 days'),
    'visitors_total',   (select count(distinct viewer_key) from page_views),
    'favorites_total',  (select count(*) from favorites),

    -- Fréquentation par univers. Un même visiteur compté une fois par
    -- univers : les totaux par section peuvent donc dépasser le total du
    -- site, qui lui ne compte chaque personne qu'une fois.
    'by_site', coalesce((
      select jsonb_object_agg(site_key, jsonb_build_object(
               'visits_7d', v7, 'visitors_7d', u7,
               'visits_30d', v30, 'visitors_30d', u30))
      from (
        select
          case
            when path like '/food%'  then 'food'
            when path like '/event%' then 'event'
            when path like '/guide%' then 'guide'
            else 'tikanal'
          end as site_key,
          count(*) filter (where created_at > now() - interval '7 days')  as v7,
          count(distinct viewer_key) filter (where created_at > now() - interval '7 days')  as u7,
          count(*) filter (where created_at > now() - interval '30 days') as v30,
          count(distinct viewer_key) filter (where created_at > now() - interval '30 days') as u30
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

    -- 14 jours pleins, jours creux inclus : un trou dans une série se lit
    -- comme une absence de données, pas comme un zéro.
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', d::date, 'visits', c) order by d)
      from (
        select g.d, count(v.id) as c
        from generate_series(date_trunc('day', now()) - interval '13 days',
                             date_trunc('day', now()), interval '1 day') g(d)
        left join page_views v on v.created_at >= g.d and v.created_at < g.d + interval '1 day'
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

-- Le filtrage par chemin est fréquent maintenant : un index le rend immédiat.
create index if not exists idx_page_views_path on public.page_views (path text_pattern_ops, created_at desc);
