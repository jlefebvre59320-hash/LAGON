-- ============================================================
-- Vérification de 0019_security_hardening.sql
--
-- À coller dans Supabase → SQL Editor → Run.
-- Ne modifie rien : que des lectures du catalogue Postgres.
--
-- Les repères sont pris du début à la toute fin de la migration.
-- Si la dernière ligne (n° 15) est OK, la migration est passée en entier.
-- Si tout est OK sauf la 4 (grants colonne sur listings), il manque
-- 0022_grant_featured.sql.
-- ============================================================

with reperes as (
  select 1 as n, 'Fonction current_user_is_banned()' as verification,
         exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                  where ns.nspname = 'public' and p.proname = 'current_user_is_banned') as ok
  union all
  select 2, 'profiles : is_admin NON modifiable par les utilisateurs',
         not exists (select 1 from information_schema.column_privileges
                      where table_schema = 'public' and table_name = 'profiles'
                        and column_name = 'is_admin' and grantee = 'authenticated'
                        and privilege_type = 'UPDATE')
  union all
  select 3, 'Contrainte profiles_phone_e164',
         exists (select 1 from pg_constraint where conname = 'profiles_phone_e164')
  union all
  select 4, 'listings : privilèges colonne par colonne actifs',
         exists (select 1 from information_schema.column_privileges
                  where table_schema = 'public' and table_name = 'listings'
                    and column_name = 'title' and grantee = 'authenticated'
                    and privilege_type = 'INSERT')
  union all
  select 5, 'listings : user_id NON modifiable (pas de vol d''annonce)',
         not exists (select 1 from information_schema.column_privileges
                      where table_schema = 'public' and table_name = 'listings'
                        and column_name = 'user_id' and grantee = 'authenticated'
                        and privilege_type = 'UPDATE')
  union all
  select 6, 'Contrainte listings_attrs_object',
         exists (select 1 from pg_constraint where conname = 'listings_attrs_object')
  union all
  select 7, 'Trigger listings_quota (anti-spam d''annonces)',
         exists (select 1 from pg_trigger where tgname = 'listings_quota' and not tgisinternal)
  union all
  select 8, 'Contrainte restaurants_website_http',
         exists (select 1 from pg_constraint where conname = 'restaurants_website_http')
  union all
  select 9, 'Trigger reports_no_duplicate (anti-signalement en boucle)',
         exists (select 1 from pg_trigger where tgname = 'reports_no_duplicate' and not tgisinternal)
  union all
  select 10, 'Trigger events_submission_quota',
         exists (select 1 from pg_trigger where tgname = 'events_submission_quota' and not tgisinternal)
  union all
  select 11, 'Fonction admin_pending_events()',
         exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                  where ns.nspname = 'public' and p.proname = 'admin_pending_events')
  union all
  select 12, 'Fonction record_page_view() (compteur de visites)',
         exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                  where ns.nspname = 'public' and p.proname = 'record_page_view')
  union all
  select 13, 'Fonction can_upload_listing_photo() (quota de photos)',
         exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                  where ns.nspname = 'public' and p.proname = 'can_upload_listing_photo')
  union all
  select 14, 'Policy storage photos_bucket_insert',
         exists (select 1 from pg_policies
                  where schemaname = 'storage' and tablename = 'objects'
                    and policyname = 'photos_bucket_insert')
  union all
  select 15, 'DERNIÈRE LIGNE : fonction purge_expired_operational_data()',
         exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                  where ns.nspname = 'public' and p.proname = 'purge_expired_operational_data')
)
select n,
       case when ok then '✅ OK' else '❌ MANQUANT' end as resultat,
       verification
  from reperes
 order by n;
