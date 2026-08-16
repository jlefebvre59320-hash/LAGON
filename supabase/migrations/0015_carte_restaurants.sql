-- ============================================================
-- 0015 — Coordonnées GPS des restaurants (pour la carte).
--
-- Les positions viennent de l'export OpenStreetMap d'origine (ODbL) ;
-- elles avaient servi à déduire les quartiers mais n'avaient pas été
-- conservées. La correspondance se fait sur (name, quartier), le couple
-- unique de la base. Les fiches créées à la main restent sans position
-- tant que leur propriétaire n'en renseigne pas une.
-- ============================================================

alter table public.restaurants add column if not exists lat double precision;
alter table public.restaurants add column if not exists lng double precision;

update public.restaurants set lat = 17.912175, lng = -62.846658 where name = 'Chez Yvon' and quartier = 'Anse des Cayes';
update public.restaurants set lat = 17.912512, lng = -62.846556 where name = 'Lavazza' and quartier = 'Anse des Cayes';
update public.restaurants set lat = 17.911103, lng = -62.844091 where name = 'Ristorante Fellini' and quartier = 'Anse des Cayes';
update public.restaurants set lat = 17.911596, lng = -62.853187 where name = 'Les Bananiers' and quartier = 'Colombier';
update public.restaurants set lat = 17.909249, lng = -62.854874 where name = 'JPizza (La Saintoise)' and quartier = 'Corossol';
update public.restaurants set lat = 17.908512, lng = -62.854076 where name = 'Nyama' and quartier = 'Corossol';
update public.restaurants set lat = 17.918511, lng = -62.857213 where name = 'La Langouste' and quartier = 'Flamands';
update public.restaurants set lat = 17.918053, lng = -62.856579 where name = 'Wishing Well' and quartier = 'Flamands';
update public.restaurants set lat = 17.895171, lng = -62.849283 where name = 'Bagatelle' and quartier = 'Gustavia';
update public.restaurants set lat = 17.896591, lng = -62.848232 where name = 'Bart''s Food Lounge' and quartier = 'Gustavia';
update public.restaurants set lat = 17.895128, lng = -62.849507 where name = 'Baz Bar (Le Bête à Z''Ailes)' and quartier = 'Gustavia';
update public.restaurants set lat = 17.895996, lng = -62.847959 where name = 'Black Ginger' and quartier = 'Gustavia';
update public.restaurants set lat = 17.895629, lng = -62.847628 where name = 'Bonito' and quartier = 'Gustavia';
update public.restaurants set lat = 17.894582, lng = -62.850066 where name = 'Burger Palace' and quartier = 'Gustavia';
update public.restaurants set lat = 17.896025, lng = -62.848281 where name = 'Eddy''s' and quartier = 'Gustavia';
update public.restaurants set lat = 17.897709, lng = -62.849314 where name = 'FishCorner' and quartier = 'Gustavia';
update public.restaurants set lat = 17.898067, lng = -62.849413 where name = 'L''Isoletta' and quartier = 'Gustavia';
update public.restaurants set lat = 17.896947, lng = -62.849063 where name = 'La Cantina' and quartier = 'Gustavia';
update public.restaurants set lat = 17.897754, lng = -62.849118 where name = 'La Crêperie' and quartier = 'Gustavia';
update public.restaurants set lat = 17.898068, lng = -62.851831 where name = 'La Guérite' and quartier = 'Gustavia';
update public.restaurants set lat = 17.895924, lng = -62.848641 where name = 'La Petite Plage' and quartier = 'Gustavia';
update public.restaurants set lat = 17.896637, lng = -62.851545 where name = 'La Quintessence' and quartier = 'Gustavia';
update public.restaurants set lat = 17.895838, lng = -62.848136 where name = 'Laventura' and quartier = 'Gustavia';
update public.restaurants set lat = 17.897582, lng = -62.849353 where name = 'Le Bar de L''Oubli' and quartier = 'Gustavia';
update public.restaurants set lat = 17.894488, lng = -62.85009 where name = 'Le Café' and quartier = 'Gustavia';
update public.restaurants set lat = 17.898612, lng = -62.849858 where name = 'Le Carré' and quartier = 'Gustavia';
update public.restaurants set lat = 17.899386, lng = -62.850522 where name = 'Le Petit Deauville' and quartier = 'Gustavia';
update public.restaurants set lat = 17.899234, lng = -62.85043 where name = 'Le Repaire' and quartier = 'Gustavia';
update public.restaurants set lat = 17.897407, lng = -62.849265 where name = 'Le Sélect' and quartier = 'Gustavia';
update public.restaurants set lat = 17.896359, lng = -62.851222 where name = 'Megumi Sushi' and quartier = 'Gustavia';
update public.restaurants set lat = 17.89725, lng = -62.848688 where name = 'Natural Delights' and quartier = 'Gustavia';
update public.restaurants set lat = 17.893968, lng = -62.847001 where name = 'Restaurant Victoria' and quartier = 'Gustavia';
update public.restaurants set lat = 17.896369, lng = -62.84775 where name = 'Ristorante L''Isola' and quartier = 'Gustavia';
update public.restaurants set lat = 17.900516, lng = -62.832496 where name = 'Sayolita Bar' and quartier = 'Gustavia';
update public.restaurants set lat = 17.893174, lng = -62.848622 where name = 'Shellona' and quartier = 'Gustavia';
update public.restaurants set lat = 17.895678, lng = -62.851223 where name = 'Spam To Go' and quartier = 'Gustavia';
update public.restaurants set lat = 17.896635, lng = -62.848272 where name = 'Victoire' and quartier = 'Gustavia';
update public.restaurants set lat = 17.906084, lng = -62.823963 where name = 'Jojo Burger' and quartier = 'Lorient';
update public.restaurants set lat = 17.906748, lng = -62.828485 where name = 'Le bouchon' and quartier = 'Lorient';
update public.restaurants set lat = 17.903461, lng = -62.824398 where name = 'Les Artistes' and quartier = 'Lorient';
update public.restaurants set lat = 17.909604, lng = -62.803354 where name = 'Restaurant O''Corail' and quartier = 'Marigot';
update public.restaurants set lat = 17.913028, lng = -62.81485 where name = 'Le Ti St. Barth' and quartier = 'Pointe Milou';
update public.restaurants set lat = 17.904947, lng = -62.853354 where name = 'Sella' and quartier = 'Public';
update public.restaurants set lat = 17.897897, lng = -62.832767 where name = 'Le Grain de Sel' and quartier = 'Saline';
update public.restaurants set lat = 17.894769, lng = -62.827542 where name = 'Tamarin' and quartier = 'Saline';
update public.restaurants set lat = 17.901445, lng = -62.833724 where name = 'Bio' and quartier = 'St-Jean';
update public.restaurants set lat = 17.903526, lng = -62.843434 where name = 'Lavazza' and quartier = 'St-Jean';
update public.restaurants set lat = 17.900596, lng = -62.832887 where name = 'Le Glacier' and quartier = 'St-Jean';
update public.restaurants set lat = 17.901071, lng = -62.83363 where name = 'Le Piment' and quartier = 'St-Jean';
update public.restaurants set lat = 17.903635, lng = -62.843248 where name = 'Mayas to go' and quartier = 'St-Jean';
update public.restaurants set lat = 17.902496, lng = -62.835192 where name = 'Nikki Beach St-Barth' and quartier = 'St-Jean';
update public.restaurants set lat = 17.899268, lng = -62.838229 where name = 'Restaurant Le Diamant' and quartier = 'St-Jean';
update public.restaurants set lat = 17.901035, lng = -62.833179 where name = 'The Hideaway' and quartier = 'St-Jean';
update public.restaurants set lat = 17.899599, lng = -62.797576 where name = 'Restaurant Le Gaïac' and quartier = 'Toiny';
