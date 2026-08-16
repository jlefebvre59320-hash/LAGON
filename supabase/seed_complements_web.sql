-- ============================================================
-- Complément de recherche web profonde — 2026-08-16.
-- 1) Restaurants absents de l'import OSM (grandes tables d'hôtels,
--    beach clubs) avec leurs contacts publics
-- 2) Contacts des lieux publics du Guide
-- 3) Nouvelles associations vérifiées
-- À passer APRÈS 0016 (colonnes) et 0017 (table places).
-- Ré-exécutable : n'insère jamais deux fois, ne remplit que le vide.
-- ============================================================

-- ---------- 1. Nouveaux restaurants ----------

insert into public.restaurants
  (name, cuisine, quartier, address, phone, instagram, facebook, website, email, price_range, takeaway, hours)
select 'Gyp Sea Beach Club', 'Poissons & Fruits de mer', 'Flamands', '', '+590590633301', null, null, 'https://www.gypsea-stbarth.com', null, 3, false, '{}'::jsonb
where not exists (select 1 from public.restaurants r where r.name = 'Gyp Sea Beach Club' and r.quartier = 'Flamands');

insert into public.restaurants
  (name, cuisine, quartier, address, phone, instagram, facebook, website, email, price_range, takeaway, hours)
select 'Le Toiny Beach Club', 'Français', 'Toiny', '', '+590590529000', null, null, 'https://letoiny.com/the-restaurants/', null, 3, false, '{}'::jsonb
where not exists (select 1 from public.restaurants r where r.name = 'Le Toiny Beach Club' and r.quartier = 'Toiny');

insert into public.restaurants
  (name, cuisine, quartier, address, phone, instagram, facebook, website, email, price_range, takeaway, hours)
select 'Amis Plage', 'Français', 'Grand Cul-de-Sac', '', '+590590775116', null, null, null, null, 3, false, '{}'::jsonb
where not exists (select 1 from public.restaurants r where r.name = 'Amis Plage' and r.quartier = 'Grand Cul-de-Sac');

insert into public.restaurants
  (name, cuisine, quartier, address, phone, instagram, facebook, website, email, price_range, takeaway, hours)
select 'Pearl Beach', 'Français', 'St-Jean', '', '+590590528133', null, 'https://www.facebook.com/PearlBeachStBarth/', 'https://www.pearlbeachstbarth.com', 'restaurant@pearlbeachstbarth.com', 3, false, '{}'::jsonb
where not exists (select 1 from public.restaurants r where r.name = 'Pearl Beach' and r.quartier = 'St-Jean');

insert into public.restaurants
  (name, cuisine, quartier, address, phone, instagram, facebook, website, email, price_range, takeaway, hours)
select 'Mamo', 'Italien', 'Gustavia', '', '+590590520202', null, 'https://www.facebook.com/p/Mamo-St-Barth-61566442440893/', null, 'reservations@mamo-stbarth.com', 3, false, '{}'::jsonb
where not exists (select 1 from public.restaurants r where r.name = 'Mamo' and r.quartier = 'Gustavia');

insert into public.restaurants
  (name, cuisine, quartier, address, phone, instagram, facebook, website, email, price_range, takeaway, hours)
select 'Mango Beach Club', 'Français', 'Pointe Milou', '', '+590590276363', null, 'https://www.facebook.com/hotelchristopherstbarth/', 'https://www.hotelchristopher.com', null, 3, false, '{}'::jsonb
where not exists (select 1 from public.restaurants r where r.name = 'Mango Beach Club' and r.quartier = 'Pointe Milou');

insert into public.restaurants
  (name, cuisine, quartier, address, phone, instagram, facebook, website, email, price_range, takeaway, hours)
select 'La Case — Cheval Blanc', 'Français', 'Flamands', '', null, null, null, 'https://www.chevalblanc.com/en/maison/st-barth/restaurants-and-bars/', null, 3, false, '{}'::jsonb
where not exists (select 1 from public.restaurants r where r.name = 'La Case — Cheval Blanc' and r.quartier = 'Flamands');

insert into public.restaurants
  (name, cuisine, quartier, address, phone, instagram, facebook, website, email, price_range, takeaway, hours)
select 'Sand Bar — Eden Rock', 'Français', 'St-Jean', '', '+590590297999', null, null, 'https://www.oetkerhotels.com/hotels/eden-rock-st-barths/restaurants-bars/', null, 3, false, '{}'::jsonb
where not exists (select 1 from public.restaurants r where r.name = 'Sand Bar — Eden Rock' and r.quartier = 'St-Jean');

insert into public.restaurants
  (name, cuisine, quartier, address, phone, instagram, facebook, website, email, price_range, takeaway, hours)
select 'Al Mare — Le Sereno', 'Italien', 'Grand Cul-de-Sac', '', '+590590298354', null, 'https://www.facebook.com/leserenoalmare/', 'https://www.serenohotels.com/property/le-sereno/restaurant-in-st-barths/', null, 3, false, '{}'::jsonb
where not exists (select 1 from public.restaurants r where r.name = 'Al Mare — Le Sereno' and r.quartier = 'Grand Cul-de-Sac');

insert into public.restaurants
  (name, cuisine, quartier, address, phone, instagram, facebook, website, email, price_range, takeaway, hours)
select 'Beach House — Rosewood Le Guanahani', 'Français', 'Grand Cul-de-Sac', '', null, null, null, 'https://www.rosewoodhotels.com/fr/le-guanahani/dining/beach-house', null, 3, false, '{}'::jsonb
where not exists (select 1 from public.restaurants r where r.name = 'Beach House — Rosewood Le Guanahani' and r.quartier = 'Grand Cul-de-Sac');

insert into public.restaurants
  (name, cuisine, quartier, address, phone, instagram, facebook, website, email, price_range, takeaway, hours)
select 'Le Manapany', 'Français', 'Anse des Cayes', '', '+590590276655', null, 'https://www.facebook.com/HotelManapany/', null, null, 3, false, '{}'::jsonb
where not exists (select 1 from public.restaurants r where r.name = 'Le Manapany' and r.quartier = 'Anse des Cayes');

insert into public.restaurants
  (name, cuisine, quartier, address, phone, instagram, facebook, website, email, price_range, takeaway, hours)
select 'Kiki-é Mo', 'Italien', 'St-Jean', '', '+590590279065', null, 'https://www.facebook.com/kikiemo.stbarth/', 'https://kikiemo.com', 'eat@kikiemo.com', 2, true, '{}'::jsonb
where not exists (select 1 from public.restaurants r where r.name = 'Kiki-é Mo' and r.quartier = 'St-Jean');

insert into public.restaurants
  (name, cuisine, quartier, address, phone, instagram, facebook, website, email, price_range, takeaway, hours)
select 'ITA St Barths', 'Tapas & Cocktails', 'Gustavia', '', '+590590776886', null, 'https://www.facebook.com/itamykonos/', 'https://www.sevenrooms.com/reservations/itastbarth/website', null, 3, false, '{}'::jsonb
where not exists (select 1 from public.restaurants r where r.name = 'ITA St Barths' and r.quartier = 'Gustavia');

insert into public.restaurants
  (name, cuisine, quartier, address, phone, instagram, facebook, website, email, price_range, takeaway, hours)
select 'L''Entracte', 'Pizza', 'Gustavia', '', '+590590277011', null, null, null, null, 2, false, '{}'::jsonb
where not exists (select 1 from public.restaurants r where r.name = 'L''Entracte' and r.quartier = 'Gustavia');

insert into public.restaurants
  (name, cuisine, quartier, address, phone, instagram, facebook, website, email, price_range, takeaway, hours)
select 'La Gloriette', 'Créole & Caribéen', 'Grand Cul-de-Sac', '', null, null, null, 'https://www.rhum-lagloriette.com', null, 2, false, '{}'::jsonb
where not exists (select 1 from public.restaurants r where r.name = 'La Gloriette' and r.quartier = 'Grand Cul-de-Sac');

-- Wishing Well (Flamands) est le snack créole de Chez Rolande : mêmes coordonnées.
update public.restaurants set
  phone = coalesce(phone, '+590590275142'),
  email = coalesce(email, 'chezrolande@hotmail.fr'),
  cuisine = case when cuisine = 'À classer' then 'Créole & Caribéen' else cuisine end
  where name = 'Wishing Well' and quartier = 'Flamands';

-- ---------- 2. Contacts des lieux publics du Guide ----------
update public.places set phone = coalesce(phone, '+590590298040'), website = coalesce(website, 'https://www.comstbarth.fr')
  where name = 'Hôtel de la Collectivité' and quartier = 'Gustavia';
update public.places set phone = coalesce(phone, '+590590278727'), website = coalesce(website, 'https://www.saintbarth-tourisme.com')
  where name = 'Office de tourisme' and quartier = 'Gustavia';
update public.places set phone = coalesce(phone, '+590590276035')
  where name = 'Hôpital Irénée de Bruyn' and quartier = 'Gustavia';
update public.places set phone = coalesce(phone, '+590590276697'), website = coalesce(website, 'https://portdegustavia.fr')
  where name = 'Capitainerie du port de Gustavia' and quartier = 'Gustavia';
update public.places set website = coalesce(website, 'https://www.agencedelenvironnement.fr')
  where name = 'Agence Territoriale de l''Environnement — Réserve naturelle' and quartier = 'Gustavia';

-- ---------- 3. Nouvelles associations (vérifiées) ----------
insert into public.places (category, name, quartier, description, tip, phone, website) values
('association', 'Lions Club de Saint-Barthélemy', 'Gustavia',
 'Club service actif sur l''île depuis plus de quarante ans : actions caritatives, collectes et solidarité.',
 null, '+590690658007', null),
('association', 'SNSM — Les Sauveteurs en Mer', 'Gustavia',
 'La station de sauvetage en mer bénévole du port de Gustavia : interventions, prévention et formation.',
 'En mer, l''alerte passe par le CROSS : composez le 196.', null, 'https://www.snsm.org'),
('association', 'Comité Territorial de Football de Saint-Barthélemy', 'St-Jean',
 'Le football de l''île : championnat local, équipes de jeunes, matchs au stade de Saint-Jean.',
 null, null, null)
on conflict (name, quartier) do nothing;
