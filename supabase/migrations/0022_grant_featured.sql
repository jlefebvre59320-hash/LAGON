-- ============================================================
-- 0022 — Autoriser l'écriture de featured_until.
--
-- La migration 0019 de durcissement a remplacé les privilèges de table
-- par des privilèges colonne par colonne sur listings. featured_until
-- n'existait pas encore : elle est donc absente de ces listes, et toute
-- écriture la mentionnant échoue avec « permission denied for table
-- listings » — un refus de privilège, pas de RLS, d'où le message
-- déroutant.
--
-- À retenir pour la suite : depuis 0019, toute nouvelle colonne
-- écrivable par les utilisateurs doit être ajoutée ici explicitement.
-- ============================================================

grant insert (featured_until) on public.listings to authenticated;
grant update (featured_until) on public.listings to authenticated;

-- Vérification : doit lister featured_until pour INSERT et UPDATE.
-- select privilege_type, column_name
--   from information_schema.column_privileges
--  where table_name = 'listings' and grantee = 'authenticated'
--    and column_name = 'featured_until';
