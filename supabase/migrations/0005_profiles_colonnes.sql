-- ============================================================
-- Ti Kanal — Fermer réellement la lecture de profiles.is_admin
-- ============================================================
-- La migration 0004 faisait « revoke select (is_admin) », ce qui n'a aucun
-- effet : sous Supabase, anon et authenticated détiennent le SELECT sur toute
-- la table, et un revoke de colonne ne retire pas un privilège de table.
-- Il faut retirer le privilège de table, puis le regranter colonne par colonne.
--
-- is_banned reste lisible volontairement : la policy listings_insert_own la
-- consulte, et une expression de policy s'évalue avec les privilèges de
-- l'appelant. La masquer empêcherait tout le monde de publier.

revoke select on public.profiles from anon, authenticated;

grant select (id, display_name, phone_wa, is_pro, is_banned, created_at)
  on public.profiles to anon, authenticated;
