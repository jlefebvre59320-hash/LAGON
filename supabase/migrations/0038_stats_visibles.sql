-- ============================================================
-- 0038 — Statistiques : ce qui se voit, sans les administrateurs,
--        et le temps réel.
--
-- · Depuis la modération (0032), une annonce « active » peut être en
--   attente ou retenue, donc invisible : les statistiques ne comptent plus
--   que les annonces publiées ou surveillées.
-- · Les administrateurs sortent de toutes les statistiques : leurs pages
--   vues ne sont plus enregistrées, leurs comptes ne sont plus comptés.
-- · admin_temps_reel() : visiteurs maintenant, visiteurs uniques et
--   comptes créés sur 24 h, reconnexions, sessions, 24 heures heure par
--   heure, visiteurs présents, détails.
--
-- Chaque fonction tient en moins de 4 500 octets : le fichier se colle
-- morceau par morceau dans un éditeur SQL qui tronque les longs textes
-- (voir supabase/a_coller/). Les fonctions « aides » (site_stats_audience,
-- admin_dash_*, tr_*) ne sont appelables que par les fonctions
-- principales, qui vérifient le rôle administrateur.
-- ============================================================

-- ---------- 1. Les administrateurs ne laissent pas de trace ----------

create or replace function public.record_page_view(
  p_path text, p_listing_id uuid default null, p_viewer_key text default null,
  p_device text default null, p_source text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_path is null or char_length(p_path) not between 1 and 300 or left(p_path, 1) <> '/' then
    raise exception 'Chemin invalide.';
  end if;
  if p_path not in ('/', '/food', '/event', '/guide', '/soutenir')
     and p_path !~ '^/(annonce|food/resto|guide/lieu)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Page non mesurée.';
  end if;
  if p_viewer_key is null then return; end if;
  -- Un administrateur qui vérifie le site n'est pas un visiteur.
  if auth.uid() is not null and public.is_admin() then return; end if;
  if char_length(p_viewer_key) not between 16 and 100 then
    raise exception 'Identifiant visiteur invalide.';
  end if;
  if p_listing_id is not null and p_path <> '/annonce/' || p_listing_id::text then
    raise exception 'Annonce et chemin incohérents.';
  end if;
  if not exists (select 1 from public.page_views v
                  where v.path = p_path and v.viewer_key = p_viewer_key
                    and v.created_at > now() - interval '30 minutes') then
    insert into public.page_views (path, listing_id, viewer_key, device, source)
    values (p_path, p_listing_id, p_viewer_key,
      case when p_device in ('mobile', 'ordinateur', 'tablette') then p_device end,
      case when p_source in ('direct', 'google', 'bing', 'facebook', 'instagram', 'whatsapp', 'autre') then p_source end);
  end if;
end $$;

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

-- ---------- 9. Temps réel : les comptes (hors administrateurs) ----------

create or replace function public.tr_comptes(h24 timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  with membres as (
    select u.id, u.email, u.created_at, u.last_sign_in_at from auth.users u
     where not coalesce((select is_admin from public.profiles p where p.id = u.id), false))
  select jsonb_build_object(
    'comptes_crees_24h', (select count(*) from membres where created_at > h24),
    -- Reconnexion : un compte qui existait déjà hier et qui s'est reconnecté.
    'reconnexions_24h',  (select count(*) from membres where last_sign_in_at > h24 and created_at <= h24),
    'connexions',        (select count(*) from membres where last_sign_in_at > h24),
    'comptes_total',     (select count(*) from membres),
    'comptes_crees_7j',  (select count(*) from membres where created_at > now() - interval '7 days'),
    'dernieres_connexions', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'nom', coalesce(p.display_name, 'Membre'), 'email', u.email,
                                          'quand', u.last_sign_in_at, 'nouveau', u.created_at > h24) order by u.last_sign_in_at desc)
        from (select * from membres where last_sign_in_at is not null order by last_sign_in_at desc limit 12) u
        left join public.profiles p on p.id = u.id), '[]'));
$$;

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

-- ---------- 11. Droits ----------

-- Les aides ne se lancent pas à la main : seules les fonctions principales,
-- qui vérifient le rôle administrateur, y ont accès.
revoke all on function public.site_stats_audience(timestamptz, timestamptz, text)       from public, anon, authenticated;
revoke all on function public.admin_dash_kpi(timestamptz, timestamptz, timestamptz)      from public, anon, authenticated;
revoke all on function public.admin_dash_series(timestamptz, timestamptz, interval)      from public, anon, authenticated;
revoke all on function public.admin_dash_listes(timestamptz, timestamptz)                from public, anon, authenticated;
revoke all on function public.tr_sessions(timestamptz)                                   from public, anon, authenticated;
revoke all on function public.tr_comptes(timestamptz)                                    from public, anon, authenticated;
revoke all on function public.admin_temps_reel() from public;
grant execute on function public.admin_temps_reel() to authenticated;
-- site_stats, admin_dashboard et record_page_view gardent les droits posés
-- par 0024, 0029 et 0020 (create or replace les conserve).
