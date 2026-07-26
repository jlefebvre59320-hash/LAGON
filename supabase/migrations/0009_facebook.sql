-- ============================================================
-- St Barth Food — Lien Facebook sur les fiches
-- Troisième canal des établissements de l'île, avec le site et
-- Instagram. Idempotent.
-- ============================================================

alter table public.restaurants add column if not exists facebook text;

-- Repris de l'export OpenStreetMap (les deux seuls renseignés) :
update public.restaurants set facebook = 'https://www.facebook.com/sayolita.saintbarthelemy/'
  where name = 'Sayolita Bar' and facebook is null;
update public.restaurants set facebook = 'https://www.facebook.com/lebouchon97133/'
  where name = 'Le bouchon' and facebook is null;
