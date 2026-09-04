-- Le strict nécessaire pour rejouer les migrations 0032 → 0036 hors
-- Supabase : le schéma auth, les rôles, et les tables des migrations
-- antérieures réduites aux colonnes que ces migrations touchent.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
  end if;
end $$;

create schema if not exists auth;
create table auth.users (id uuid primary key, email text, created_at timestamptz default now());
-- auth.uid() lit une variable de session : set app.uid = '<uuid>' joue un utilisateur.
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('app.uid', true), '')::uuid $$;

create table public.profiles (
  id uuid primary key references auth.users(id), display_name text, phone_wa text,
  is_pro boolean default false, is_admin boolean default false, is_banned boolean default false,
  created_at timestamptz default now(), allow_messages boolean default true,
  notify_email boolean default true, notify_push boolean default true,
  quartier text, rating_avg numeric, rating_count int default 0
);
create or replace function public.is_admin() returns boolean language sql stable security definer as
  $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

create type listing_module as enum ('vehicle', 'housing', 'job', 'goods', 'service');
create type listing_status as enum ('active', 'sold', 'expired', 'removed');

create table public.listings (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id),
  module listing_module not null, subcategory text not null, intent text not null default 'offer',
  status listing_status not null default 'active', title text not null, description text default '',
  price_cents int, location text, attrs jsonb default '{}', featured_until timestamptz,
  created_at timestamptz default now(), sold_at timestamptz,
  search_tsv tsvector generated always as (to_tsvector('french', coalesce(title, '') || ' ' || coalesce(description, ''))) stored
);
alter table public.listings enable row level security;
create policy "listings_select_public" on public.listings for select using (true);

create table public.listing_photos (
  id uuid primary key default gen_random_uuid(), listing_id uuid references public.listings(id) on delete cascade,
  storage_key text, position int default 0
);
create table public.reports (
  id uuid primary key default gen_random_uuid(), listing_id uuid references public.listings(id) on delete cascade,
  reporter_id uuid, reason text, handled boolean default false, created_at timestamptz default now()
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(), listing_id uuid, buyer_id uuid, seller_id uuid,
  last_message_at timestamptz default now()
);
create table public.messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid references public.conversations(id),
  sender_id uuid, body text not null, created_at timestamptz default now()
);
create table public.ratings (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade,
  rater_id uuid not null, rated_id uuid not null, stars smallint not null check (stars between 1 and 5),
  comment text, hidden boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.push_subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid, endpoint text, p256dh text, auth text);
