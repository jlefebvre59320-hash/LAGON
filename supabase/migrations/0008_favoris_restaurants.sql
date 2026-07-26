-- ============================================================
-- St Barth Food — Favoris de restaurants
-- Table distincte des favoris d'annonces : les deux univers ont
-- chacun leur liste dans Mon espace, et une fiche restaurant ne
-- vit pas au même rythme qu'une annonce (jamais « vendue »).
-- Idempotent : rejouable sur le projet en service.
-- ============================================================

create table if not exists public.restaurant_favorites (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);

create index if not exists idx_resto_favs_restaurant on public.restaurant_favorites (restaurant_id);

alter table public.restaurant_favorites enable row level security;

-- Même règle que les favoris d'annonces : chacun ne voit et ne gère que les
-- siens ; personne ne peut savoir qui a mis quel restaurant de côté.
drop policy if exists "resto_favs_select_own" on public.restaurant_favorites;
create policy "resto_favs_select_own" on public.restaurant_favorites
  for select using (auth.uid() = user_id);

drop policy if exists "resto_favs_insert_own" on public.restaurant_favorites;
create policy "resto_favs_insert_own" on public.restaurant_favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists "resto_favs_delete_own" on public.restaurant_favorites;
create policy "resto_favs_delete_own" on public.restaurant_favorites
  for delete using (auth.uid() = user_id);
