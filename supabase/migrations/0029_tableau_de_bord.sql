-- ============================================================
-- 0029 — Le tableau de bord : une seule requête, plusieurs périodes.
--
-- site_stats() n'est pas touchée : elle continue de servir les blocs
-- existants. Cette fonction-ci vient à côté, paramétrée par une durée,
-- et rend d'un coup ce qu'il faut pour tout l'écran — séries, KPI avec
-- période précédente, classements. Un aller-retour par changement de
-- période plutôt qu'un par graphique.
--
-- Ce qui n'existe pas n'est pas inventé. Deux ajouts honnêtes en
-- revanche : la provenance et le type d'appareil, jusqu'ici jamais
-- mesurés. Ils sont volontairement grossiers — une poignée de valeurs
-- fermées, aucun user-agent conservé, aucune URL de provenance : de
-- quoi répondre « d'où viennent les gens » sans constituer un profil.
-- Les graphiques correspondants resteront vides tant qu'aucune visite
-- n'aura été enregistrée après cette migration, et c'est normal.
-- ============================================================

alter table public.page_views
  add column if not exists device text,
  add column if not exists source text;

-- Valeurs fermées : la colonne ne peut pas devenir un champ de texte libre.
alter table public.page_views
  drop constraint if exists page_views_device_connu,
  drop constraint if exists page_views_source_connue;
alter table public.page_views
  add constraint page_views_device_connu
  check (device is null or device in ('mobile', 'ordinateur', 'tablette')) not valid;
alter table public.page_views
  add constraint page_views_source_connue
  check (source is null or source in
    ('direct', 'google', 'bing', 'facebook', 'instagram', 'whatsapp', 'autre')) not valid;

-- ---------- La mesure accepte les deux nouvelles informations ----------

-- L'ancienne signature est retirée avant de poser la nouvelle : garder les
-- deux créerait une ambiguïté d'appel côté PostgREST. Les paramètres ont
-- une valeur par défaut, donc un client pas encore déployé continue de
-- fonctionner à l'identique.
drop function if exists public.record_page_view(text, uuid, text);

create or replace function public.record_page_view(
  p_path       text,
  p_listing_id uuid default null,
  p_viewer_key text default null,
  p_device     text default null,
  p_source     text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_path is null or char_length(p_path) not between 1 and 300
     or left(p_path, 1) <> '/' then
    raise exception 'Chemin invalide.';
  end if;
  if p_path not in ('/', '/food', '/event', '/guide', '/soutenir')
     and p_path !~ '^/(annonce|food/resto|guide/lieu)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Page non mesurée.';
  end if;
  if p_viewer_key is null then
    return;
  end if;
  if char_length(p_viewer_key) not between 16 and 100 then
    raise exception 'Identifiant visiteur invalide.';
  end if;
  if p_listing_id is not null
     and p_path <> '/annonce/' || p_listing_id::text then
    raise exception 'Annonce et chemin incohérents.';
  end if;

  if not exists (
    select 1 from public.page_views v
    where v.path = p_path
      and v.viewer_key = p_viewer_key
      and v.created_at > now() - interval '30 minutes'
  ) then
    insert into public.page_views (path, listing_id, viewer_key, device, source)
    values (
      p_path, p_listing_id, p_viewer_key,
      -- Une valeur inattendue est ramenée à null plutôt que de faire échouer
      -- la mesure : perdre une précision vaut mieux que perdre la visite.
      case when p_device in ('mobile', 'ordinateur', 'tablette') then p_device end,
      case when p_source in ('direct', 'google', 'bing', 'facebook',
                             'instagram', 'whatsapp', 'autre') then p_source end
    );
  end if;
end;
$$;

revoke all on function public.record_page_view(text, uuid, text, text, text) from public;
grant execute on function public.record_page_view(text, uuid, text, text, text)
  to anon, authenticated;

-- Les classements par provenance et par appareil filtrent d'abord sur la
-- période : l'index composite évite un parcours complet de la table.
create index if not exists idx_page_views_source on public.page_views (created_at desc, source);
create index if not exists idx_page_views_device on public.page_views (created_at desc, device);

-- ---------- Le tableau de bord ----------

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
        'actuel', (select count(*) from listings where status = 'active'))
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
               count(*) filter (where l.status = 'active') as annonces,
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

revoke all on function public.admin_dashboard(int) from public;
grant execute on function public.admin_dashboard(int) to authenticated;

-- Vérification (en tant qu'admin) : doit renvoyer la période et une série.
-- select admin_dashboard(7) -> 'periode';
