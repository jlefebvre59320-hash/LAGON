-- ============================================================
-- 0038 — Statistiques justes : ne compter que ce qui se voit.
--
-- Depuis la modération (0032), une annonce « active » peut être en attente
-- ou retenue, donc invisible du public. Les statistiques de
-- l'administration (site_stats, admin_dashboard) comptaient encore ces
-- annonces comme « en ligne ». Les deux fonctions sont reprises à
-- l'identique, à cette condition près : publiée ou surveillée.
--
-- Le temps réel gagne la courbe du jour heure par heure, le pic du jour,
-- et les connexions sur deux heures ; une colonne inutilisée disparaît.
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
    'listings_active',  (select count(*) from listings where status = 'active' and review_state in ('published', 'watch')),
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
            from listings where status = 'active' and review_state in ('published', 'watch') group by module) m
    ), '{}'::jsonb),

    'by_intent', coalesce((
      select jsonb_object_agg(intent_key, n)
      from (select intent::text as intent_key, count(*) as n
            from listings where status = 'active' and review_state in ('published', 'watch') group by intent) i
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
        where l.status = 'active' and l.review_state in ('published', 'watch')
        group by l.id, l.title, l.module
        order by count(v.id) desc
        limit 8
      ) x
    ), '[]'::jsonb)
  ) into result;

  return result;
end $$;

create or replace function public.admin_dashboard(p_jours int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz         text := 'America/St_Barthelemy';
  jours      int;
  gran       text;
  pas        interval;
  debut      timestamptz;
  fin        timestamptz := now();
  debut_prec timestamptz;
  result     jsonb;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  if not exists (select 1 from pg_timezone_names where name = tz) then
    tz := 'America/Port_of_Spain';
  end if;

  -- Durées fermées : une valeur libre ouvrirait la porte à une requête
  -- volontairement coûteuse.
  jours := case when p_jours in (1, 7, 30, 90, 365) then p_jours else 30 end;

  -- Le pas s'adapte à la durée : 365 points quotidiens sur un an seraient
  -- illisibles à l'écran et inutilement lourds à calculer.
  if jours = 1 then
    gran := 'heure'; pas := interval '1 hour';
    debut := date_trunc('day', now() at time zone tz) at time zone tz;
  elsif jours <= 30 then
    gran := 'jour'; pas := interval '1 day';
    debut := (date_trunc('day', now() at time zone tz)
              - make_interval(days => jours - 1)) at time zone tz;
  elsif jours <= 90 then
    gran := 'semaine'; pas := interval '1 week';
    debut := date_trunc('week', (now() at time zone tz)
              - make_interval(days => jours - 1)) at time zone tz;
  else
    gran := 'mois'; pas := interval '1 month';
    debut := date_trunc('month', (now() at time zone tz)
              - make_interval(days => jours - 1)) at time zone tz;
  end if;
  debut_prec := debut - make_interval(days => jours);

  select jsonb_build_object(
    'periode', jsonb_build_object(
      'jours', jours, 'granularite', gran,
      'debut', debut, 'fin', fin, 'debut_precedent', debut_prec
    ),

    -- ---- Indicateurs, avec la période précédente de même longueur ----
    'kpi', jsonb_build_object(
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
        'actuel',    (select count(*) from profiles where created_at >= debut and created_at < fin),
        'precedent', (select count(*) from profiles where created_at >= debut_prec and created_at < debut)),
      'favoris', jsonb_build_object(
        'actuel',    (select count(*) from favorites where created_at >= debut and created_at < fin),
        'precedent', (select count(*) from favorites where created_at >= debut_prec and created_at < debut)),
      -- Un état, pas un flux : comparer un stock à « la période précédente »
      -- n'aurait aucun sens, donc aucune évolution n'est fournie.
      'annonces_actives', jsonb_build_object(
        'actuel', (select count(*) from listings where status = 'active' and review_state in ('published', 'watch')))
    ),

    -- ---- Fréquentation, pas à pas ----
    'serie', coalesce((
      select jsonb_agg(jsonb_build_object(
               't', b.t, 'vues', b.vues, 'visiteurs', b.visiteurs) order by b.t)
      from (
        select g.t,
               (select count(*) from page_views v
                 where v.created_at >= g.t and v.created_at < g.t + pas) as vues,
               (select count(distinct v.viewer_key) from page_views v
                 where v.created_at >= g.t and v.created_at < g.t + pas) as visiteurs
        from generate_series(debut, fin, pas) g(t)
      ) b
    ), '[]'::jsonb),

    -- ---- Vie des annonces : publiées et vendues ----
    -- Les suppressions ne sont pas représentables : une annonce supprimée
    -- disparaît de la table, il n'existe aucune date de suppression à
    -- laquelle la rattacher. Mieux vaut ne pas tracer la courbe.
    'serie_annonces', coalesce((
      select jsonb_agg(jsonb_build_object(
               't', b.t, 'publiees', b.publiees, 'vendues', b.vendues) order by b.t)
      from (
        select g.t,
               (select count(*) from listings l
                 where l.created_at >= g.t and l.created_at < g.t + pas) as publiees,
               (select count(*) from listings l
                 where l.sold_at is not null
                   and l.sold_at >= g.t and l.sold_at < g.t + pas) as vendues
        from generate_series(debut, fin, pas) g(t)
      ) b
    ), '[]'::jsonb),

    -- ---- Nouveaux comptes ----
    'serie_comptes', coalesce((
      select jsonb_agg(jsonb_build_object('t', b.t, 'nouveaux', b.n) order by b.t)
      from (
        select g.t,
               (select count(*) from profiles p
                 where p.created_at >= g.t and p.created_at < g.t + pas) as n
        from generate_series(debut, fin, pas) g(t)
      ) b
    ), '[]'::jsonb),

    -- ---- Catégories : ce qu'on publie, ce qu'on regarde ----
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
               'module', m.module_key, 'annonces', m.annonces, 'vues', m.vues)
             order by m.vues desc, m.annonces desc)
      from (
        select l.module::text as module_key,
               count(*) filter (where l.status = 'active' and l.review_state in ('published', 'watch')) as annonces,
               (select count(*) from page_views v
                 join listings l2 on l2.id = v.listing_id
                where l2.module = l.module
                  and v.created_at >= debut and v.created_at < fin) as vues
        from listings l
        group by l.module
      ) m
    ), '[]'::jsonb),

    -- ---- Pages les plus vues, avec un libellé lisible ----
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'path', p.path, 'titre', p.titre,
               'vues', p.vues, 'visiteurs', p.visiteurs)
             order by p.vues desc)
      from (
        select v.path,
               count(*) as vues,
               count(distinct v.viewer_key) as visiteurs,
               case
                 when v.path = '/'         then 'Accueil · annonces'
                 when v.path = '/guide'    then 'St Barth Guide'
                 when v.path = '/food'     then 'St Barth Food'
                 when v.path = '/event'    then 'St Barth Event'
                 when v.path = '/soutenir' then 'Soutenir le site'
                 when v.path like '/annonce/%' then
                   coalesce((select l.title from listings l where l.id = substr(v.path, 10)::uuid),
                            'Annonce supprimée')
                 when v.path like '/guide/lieu/%' then
                   coalesce((select pl.name from places pl where pl.id = substr(v.path, 13)::uuid),
                            'Lieu retiré')
                 when v.path like '/food/resto/%' then
                   coalesce((select r.name from restaurants r where r.id = substr(v.path, 13)::uuid),
                            'Restaurant retiré')
                 else v.path
               end as titre
        from page_views v
        where v.created_at >= debut and v.created_at < fin
        group by v.path
        order by count(*) desc
        limit 10
      ) p
    ), '[]'::jsonb),

    -- ---- Provenance et appareils : vides tant que rien n'a été mesuré ----
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('cle', s.source, 'vues', s.n) order by s.n desc)
      from (select source, count(*) as n from page_views
             where created_at >= debut and created_at < fin and source is not null
             group by source) s
    ), '[]'::jsonb),

    'appareils', coalesce((
      select jsonb_agg(jsonb_build_object('cle', d.device, 'vues', d.n) order by d.n desc)
      from (select device, count(*) as n from page_views
             where created_at >= debut and created_at < fin and device is not null
             group by device) d
    ), '[]'::jsonb)
  ) into result;

  return result;
end $$;

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
           (array_agg(source order by created_at))[1] as source
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
    'par_minute', coalesce((select jsonb_agg(jsonb_build_object('t', t, 'n', n) order by t) from minutes), '[]'),
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
      'connectes_2h',    (select count(*) from auth.users where last_sign_in_at > now() - interval '2 hours'),
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
    'pic_jour', (select coalesce(max(n), 0) from (select count(*) n from public.page_views where created_at >= jour group by date_trunc('hour', created_at)) h),
    'heure_pic', (select to_char((h.t at time zone tz), 'HH24"h"') from (select date_trunc('hour', created_at) t, count(*) n from public.page_views where created_at >= jour group by 1 order by 2 desc limit 1) h),
    'par_heure_jour', coalesce((select jsonb_agg(jsonb_build_object('h', to_char((gs at time zone tz), 'HH24"h"'), 'n', (select count(*) from public.page_views p where p.created_at >= gs and p.created_at < gs + interval '1 hour'), 'v', (select count(distinct viewer_key) from public.page_views p where p.created_at >= gs and p.created_at < gs + interval '1 hour')) order by gs) from generate_series(jour, date_trunc('hour', now()), interval '1 hour') gs), '[]'),
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

-- Les droits ne changent pas : create or replace conserve ceux posés par
-- 0024, 0029 et 0037.
