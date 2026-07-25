-- ============================================================
-- Ti Kanal — Favoris, espace personnel et statistiques
-- Idempotent : rejouable sur un projet déjà en service.
-- L'ordre compte : is_admin() est définie avant les policies qui l'appellent.
-- ============================================================

-- ---------- Administrateur (d'abord : les policies plus bas s'en servent) ----------
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- Les profils sont en lecture publique (nom affiché, numéro WhatsApp) : il ne
-- faut pas que cette lecture révèle qui administre le site. La colonne est donc
-- retirée du SELECT côté client ; on passe par is_admin(), qui ne répond que
-- pour l'appelant lui-même.
revoke select (is_admin) on public.profiles from anon, authenticated;

-- ---------- Favoris ----------
create table if not exists public.favorites (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index if not exists idx_favorites_listing on public.favorites (listing_id);
create index if not exists idx_favorites_user    on public.favorites (user_id, created_at desc);

alter table public.favorites enable row level security;

-- Chacun ne voit et ne gère que ses propres favoris. Le nombre de favoris d'une
-- annonce est exposé à son propriétaire par la fonction my_listings_stats(),
-- jamais la liste des personnes : personne ne doit savoir qui l'a mise de côté.
drop policy if exists "favorites_select_own" on public.favorites;
create policy "favorites_select_own" on public.favorites
  for select using (auth.uid() = user_id);

drop policy if exists "favorites_insert_own" on public.favorites;
create policy "favorites_insert_own" on public.favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_delete_own" on public.favorites
  for delete using (auth.uid() = user_id);

-- ---------- Fréquentation ----------
-- viewer_key : identifiant aléatoire tiré dans le navigateur, sans aucun lien
-- avec l'identité. Il sert uniquement à ne pas compter dix fois la même personne.
create table if not exists public.page_views (
  id         bigint generated always as identity primary key,
  path       text not null,
  listing_id uuid references public.listings(id) on delete cascade,
  viewer_key text,
  created_at timestamptz not null default now()
);

create index if not exists idx_page_views_created on public.page_views (created_at desc);
create index if not exists idx_page_views_listing on public.page_views (listing_id, created_at desc);

alter table public.page_views enable row level security;

-- Écriture ouverte (les visiteurs non connectés comptent aussi), lecture réservée.
drop policy if exists "page_views_insert_all" on public.page_views;
create policy "page_views_insert_all" on public.page_views
  for insert with check (true);

drop policy if exists "page_views_select_admin" on public.page_views;
create policy "page_views_select_admin" on public.page_views
  for select using (public.is_admin());

-- ---------- Statistiques d'un annonceur sur ses propres annonces ----------
-- security definer : lit page_views (fermé en lecture) mais ne rend que des
-- compteurs, et seulement pour les annonces de l'appelant.
create or replace function public.my_listings_stats()
returns table (listing_id uuid, views bigint, unique_viewers bigint, favorites bigint)
language sql stable security definer set search_path = public as $$
  select l.id,
         (select count(*)                     from page_views v where v.listing_id = l.id),
         (select count(distinct v.viewer_key)  from page_views v where v.listing_id = l.id),
         (select count(*)                     from favorites  f where f.listing_id = l.id)
  from listings l
  where l.user_id = auth.uid();
$$;

-- ---------- Tableau de bord du site (administrateur) ----------
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
    'favorites_total',  (select count(*) from favorites),

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

-- ---------- Se donner les droits d'administrateur ----------
-- À exécuter séparément, après avoir créé son compte depuis le site :
-- update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'vous@exemple.com');
