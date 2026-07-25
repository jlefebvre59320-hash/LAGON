-- ============================================================
-- Ti Kanal — Sens de l'annonce : proposition ou recherche
-- « Je vends une voiture » vs « Je recherche une voiture ».
-- Idempotent : rejouable sur un projet où 0001/0002 sont déjà passés.
-- ============================================================

-- create type n'accepte pas "if not exists" : on avale l'erreur de doublon.
do $$
begin
  create type listing_intent as enum ('offer', 'wanted');
exception
  when duplicate_object then null;
end $$;

-- Les annonces existantes sont toutes des propositions : 'offer' par défaut.
alter table public.listings
  add column if not exists intent listing_intent not null default 'offer';

-- Parcours type : un univers, un sens, les plus récentes d'abord.
create index if not exists idx_listings_intent
  on public.listings (module, intent, status, created_at desc);
