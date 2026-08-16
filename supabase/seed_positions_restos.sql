-- ============================================================
-- Positions indicatives des 15 restaurants ajoutés par la recherche
-- web (emplacements connus des hôtels et plages — à affiner fiche
-- par fiche). Ne touche que les fiches sans position. Ré-exécutable.
-- ============================================================

update public.restaurants set lat = 17.9182, lng = -62.8585 where name = 'Gyp Sea Beach Club' and quartier = 'Flamands' and lat is null;
update public.restaurants set lat = 17.8940, lng = -62.7900 where name = 'Le Toiny Beach Club' and quartier = 'Toiny' and lat is null;
update public.restaurants set lat = 17.9095, lng = -62.7975 where name = 'Amis Plage' and quartier = 'Grand Cul-de-Sac' and lat is null;
update public.restaurants set lat = 17.9040, lng = -62.8385 where name = 'Pearl Beach' and quartier = 'St-Jean' and lat is null;
update public.restaurants set lat = 17.8962, lng = -62.8505 where name = 'Mamo' and quartier = 'Gustavia' and lat is null;
update public.restaurants set lat = 17.9135, lng = -62.8160 where name = 'Mango Beach Club' and quartier = 'Pointe Milou' and lat is null;
update public.restaurants set lat = 17.9178, lng = -62.8620 where name = 'La Case — Cheval Blanc' and quartier = 'Flamands' and lat is null;
update public.restaurants set lat = 17.9022, lng = -62.8355 where name = 'Sand Bar — Eden Rock' and quartier = 'St-Jean' and lat is null;
update public.restaurants set lat = 17.9085, lng = -62.7935 where name = 'Al Mare — Le Sereno' and quartier = 'Grand Cul-de-Sac' and lat is null;
update public.restaurants set lat = 17.9070, lng = -62.7920 where name = 'Beach House — Rosewood Le Guanahani' and quartier = 'Grand Cul-de-Sac' and lat is null;
update public.restaurants set lat = 17.9125, lng = -62.8470 where name = 'Le Manapany' and quartier = 'Anse des Cayes' and lat is null;
update public.restaurants set lat = 17.9030, lng = -62.8345 where name = 'Kiki-é Mo' and quartier = 'St-Jean' and lat is null;
update public.restaurants set lat = 17.8965, lng = -62.8495 where name = 'ITA St Barths' and quartier = 'Gustavia' and lat is null;
update public.restaurants set lat = 17.8963, lng = -62.8497 where name = 'L''Entracte' and quartier = 'Gustavia' and lat is null;
update public.restaurants set lat = 17.9100, lng = -62.7965 where name = 'La Gloriette' and quartier = 'Grand Cul-de-Sac' and lat is null;
