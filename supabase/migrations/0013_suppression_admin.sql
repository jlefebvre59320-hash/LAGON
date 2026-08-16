-- ============================================================
-- 0013 — L'admin peut supprimer définitivement n'importe quelle annonce.
--
-- Les lignes liées (photos, favoris, signalements, vues) partent par
-- cascade de clé étrangère. Les fichiers du bucket 'photos' sont retirés
-- par l'interface juste après — d'où la seconde policy, sans laquelle le
-- storage n'autorise que le propriétaire du dossier.
-- ============================================================

drop policy if exists "listings_delete_admin" on public.listings;
create policy "listings_delete_admin" on public.listings
  for delete using (public.is_admin());

drop policy if exists "photos_bucket_delete_admin" on storage.objects;
create policy "photos_bucket_delete_admin" on storage.objects
  for delete using (bucket_id = 'photos' and public.is_admin());
