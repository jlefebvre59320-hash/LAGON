-- ============================================================
-- St Barth Food — Prix moyen par personne
-- Plus parlant que €/€€/€€€ quand l'établissement le renseigne.
-- Idempotent.
-- ============================================================

alter table public.restaurants
  add column if not exists avg_price_eur smallint
  check (avg_price_eur is null or avg_price_eur between 1 and 500);
