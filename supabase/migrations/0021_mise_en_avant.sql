-- ============================================================
-- 0021 — Mise en avant des annonces.
--
-- Une annonce mise en avant se distingue visuellement, remonte en tête
-- de l'accueil et des recherches, et accepte 10 photos au lieu de 3.
--
-- La facturation n'est pas encore en place : pendant la phase de test,
-- tout compte peut activer la mise en avant sur ses propres annonces.
-- Le jour où le paiement arrive, il suffira de remplacer la policy
-- d'écriture ci-dessous par une vérification d'abonnement — la colonne,
-- l'affichage et les tris resteront tels quels.
-- ============================================================

-- Une date de fin plutôt qu'un booléen : la mise en avant est par nature
-- temporaire, et une date permet de la laisser expirer toute seule sans
-- tâche de nettoyage.
alter table public.listings add column if not exists featured_until timestamptz;

-- Index partiel : seules les annonces en cours de mise en avant sont
-- interrogées pour le bandeau « à la une ».
create index if not exists idx_listings_featured
  on public.listings (featured_until desc)
  where featured_until is not null;

comment on column public.listings.featured_until is
  'Fin de la mise en avant. NULL ou date passée = annonce ordinaire. '
  'Gratuit pendant la phase de test ; à restreindre quand la facturation arrivera.';
