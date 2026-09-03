-- ============================================================
-- 0030 — Un univers « Services » à part entière.
--
-- Les services vivaient dans « Emploi & Services », noyés entre les
-- offres d'emploi et les candidatures. Sur une île où l'on cherche un
-- plombier, une femme de ménage ou un mécano bateau plus souvent qu'un
-- CDI, ils méritent leur propre entrée — et surtout leurs propres
-- critères : zone d'intervention, tarification, disponibilité.
--
-- ⚠️ À EXÉCUTER SEUL, avant tout le reste.
--
-- PostgreSQL refuse qu'une valeur ajoutée à un type enum soit utilisée
-- dans la transaction qui l'ajoute. L'éditeur SQL de Supabase exécute
-- tout d'un bloc : cette migration ne fait donc QUE déclarer la valeur,
-- sans jamais s'en servir. Les sous-catégories et les critères sont du
-- code, pas du SQL — rien d'autre à passer ensuite.
-- ============================================================

alter type listing_module add value if not exists 'service';

-- Les nouveaux filtres interrogent le contenu de attrs (zone
-- d'intervention, tarification). Un index GIN rend ces recherches
-- immédiates au lieu de parcourir toutes les annonces.
create index if not exists idx_listings_attrs on public.listings using gin (attrs);

-- Vérification : doit lister les cinq univers, dont 'service'.
-- select unnest(enum_range(null::listing_module));
