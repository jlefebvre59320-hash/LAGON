-- ============================================================
-- 0039 — Un sixième univers : Jardin & Outillage.
--
-- Tondeuses, tronçonneuses, outillage, plantes, arrosage, barbecue,
-- location de matériel : jusqu'ici dispersés dans « Achats & Ventes »,
-- où personne ne les cherchait. Les catégories, les champs et la
-- couleur vivent dans le code (src/lib/taxonomy.ts) ; la base n'a
-- besoin que de la valeur du type.
--
-- À EXÉCUTER SEUL, dans sa propre exécution du SQL Editor : Postgres
-- refuse d'utiliser une valeur d'enum ajoutée dans la même transaction.
-- Le déplacement des annonces existantes est dans 0040, pour cette raison.
-- ============================================================

alter type listing_module add value if not exists 'garden';

-- Vérification : doit lister les six univers, dont 'garden'.
-- select unnest(enum_range(null::listing_module));
