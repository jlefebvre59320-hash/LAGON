
-- ---------- 5. admin_dashboard : séries ----------

create or replace function public.admin_dash_series(debut timestamptz, fin timestamptz, pas interval)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'serie', coalesce((
      select jsonb_agg(jsonb_build_object('t', g.t,
               'vues', (select count(*) from page_views v where v.created_at >= g.t and v.created_at < g.t + pas),
               'visiteurs', (select count(distinct v.viewer_key) from page_views v where v.created_at >= g.t and v.created_at < g.t + pas))
             order by g.t)
      from generate_series(debut, fin, pas) g(t)), '[]'::jsonb),
    'serie_annonces', coalesce((
      select jsonb_agg(jsonb_build_object('t', g.t,
               'publiees', (select count(*) from listings l where l.created_at >= g.t and l.created_at < g.t + pas),
               'vendues', (select count(*) from listings l where l.sold_at is not null and l.sold_at >= g.t and l.sold_at < g.t + pas))
             order by g.t)
      from generate_series(debut, fin, pas) g(t)), '[]'::jsonb),
    'serie_comptes', coalesce((
      select jsonb_agg(jsonb_build_object('t', g.t,
               'nouveaux', (select count(*) from profiles p where not p.is_admin and p.created_at >= g.t and p.created_at < g.t + pas))
             order by g.t)
      from generate_series(debut, fin, pas) g(t)), '[]'::jsonb));
$$;

-- ---------- 6. admin_dashboard : classements ----------

create or replace function public.admin_dash_listes(debut timestamptz, fin timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('module', m.module_key, 'annonces', m.annonces, 'vues', m.vues)
             order by m.vues desc, m.annonces desc)
      from (select l.module::text as module_key,
                   count(*) filter (where l.status = 'active' and l.review_state in ('published', 'watch')) as annonces,
                   (select count(*) from page_views v join listings l2 on l2.id = v.listing_id
                     where l2.module = l.module and v.created_at >= debut and v.created_at < fin) as vues
              from listings l group by l.module) m), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object('path', p.path, 'titre', p.titre, 'vues', p.vues, 'visiteurs', p.visiteurs) order by p.vues desc)
      from (select v.path, count(*) as vues, count(distinct v.viewer_key) as visiteurs,
                   case when v.path = '/' then 'Accueil · annonces'
                        when v.path = '/guide' then 'St Barth Guide'
                        when v.path = '/food' then 'St Barth Food'
                        when v.path = '/event' then 'St Barth Event'
                        when v.path = '/soutenir' then 'Soutenir le site'
                        when v.path like '/annonce/%' then coalesce((select l.title from listings l where l.id = substr(v.path, 10)::uuid), 'Annonce supprimée')
                        when v.path like '/guide/lieu/%' then coalesce((select pl.name from places pl where pl.id = substr(v.path, 13)::uuid), 'Lieu retiré')
                        when v.path like '/food/resto/%' then coalesce((select r.name from restaurants r where r.id = substr(v.path, 13)::uuid), 'Restaurant retiré')
                        else v.path end as titre
              from page_views v where v.created_at >= debut and v.created_at < fin
             group by v.path order by count(*) desc limit 10) p), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('cle', s.source, 'vues', s.n) order by s.n desc)
      from (select source, count(*) as n from page_views where created_at >= debut and created_at < fin and source is not null group by source) s), '[]'::jsonb),
    'appareils', coalesce((select jsonb_agg(jsonb_build_object('cle', d.device, 'vues', d.n) order by d.n desc)
      from (select device, count(*) as n from page_views where created_at >= debut and created_at < fin and device is not null group by device) d), '[]'::jsonb));
$$;
