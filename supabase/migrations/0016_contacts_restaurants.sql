-- ============================================================
-- 0016 — Contacts élargis sur les fiches restaurants.
--
-- Snapchat, TikTok et email rejoignent téléphone, WhatsApp, Instagram,
-- Facebook et site web. Et on rattrape les deux pages Facebook présentes
-- dans l'export OpenStreetMap d'origine mais jamais importées (la colonne
-- facebook n'existait pas encore au moment de l'import).
-- ============================================================

alter table public.restaurants add column if not exists snapchat text;
alter table public.restaurants add column if not exists tiktok   text;
alter table public.restaurants add column if not exists email    text;

update public.restaurants
  set facebook = 'https://www.facebook.com/sayolita.saintbarthelemy/'
  where name = 'Sayolita Bar' and facebook is null;

update public.restaurants
  set facebook = 'https://www.facebook.com/lebouchon97133/'
  where name = 'Le bouchon' and facebook is null;
