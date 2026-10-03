-- Le strict nécessaire pour rejouer les migrations 0032 → 0040 hors
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
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null, seller_id uuid not null,
  created_at timestamptz default now(), last_message_at timestamptz default now(),
  buyer_read_at timestamptz, seller_read_at timestamptz, buyer_notified_at timestamptz, seller_notified_at timestamptz,
  constraint conversations_deux_personnes check (buyer_id <> seller_id)
);
create unique index uq_conversations_listing_buyer on public.conversations (listing_id, buyer_id);
-- 0028 : blocage entre deux personnes (mes_conversations et destinataire_a_prevenir le lisent).
create table public.blocked_users (blocker_id uuid, blocked_id uuid);
create or replace function public.blocage_entre(a uuid, b uuid) returns boolean language sql stable as
  $$ select exists (select 1 from public.blocked_users where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)) $$;
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
alter table auth.users add column if not exists last_sign_in_at timestamptz;
create table public.page_views (
  id bigint generated always as identity primary key, path text not null, listing_id uuid references public.listings(id) on delete cascade,
  viewer_key text, device text, source text, created_at timestamptz not null default now()
);
create table public.favorites (user_id uuid, listing_id uuid, created_at timestamptz default now());
-- site_stats et admin_dashboard (0038) lisent aussi ces tables.
create table public.feedback (
  id uuid primary key default gen_random_uuid(), kind text not null check (kind in ('idee', 'probleme', 'avis')),
  message text not null check (char_length(message) between 3 and 2000), contact text,
  user_id uuid references public.profiles(id) on delete set null,
  handled boolean default false, created_at timestamptz default now()
);
create table public.restaurant_claims (id uuid primary key default gen_random_uuid(), handled boolean default false, created_at timestamptz default now());
create table public.events (id uuid primary key default gen_random_uuid(), title text, status text, starts_at timestamptz, ends_at timestamptz);
create table public.places (id uuid primary key default gen_random_uuid(), name text, status text);
create table public.restaurants (id uuid primary key default gen_random_uuid(), name text, status text);
