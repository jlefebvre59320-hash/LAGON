-- ============================================================
-- Enrichissement des contacts restaurants — recherche web du 2026-08-16.
-- Faits de contact publiés par les établissements eux-mêmes (sites
-- officiels, pages, annuaires locaux). Chaque champ n'est rempli QUE
-- s'il est vide : rien d'existant n'est écrasé. Ré-exécutable.
-- Prérequis : migration 0016 (colonnes facebook/email).
-- ============================================================

update public.restaurants set phone = coalesce(phone, '+590590298681')
  where name = 'Chez Yvon' and quartier = 'Anse des Cayes';
update public.restaurants set phone = coalesce(phone, '+590590297485'), email = coalesce(email, 'cafethein@orange.fr')
  where name = 'Lavazza' and quartier = 'St-Jean';
update public.restaurants set phone = coalesce(phone, '+590590279348'), facebook = coalesce(facebook, 'https://www.facebook.com/lesbananiers/'), email = coalesce(email, 'lesbananiers@orange.fr')
  where name = 'Les Bananiers' and quartier = 'Colombier';
update public.restaurants set phone = coalesce(phone, '+590690861933')
  where name = 'JPizza (La Saintoise)' and quartier = 'Corossol';
update public.restaurants set phone = coalesce(phone, '+590590510005'), website = coalesce(website, 'https://www.lisolastbarth.com'), facebook = coalesce(facebook, 'https://www.facebook.com/isolastbarth/')
  where name = 'Ristorante L''Isola' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590276361'), facebook = coalesce(facebook, 'https://www.facebook.com/p/La-Langouste-100057670590526/'), email = coalesce(email, 'michel.lalangouste@hotmail.fr')
  where name = 'La Langouste' and quartier = 'Flamands';
update public.restaurants set phone = coalesce(phone, '+590590275151'), website = coalesce(website, 'https://bagatelle.com/venues/st-barths'), email = coalesce(email, 'st.barths@bagatelle.com')
  where name = 'Bagatelle' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590297409'), website = coalesce(website, 'https://bazbar.com'), facebook = coalesce(facebook, 'https://www.facebook.com/beteazailes/'), email = coalesce(email, 'info@bazbar.com')
  where name = 'Baz Bar (Le Bête à Z''Ailes)' and quartier = 'Gustavia';
update public.restaurants set website = coalesce(website, 'https://blackgingersbh.com'), facebook = coalesce(facebook, 'https://www.facebook.com/blackgingersbh/')
  where name = 'Black Ginger' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590279696'), website = coalesce(website, 'https://www.bonitosbh.com'), facebook = coalesce(facebook, 'https://www.facebook.com/bonitostbarth/'), email = coalesce(email, 'booking@bonitosbh.com')
  where name = 'Bonito' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590512774'), facebook = coalesce(facebook, 'https://www.facebook.com/BurgerPalaceSbh/')
  where name = 'Burger Palace' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590275417'), website = coalesce(website, 'https://eddysghetto.com'), facebook = coalesce(facebook, 'https://www.facebook.com/EddysGhetto/'), email = coalesce(email, 'eddysghetto@gmail.com')
  where name = 'Eddy''s' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590513633'), website = coalesce(website, 'https://www.fishcornerstbarth.com'), facebook = coalesce(facebook, 'https://www.facebook.com/p/FishCorner-St-Barth-100063456613873/')
  where name = 'FishCorner' and quartier = 'Gustavia';
update public.restaurants set website = coalesce(website, 'https://www.isolettastbarth.com'), facebook = coalesce(facebook, 'https://www.facebook.com/lisolettastbarths/')
  where name = 'L''Isoletta' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590275566'), facebook = coalesce(facebook, 'https://www.facebook.com/p/La-Cantina-100054676034528/'), email = coalesce(email, 'cantinasbh@gmail.com')
  where name = 'La Cantina' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590278407'), website = coalesce(website, 'https://creperiestbarth.com'), facebook = coalesce(facebook, 'https://www.facebook.com/lacreperie.saintbarthelemy/')
  where name = 'La Crêperie' and quartier = 'Gustavia';
update public.restaurants set website = coalesce(website, 'https://www.sevenrooms.com/reservations/lagueritedb')
  where name = 'La Guérite' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590777359'), website = coalesce(website, 'https://www.restaurant-lapetiteplage.com/saint-barthelemy')
  where name = 'La Petite Plage' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590277006'), website = coalesce(website, 'https://www.bardeloubli.com'), facebook = coalesce(facebook, 'https://www.facebook.com/lebardeloubli/')
  where name = 'Le Bar de L''Oubli' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590275323')
  where name = 'Le Carré' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590277248'), facebook = coalesce(facebook, 'https://www.facebook.com/p/Le-Repaire-100066356874546/')
  where name = 'Le Repaire' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590278687')
  where name = 'Le Sélect' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590291313'), website = coalesce(website, 'https://www.megumi.fr'), instagram = coalesce(instagram, 'megumistbarth'), facebook = coalesce(facebook, 'https://www.facebook.com/megumistbarth/')
  where name = 'Megumi Sushi' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590293664'), website = coalesce(website, 'https://naturaldelights-stbarth.fr'), facebook = coalesce(facebook, 'https://www.facebook.com/NaturalDelightsSaintBarth/')
  where name = 'Natural Delights' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590290666'), website = coalesce(website, 'https://shellonabeach.com'), email = coalesce(email, 'info@shellonabeach.com')
  where name = 'Shellona' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590278824')
  where name = 'Spam To Go' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590275033')
  where name = 'Jojo Burger' and quartier = 'Lorient';
update public.restaurants set phone = coalesce(phone, '+590590277939')
  where name = 'Le bouchon' and quartier = 'Lorient';
update public.restaurants set facebook = coalesce(facebook, 'https://www.facebook.com/ocorail/')
  where name = 'Restaurant O''Corail' and quartier = 'Marigot';
update public.restaurants set phone = coalesce(phone, '+590590279771'), website = coalesce(website, 'https://tistbarth.com'), facebook = coalesce(facebook, 'https://www.facebook.com/leti.stbarth/'), email = coalesce(email, 'reservations@letistbarth-sbh.com')
  where name = 'Le Ti St. Barth' and quartier = 'Pointe Milou';
update public.restaurants set website = coalesce(website, 'https://sellasaintbarth.com'), instagram = coalesce(instagram, 'sellastbarth')
  where name = 'Sella' and quartier = 'Public';
update public.restaurants set phone = coalesce(phone, '+590590524605')
  where name = 'Le Grain de Sel' and quartier = 'Saline';
update public.restaurants set phone = coalesce(phone, '+590590292774'), website = coalesce(website, 'https://tamarinstbarth.com'), facebook = coalesce(facebook, 'https://www.facebook.com/tamarinstbarth/'), email = coalesce(email, 'info@tamarinstbarth.com')
  where name = 'Tamarin' and quartier = 'Saline';
update public.restaurants set phone = coalesce(phone, '+590590277130'), facebook = coalesce(facebook, 'https://www.facebook.com/leglacierrestaurantpizzeria')
  where name = 'Le Glacier' and quartier = 'St-Jean';
update public.restaurants set phone = coalesce(phone, '+590590275388'), website = coalesce(website, 'https://www.lepimentbistro.com'), facebook = coalesce(facebook, 'https://www.facebook.com/lepimentsbh/'), email = coalesce(email, 'lepimentsbh@gmail.com')
  where name = 'Le Piment' and quartier = 'St-Jean';
update public.restaurants set phone = coalesce(phone, '+590590298370'), website = coalesce(website, 'https://www.mayastogo.com')
  where name = 'Mayas to go' and quartier = 'St-Jean';
update public.restaurants set phone = coalesce(phone, '+590590276464'), website = coalesce(website, 'https://nikkibeach.com/saint-barth'), facebook = coalesce(facebook, 'https://www.facebook.com/nikkibeachsaintbarth/'), email = coalesce(email, 'reservations.stbarth@nikkibeach.com')
  where name = 'Nikki Beach St-Barth' and quartier = 'St-Jean';
update public.restaurants set phone = coalesce(phone, '+590590292197'), instagram = coalesce(instagram, 'lediamantsaintbarth'), facebook = coalesce(facebook, 'https://www.facebook.com/lediamantstbarth/')
  where name = 'Restaurant Le Diamant' and quartier = 'St-Jean';
update public.restaurants set phone = coalesce(phone, '+590590276362'), website = coalesce(website, 'http://www.hideaway.tv')
  where name = 'The Hideaway' and quartier = 'St-Jean';
update public.restaurants set website = coalesce(website, 'https://www.letoiny.com/st-barth-restaurant-le-gaiac')
  where name = 'Restaurant Le Gaïac' and quartier = 'Toiny';
update public.restaurants set phone = coalesce(phone, '+590590771180'), website = coalesce(website, 'https://www.lecafe.fr')
  where name = 'Le Café' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590590523767')
  where name = 'Le Petit Deauville' and quartier = 'Gustavia';
update public.restaurants set phone = coalesce(phone, '+590690383409'), facebook = coalesce(facebook, 'https://www.facebook.com/nyamasbh/'), email = coalesce(email, 'nyamastbarth.booking@gmail.com')
  where name = 'Nyama' and quartier = 'Corossol';
update public.restaurants set phone = coalesce(phone, '+590590271330')
  where name = 'Sayolita Bar' and quartier = 'Gustavia';
update public.restaurants set instagram = coalesce(instagram, 'lisolastbarth')
  where name = 'Ristorante L''Isola' and quartier = 'Gustavia';

-- ============================================================
-- Établissements dont l'état a changé depuis l'import OSM — À VOUS DE
-- DÉCIDER. Décommentez pour masquer (rien n'est supprimé) :
-- ============================================================
-- Victoria est définitivement fermé (remplacé par La Petite Plage) :
-- update public.restaurants set status = 'hidden' where name = 'Restaurant Victoria' and quartier = 'Gustavia';
-- Fellini (Anse des Cayes) : introuvable en ligne, probablement fermé :
-- update public.restaurants set status = 'hidden' where name = 'Ristorante Fellini' and quartier = 'Anse des Cayes';
-- O'Corail s'appelle désormais Ti'Corail (repris en 2021) :
-- update public.restaurants set name = 'Ti''Corail' where name = 'Restaurant O''Corail' and quartier = 'Marigot';
-- La Quintessence serait devenue « La Pizzetta » :
-- update public.restaurants set name = 'La Pizzetta' where name = 'La Quintessence' and quartier = 'Gustavia';

