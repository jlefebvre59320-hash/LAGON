-- ============================================================
-- St Barth Food — Restaurants et demandes des établissements
-- Même base que Ti Kanal : compte unique, administration unique.
-- Idempotent : rejouable sur le projet en service.
-- ============================================================

-- ---------- Types ----------
do $$
begin
  create type restaurant_status as enum ('active', 'hidden');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type restaurant_claim_kind as enum ('claim', 'correction', 'removal');
exception when duplicate_object then null;
end $$;

-- ---------- Restaurants ----------
-- owner_id est vide pour une fiche pré-remplie par l'administration ; il se
-- remplit quand le restaurateur revendique sa fiche (via restaurant_claims,
-- traitée à la main : c'est un acte de confiance, pas un clic automatique).
--
-- hours : JSONB { "mon": [["11:30","14:30"],["19:00","22:30"]], ... } avec les
-- clés mon..sun. Un jour absent ou vide = fermé ce jour-là. Un créneau dont la
-- fin est avant le début (ex. 19:00 → 01:00) déborde sur le lendemain.
create table if not exists public.restaurants (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references public.profiles(id) on delete set null,
  name         text not null check (char_length(name) between 2 and 80),
  cuisine      text not null,
  quartier     text not null,
  address      text not null default '',
  phone        text,
  whatsapp     text,               -- E.164, ex +590690XXXXXX
  instagram    text,               -- identifiant sans @
  website      text,
  description  text not null default '' check (char_length(description) <= 2000),
  price_range  smallint not null default 2 check (price_range between 1 and 3),
  takeaway     boolean not null default false,
  hours        jsonb not null default '{}',
  status       restaurant_status not null default 'active',
  created_at   timestamptz not null default now()
);

create index if not exists idx_restaurants_browse   on public.restaurants (status, cuisine, name);
create index if not exists idx_restaurants_quartier on public.restaurants (status, quartier, name);
create index if not exists idx_restaurants_owner    on public.restaurants (owner_id);

alter table public.restaurants enable row level security;

drop policy if exists "restaurants_select" on public.restaurants;
create policy "restaurants_select" on public.restaurants
  for select using (status = 'active' or owner_id = auth.uid() or public.is_admin());

-- Création : l'administration (fiches pré-remplies) ou un restaurateur pour
-- sa propre fiche.
drop policy if exists "restaurants_insert" on public.restaurants;
create policy "restaurants_insert" on public.restaurants
  for insert with check (public.is_admin() or owner_id = auth.uid());

drop policy if exists "restaurants_update" on public.restaurants;
create policy "restaurants_update" on public.restaurants
  for update using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "restaurants_delete" on public.restaurants;
create policy "restaurants_delete" on public.restaurants
  for delete using (public.is_admin());

-- ---------- Demandes des établissements ----------
-- « C'est votre établissement ? » : revendication, correction ou retrait.
-- L'écriture est ouverte, sans compte : un restaurateur qui demande le retrait
-- de sa fiche ne doit pas avoir à s'inscrire pour être entendu. Le champ
-- contact est obligatoire pour pouvoir répondre (et rappeler avant de donner
-- la main sur une fiche). Lecture : administration seulement.
create table if not exists public.restaurant_claims (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  kind          restaurant_claim_kind not null,
  message       text not null check (char_length(message) between 3 and 1000),
  contact       text not null check (char_length(contact) between 3 and 200),
  user_id       uuid references public.profiles(id) on delete set null,
  handled       boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_claims_pending on public.restaurant_claims (handled, created_at desc);

alter table public.restaurant_claims enable row level security;

drop policy if exists "claims_insert_all" on public.restaurant_claims;
create policy "claims_insert_all" on public.restaurant_claims
  for insert with check (true);

drop policy if exists "claims_select_admin" on public.restaurant_claims;
create policy "claims_select_admin" on public.restaurant_claims
  for select using (public.is_admin());

drop policy if exists "claims_update_admin" on public.restaurant_claims;
create policy "claims_update_admin" on public.restaurant_claims
  for update using (public.is_admin());

-- ---------- Exemple de fiche (format des horaires) ----------
-- insert into public.restaurants (name, cuisine, quartier, address, phone, price_range, takeaway, hours)
-- values ('Chez Exemple', 'Créole & Caribéen', 'Gustavia', 'Rue du Bord de Mer',
--         '+590590000000', 2, true,
--         '{"mon":[["11:30","14:30"]],"tue":[["11:30","14:30"],["19:00","22:00"]],
--           "wed":[["11:30","14:30"],["19:00","22:00"]],"thu":[["11:30","14:30"],["19:00","22:00"]],
--           "fri":[["11:30","14:30"],["19:00","22:30"]],"sat":[["19:00","22:30"]]}');
