
-- ---------- 7. admin_dashboard : la période, puis assemblage ----------

create or replace function public.admin_dashboard(p_jours int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  tz text := 'America/St_Barthelemy';
  jours int; gran text; pas interval;
  debut timestamptz; fin timestamptz := now(); debut_prec timestamptz;
begin
  if not public.is_admin() then raise exception 'Réservé aux administrateurs.'; end if;
  if not exists (select 1 from pg_timezone_names where name = tz) then tz := 'America/Port_of_Spain'; end if;
  -- Durées fermées : une valeur libre ouvrirait la porte à une requête coûteuse.
  jours := case when p_jours in (1, 7, 30, 90, 365) then p_jours else 30 end;
  if jours = 1 then
    gran := 'heure'; pas := interval '1 hour';
    debut := date_trunc('day', now() at time zone tz) at time zone tz;
  elsif jours <= 30 then
    gran := 'jour'; pas := interval '1 day';
    debut := (date_trunc('day', now() at time zone tz) - make_interval(days => jours - 1)) at time zone tz;
  elsif jours <= 90 then
    gran := 'semaine'; pas := interval '1 week';
    debut := date_trunc('week', (now() at time zone tz) - make_interval(days => jours - 1)) at time zone tz;
  else
    gran := 'mois'; pas := interval '1 month';
    debut := date_trunc('month', (now() at time zone tz) - make_interval(days => jours - 1)) at time zone tz;
  end if;
  debut_prec := debut - make_interval(days => jours);

  return jsonb_build_object(
    'periode', jsonb_build_object('jours', jours, 'granularite', gran, 'debut', debut, 'fin', fin, 'debut_precedent', debut_prec),
    'kpi', public.admin_dash_kpi(debut, fin, debut_prec))
    || public.admin_dash_series(debut, fin, pas)
    || public.admin_dash_listes(debut, fin);
end $$;

-- ---------- 8. Temps réel : les sessions ----------

-- Une session : les vues d'un même navigateur sans trou de plus de trente
-- minutes. Anonyme, jamais reliée à un compte.
create or replace function public.tr_sessions(h24 timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  with v as (
    select viewer_key, created_at, path, listing_id, device, source,
           lag(created_at) over (partition by viewer_key order by created_at) as prec
      from public.page_views where created_at > now() - interval '36 hours' and viewer_key is not null),
  m as (select *, case when prec is null or created_at - prec > interval '30 minutes' then 1 else 0 end as nouvelle from v),
  s as (select *, sum(nouvelle) over (partition by viewer_key order by created_at) as sid from m),
  sess as (
    select viewer_key, sid, min(created_at) as debut, max(created_at) as fin, count(*) as pages,
           (array_agg(path order by created_at desc))[1] as derniere,
           (array_agg(listing_id order by created_at desc))[1] as dernier_listing,
           (array_agg(device order by created_at desc))[1] as device,
           (array_agg(source order by created_at))[1] as source
      from s group by viewer_key, sid),
  recentes as (select * from sess where debut > h24)
  select jsonb_build_object(
    'sessions_actives', coalesce((
      select jsonb_agg(jsonb_build_object(
        'cle', left(md5(viewer_key), 6), 'debut', debut, 'fin', fin,
        'duree_s', extract(epoch from fin - debut)::int, 'pages', pages,
        'device', device, 'source', source, 'derniere', derniere,
        'titre', (select title from public.listings where id = dernier_listing)) order by fin desc)
      from sess where fin > now() - interval '5 minutes'), '[]'),
    'sessions', (select count(*) from recentes),
    'duree_moyenne_s', (select coalesce(avg(extract(epoch from fin - debut)) filter (where pages > 1), 0)::int from recentes),
    'pages_par_session', (select coalesce(round(avg(pages)::numeric, 1), 0) from recentes));
$$;
