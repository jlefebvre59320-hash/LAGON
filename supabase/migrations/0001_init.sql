-- ============================================================
-- LAGON — Petites annonces Saint-Barthélemy
-- Migration initiale : schéma, index, RLS, stockage photos
-- À exécuter dans le SQL Editor Supabase (ou supabase db push)
-- ============================================================

-- ---------- Types ----------
create type listing_module as enum ('vehicle', 'housing', 'job', 'goods');
create type listing_status as enum ('active', 'sold', 'expired', 'removed');

-- ---------- Profils (extension de auth.users) ----------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default 'Utilisateur',
  phone_wa      text,                       -- numéro WhatsApp E.164, ex +590690XXXXXX
  is_pro        boolean not null default false,
  is_banned     boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), 'Utilisateur'));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Annonces ----------
create table public.listings (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id),
  module         listing_module not null,
  subcategory    text not null,
  status         listing_status not null default 'active',
  title          text not null check (char_length(title) between 3 and 100),
  description    text not null default '' check (char_length(description) <= 5000),
  price_cents    integer check (price_cents >= 0),   -- null = "selon profil" / à discuter
  location       text not null default 'Saint-Barthélemy',
  attrs          jsonb not null default '{}',
  search_tsv     tsvector generated always as (
                   to_tsvector('french',
                     coalesce(title,'') || ' ' || coalesce(description,'') || ' ' ||
                     coalesce(subcategory,'') || ' ' || coalesce(location,''))
                 ) stored,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '60 days',
  removed_reason text
);

create index idx_listings_browse on public.listings (module, status, created_at desc);
create index idx_listings_sub    on public.listings (module, subcategory, status, created_at desc);
create index idx_listings_search on public.listings using gin (search_tsv);
create index idx_listings_attrs  on public.listings using gin (attrs);
create index idx_listings_owner  on public.listings (user_id, created_at desc);

-- ---------- Photos ----------
create table public.listing_photos (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings(id) on delete cascade,
  storage_key text not null,       -- chemin dans le bucket 'photos'
  position    smallint not null default 0,
  created_at  timestamptz not null default now()
);

create index idx_photos_listing on public.listing_photos (listing_id, position);

-- ---------- Signalements ----------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid references public.profiles(id),
  reason      text not null check (char_length(reason) between 3 and 500),
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.profiles       enable row level security;
alter table public.listings       enable row level security;
alter table public.listing_photos enable row level security;
alter table public.reports        enable row level security;

-- Profils : lecture publique (nom affiché), écriture par soi-même
create policy "profiles_select" on public.profiles
  for select using (true);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Annonces : les actives sont publiques, le propriétaire voit et gère les siennes
create policy "listings_select_active" on public.listings
  for select using (status = 'active' or auth.uid() = user_id);
create policy "listings_insert_own" on public.listings
  for insert with check (
    auth.uid() = user_id
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_banned)
  );
create policy "listings_update_own" on public.listings
  for update using (auth.uid() = user_id);
create policy "listings_delete_own" on public.listings
  for delete using (auth.uid() = user_id);

-- Photos : visibles si l'annonce est visible, gérées par le propriétaire
create policy "photos_select" on public.listing_photos
  for select using (
    exists (select 1 from public.listings l
            where l.id = listing_id and (l.status = 'active' or l.user_id = auth.uid()))
  );
create policy "photos_insert_own" on public.listing_photos
  for insert with check (
    exists (select 1 from public.listings l
            where l.id = listing_id and l.user_id = auth.uid())
  );
create policy "photos_delete_own" on public.listing_photos
  for delete using (
    exists (select 1 from public.listings l
            where l.id = listing_id and l.user_id = auth.uid())
  );

-- Signalements : tout utilisateur connecté peut signaler, personne ne lit (admin via service role)
create policy "reports_insert_auth" on public.reports
  for insert with check (auth.uid() is not null);

-- ---------- Anti-spam basique : 10 annonces actives max par utilisateur ----------
create or replace function public.check_listing_quota()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.listings
      where user_id = new.user_id and status = 'active') >= 10 then
    raise exception 'Quota atteint : 10 annonces actives maximum.';
  end if;
  return new;
end; $$;

create trigger listings_quota before insert on public.listings
  for each row execute function public.check_listing_quota();

-- ---------- Stockage photos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "photos_bucket_read" on storage.objects
  for select using (bucket_id = 'photos');
create policy "photos_bucket_insert" on storage.objects
  for insert with check (
    bucket_id = 'photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text  -- chacun écrit dans son dossier
  );
create policy "photos_bucket_delete" on storage.objects
  for delete using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- Expiration automatique (à brancher sur pg_cron si dispo) ----------
-- select cron.schedule('expire-listings', '0 3 * * *',
--   $$update public.listings set status = 'expired'
--     where status = 'active' and expires_at < now()$$);
