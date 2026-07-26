-- ============================================================
-- St Barth Food — Notes de 1 à 5 sur les restaurants
-- Une note par compte et par établissement, modifiable.
-- Idempotent : rejouable sur le projet en service.
-- ============================================================

create table if not exists public.restaurant_ratings (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  rating        smallint not null check (rating between 1 and 5),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (restaurant_id, user_id)
);

create index if not exists idx_ratings_restaurant on public.restaurant_ratings (restaurant_id);

alter table public.restaurant_ratings enable row level security;

-- Chacun lit et gère sa propre note. Personne ne peut lister qui a noté quoi :
-- le public ne voit que des moyennes, via la fonction ci-dessous.
drop policy if exists "ratings_select_own" on public.restaurant_ratings;
create policy "ratings_select_own" on public.restaurant_ratings
  for select using (auth.uid() = user_id);

drop policy if exists "ratings_upsert_own" on public.restaurant_ratings;
create policy "ratings_upsert_own" on public.restaurant_ratings
  for insert with check (auth.uid() = user_id);

drop policy if exists "ratings_update_own" on public.restaurant_ratings;
create policy "ratings_update_own" on public.restaurant_ratings
  for update using (auth.uid() = user_id);

drop policy if exists "ratings_delete_own" on public.restaurant_ratings;
create policy "ratings_delete_own" on public.restaurant_ratings
  for delete using (auth.uid() = user_id);

-- Moyennes publiques : des agrégats, jamais d'identités.
create or replace function public.ratings_summary()
returns table (restaurant_id uuid, avg_rating numeric, votes bigint)
language sql stable security definer set search_path = public as $$
  select r.restaurant_id, round(avg(r.rating)::numeric, 1), count(*)
  from restaurant_ratings r
  group by r.restaurant_id;
$$;
