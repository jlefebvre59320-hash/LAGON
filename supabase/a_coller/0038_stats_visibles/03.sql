
-- ---------- 3. site_stats : annonces et comptes, puis assemblage ----------

create or replace function public.site_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
  tz     text := 'America/St_Barthelemy';
  jour0  timestamptz;
  jour1  timestamptz;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  if not exists (select 1 from pg_timezone_names where name = tz) then tz := 'America/Port_of_Spain'; end if;
  jour0 := date_trunc('day', now() at time zone tz) at time zone tz;
  jour1 := jour0 - interval '1 day';

  select jsonb_build_object(
    'listings_total',   (select count(*) from listings),
    'listings_active',  (select count(*) from listings where status = 'active' and review_state in ('published', 'watch')),
    'listings_today',   (select count(*) from listings where created_at >= jour0),
    'listings_7d',      (select count(*) from listings where created_at > now() - interval '7 days'),
    'listings_30d',     (select count(*) from listings where created_at > now() - interval '30 days'),
    'users_total',      (select count(*) from profiles where not is_admin),
    'users_today',      (select count(*) from profiles where not is_admin and created_at >= jour0),
    'users_30d',        (select count(*) from profiles where not is_admin and created_at > now() - interval '30 days'),
    'favorites_total',  (select count(*) from favorites),
    'by_module', coalesce((select jsonb_object_agg(module_key, n)
      from (select module::text as module_key, count(*) as n from listings
             where status = 'active' and review_state in ('published', 'watch') group by module) m), '{}'::jsonb),
    'by_intent', coalesce((select jsonb_object_agg(intent_key, n)
      from (select intent::text as intent_key, count(*) as n from listings
             where status = 'active' and review_state in ('published', 'watch') group by intent) i), '{}'::jsonb),
    'top_listings', coalesce((
      select jsonb_agg(t order by (t->>'views')::bigint desc)
      from (select jsonb_build_object('id', l.id, 'title', l.title, 'module', l.module::text, 'views', count(v.id)) as t
              from listings l left join page_views v on v.listing_id = l.id
             where l.status = 'active' and l.review_state in ('published', 'watch')
             group by l.id, l.title, l.module order by count(v.id) desc limit 8) x), '[]'::jsonb)
  ) || public.site_stats_audience(jour0, jour1, tz) into result;

  return result;
end $$;

-- ---------- 4. admin_dashboard : indicateurs ----------

create or replace function public.admin_dash_kpi(debut timestamptz, fin timestamptz, debut_prec timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'vues', jsonb_build_object(
      'actuel',    (select count(*) from page_views where created_at >= debut and created_at < fin),
      'precedent', (select count(*) from page_views where created_at >= debut_prec and created_at < debut)),
    'visiteurs', jsonb_build_object(
      'actuel',    (select count(distinct viewer_key) from page_views where created_at >= debut and created_at < fin),
      'precedent', (select count(distinct viewer_key) from page_views where created_at >= debut_prec and created_at < debut)),
    'annonces', jsonb_build_object(
      'actuel',    (select count(*) from listings where created_at >= debut and created_at < fin),
      'precedent', (select count(*) from listings where created_at >= debut_prec and created_at < debut)),
    'comptes', jsonb_build_object(
      'actuel',    (select count(*) from profiles where not is_admin and created_at >= debut and created_at < fin),
      'precedent', (select count(*) from profiles where not is_admin and created_at >= debut_prec and created_at < debut)),
    'favoris', jsonb_build_object(
      'actuel',    (select count(*) from favorites where created_at >= debut and created_at < fin),
      'precedent', (select count(*) from favorites where created_at >= debut_prec and created_at < debut)),
    'annonces_actives', jsonb_build_object(
      'actuel', (select count(*) from listings where status = 'active' and review_state in ('published', 'watch'))));
$$;
