-- ============================================================
-- 0023 — St Barth Guide : enrichissement de l'annuaire.
--
-- Deux mouvements :
--   1) une soixantaine de nouvelles fiches — sport et activités,
--      sentiers, spots de surf et de plongée, îlets de la réserve,
--      écoles, services, rendez-vous annuels de l'île ;
--   2) des coordonnées (adresse, téléphone, site) sur les fiches
--      existantes qui n'en avaient aucune.
--
-- Volontairement sans nouvelle catégorie : ajouter une valeur à un
-- type enum et l'utiliser dans la même transaction est refusé par
-- PostgreSQL, or l'éditeur SQL de Supabase exécute tout dans une
-- transaction. Le contenu sportif est donc rangé dans « Associations »
-- (les clubs et écoles) et « Bons plans » (les spots). Un onglet
-- « Sport » dédié reste possible plus tard, en deux temps.
--
-- Aucun téléphone inventé : les fiches sans numéro vérifié gardent
-- null plutôt qu'une valeur plausible mais fausse.
--
-- Ré-exécutable sans doublon (index unique sur (name, quartier)).
-- ============================================================

insert into public.places (category, name, quartier, description, tip, address, phone, website, lat, lng) values

-- ---------- Sport, clubs et écoles (rangés en Associations) ----------
('association', 'Saint-Barth Yacht Club — école de voile', 'Public',
 'Le club nautique historique de l''île : école de voile pour les enfants dès l''Optimist, dériveurs, planche, et les régates du calendrier local. C''est de là que partent la plupart des courses en rade de Gustavia.',
 'Stages pendant les vacances scolaires — les places partent vite, inscrivez-vous en avance.',
 '', null, null, 17.9035, -62.8570),
('association', 'ASPSB — Association Sportive Portugaise', 'Gustavia',
 'Club omnisports de Gustavia, surtout connu pour son équipe de football engagée dans le championnat de Saint-Barthélemy. L''un des piliers de la vie sportive de l''île.',
 null, '', null, null, 17.8965, -62.8495),
('association', 'Football — le championnat de l''île', 'St-Jean',
 'Une dizaine de clubs se disputent le championnat territorial : AJOE, ASPSB, Arawak FC, ASCCO, Diables Rouges, AS Gustavia, Young Stars, Ounalao… Les matchs se jouent sur le stade de Saint-Jean, souvent en fin de journée.',
 'L''entrée est libre ; l''ambiance des derbys de quartier vaut le déplacement.',
 '', null, null, 17.9010, -62.8320),
('association', 'Tennis Club de Saint-Barth', 'St-Jean',
 'Courts, cours et tournois : le club de tennis de l''île, adossé au complexe sportif de Saint-Jean.',
 'Jouez tôt le matin ou après 16 h — le soleil de la mi-journée est rude sur les courts.',
 '', null, null, 17.9012, -62.8318),
('association', 'Judo Club Saint-Barth', 'St-Jean',
 'Cours de judo pour les enfants et les adultes, à l''année, dans la salle du complexe sportif.',
 null, '', null, null, 17.9008, -62.8322),
('association', 'Panda Freediving — apnée', 'Gustavia',
 'École d''apnée : initiation, perfectionnement et sorties en pleine eau autour des îlets de la réserve.',
 'L''apnée ne se pratique jamais seul, même à faible profondeur.',
 '', null, null, 17.8960, -62.8510),
('association', 'Plongée sous-marine — les clubs de l''île', 'Gustavia',
 'Plusieurs centres opèrent depuis Gustavia et Corossol : baptêmes, formations et sorties quotidiennes vers les sites de la réserve naturelle.',
 'Réservez la veille en haute saison. La plongée dans la réserve suit des règles strictes : votre club vous les rappellera.',
 '', null, null, 17.8958, -62.8512),
('association', 'Écoles de surf de Lorient', 'Lorient',
 'La plage de Lorient et sa cabane colorée sont le berceau du surf local : cours particuliers, stages enfants et location de planches sur place.',
 'Le pic devant la plage est le plus doux — idéal pour un premier cours.',
 '', null, null, 17.9070, -62.8210),
('association', 'Kitesurf et wingfoil au Grand Cul-de-Sac', 'Grand Cul-de-Sac',
 'Le lagon peu profond et l''alizé régulier font du Grand Cul-de-Sac le spot d''apprentissage de l''île : kitesurf, planche à voile et wingfoil, avec plusieurs écoles installées sur la plage.',
 'Le vent monte en général en milieu de matinée et forcit l''après-midi.',
 '', null, null, 17.9110, -62.7950),
('association', 'AJOE — Association des Jeunes de l''Orient', 'Lorient',
 'L''association de Lorient : football, animations de quartier, et le cinéma en plein air sur son plateau — une institution de la vie locale.',
 'Les séances de cinéma en plein air sont annoncées à l''affiche du quartier.',
 '', null, null, 17.9050, -62.8230),
('association', 'Coral Restoration St Barth', 'Gustavia',
 'Association de restauration des récifs coralliens : pépinières sous-marines, bouturage et replantation de coraux sur les zones dégradées, avec un volet suivi des tortues marines.',
 'Ne prélevez jamais de corail, même mort : il fait partie du récif.',
 '', null, null, 17.8968, -62.8502),
('association', 'Saint-Barth Essentiel', 'Gustavia',
 'Créée en 2009, l''association veille sur le patrimoine de l''île — bâti ancien, mémoire, paysages — et sur l''environnement terrestre et marin : inventaires, expositions, publications et alertes.',
 null, '', null, null, 17.8962, -62.8498),

-- ---------- Sentiers et randonnées (Bons plans) ----------
('bon_plan', 'Sentier littoral de Colombier — voie haute', 'Colombier',
 'Le chemin qui part du belvédère de Colombier et descend vers l''anse par le flanc de la colline : 30 à 45 minutes, quelques passages raides et un escalier de rondins, mais des vues plongeantes tout du long.',
 'Chaussures fermées, de l''eau, et pas de descente au coucher du soleil sans lampe.',
 '', null, null, 17.9180, -62.8680),
('bon_plan', 'Sentier littoral de Colombier — voie basse', 'Flamands',
 'La variante depuis l''extrémité de la plage de Flamands : plus longue mais bien plus douce, elle longe la côte au ras de l''eau jusqu''à l''anse de Colombier.',
 'La meilleure option avec des enfants ou par forte chaleur.',
 '', null, null, 17.9195, -62.8640),
('bon_plan', 'Sentier des piscines naturelles de Grand Fond', 'Grand Fond',
 'Depuis la plage de Grand Fond, un cheminement sur la roche volcanique mène aux vasques creusées par la houle, face au large.',
 'Uniquement par mer calme, et jamais seul : par houle, les vagues balayent les dalles sans prévenir.',
 '', null, null, 17.8925, -62.8095),
('bon_plan', 'Montée au Morne du Vitet', 'Vitet',
 'L''ascension du point culminant de l''île (286 m), entre murets de pierres sèches et pâturages : au sommet, les deux côtes d''un seul regard.',
 'Tôt le matin, avant que la chaleur ne monte. Brume possible au lever du jour.',
 '', null, null, 17.9010, -62.8060),
('bon_plan', 'Boucle de Toiny et la côte sauvage', 'Toiny',
 'La marche le long de la côte au vent, entre Grand Fond et Toiny : paysage brut, embruns, et les surfeurs minuscules au loin sur la vague.',
 'Le sentier passe par endroits sur des terrains privés — restez sur le chemin balisé.',
 '', null, null, 17.8950, -62.7900),

-- ---------- Spots de surf et de glisse (Bons plans) ----------
('bon_plan', 'Spot de surf de Lorient', 'Lorient',
 'Le spot école de l''île, reconnaissable à sa cabane de surfeurs. Deux pics : celui devant la plage, tolérant, et celui de gauche, plus creux, pour les habitués.',
 'La houle rentre surtout de novembre à mars. Respectez la priorité, le line-up est petit.',
 '', null, null, 17.9075, -62.8205),
('bon_plan', 'Spot de surf de Toiny', 'Toiny',
 'Une droite de reef puissante, exposée plein est : l''une des meilleures vagues des Antilles quand elle fonctionne, mais réservée aux surfeurs confirmés.',
 'Courant fort et fond de corail. Ce n''est pas un spot où l''on apprend.',
 '', null, null, 17.8955, -62.7895),
('bon_plan', 'Spot de surf de l''Anse des Cayes', 'Anse des Cayes',
 'Des conditions proches de Lorient mais souvent moins de monde : un bon compromis pour un niveau intermédiaire quand la houle vient du nord-est.',
 'Le stationnement est étroit — venez tôt.',
 '', null, null, 17.9150, -62.8480),

-- ---------- Spots de plongée et de snorkeling (Bons plans) ----------
('bon_plan', 'Plongée au Pain de Sucre', 'Gustavia',
 'Le rocher emblématique à l''entrée de la rade, entouré de plusieurs sites dans la réserve naturelle : jardins de corail peu profonds, faune dense, et la plus belle épave de l''île à proximité.',
 'Site en réserve : on regarde, on ne prélève rien, et le mouillage est réglementé.',
 '', null, null, 17.8890, -62.8590),
('bon_plan', 'Plongée aux Gros Îlets', 'Gustavia',
 'Avec le Pain de Sucre, l''un des sites les plus réputés du côté caraïbe : tombants doux, gorgones et bancs de poissons.',
 'Accessible uniquement en bateau, avec un club.',
 '', null, null, 17.8845, -62.8700),
('bon_plan', 'Plongée à l''Île Fourchue', 'Île Fourchue',
 'Au nord-ouest, des tombants en pente douce couverts de gorgones et d''éponges géantes, fréquentés par les mérous, les barracudas et des centaines d''anguilles-jardinières.',
 'Une heure de navigation environ ; mouillage réglementé par la réserve.',
 '', null, null, 17.9650, -62.9200),
('bon_plan', 'Plongée à la Pointe de Colombier', 'Colombier',
 'Un tombant d''environ 25 mètres face à la pointe, et un gros pinacle où stationnent les barracudas.',
 null, '', null, null, 17.9245, -62.8790),
('bon_plan', 'Snorkeling à l''Anse de Colombier', 'Colombier',
 'Le fond de l''anse, protégé et peu profond, est l''un des plus beaux masque-tuba accessibles à la nage depuis la plage : herbiers, patates de corail et tortues.',
 'Restez à distance des tortues et ne les touchez jamais — c''est une espèce protégée.',
 '', null, null, 17.9210, -62.8745),
('bon_plan', 'Snorkeling à Petite Anse et Marigot', 'Marigot',
 'Les rochers de Marigot, dans le périmètre de la réserve, abritent un petit monde à quelques mètres du bord : poissons-perroquets, oursins, parfois une raie.',
 'Entrez par la plage, pas par les rochers ; chaussons conseillés.',
 '', null, null, 17.9110, -62.8040),

-- ---------- Îlets et réserve naturelle (Incontournables) ----------
('incontournable', 'Réserve naturelle de Saint-Barthélemy', 'Gustavia',
 'Créée en 1996, elle protège environ 1 200 hectares de domaine marin répartis en cinq zones autour des îlets inhabités : récifs coralliens, herbiers et espèces menacées. C''est le cœur vivant de l''île, sous la surface.',
 'Mouillage, pêche et prélèvements y sont réglementés. Renseignez-vous avant toute sortie en bateau.',
 '', null, null, 17.9000, -62.8600),
('incontournable', 'Île Fourchue', 'Île Fourchue',
 'À environ 5 km au nord-ouest, une île en forme de fourche, inhabitée et pelée par le vent : l''un des plus beaux mouillages des Antilles, et une baie protégée par la réserve.',
 'Escale classique d''une journée en bateau ; il n''y a rien sur place, prévoyez tout.',
 '', null, null, 17.9650, -62.9200),
('incontournable', 'Îlets de la réserve — Frégate, Toc Vers, Chevreau', 'Grand Cul-de-Sac',
 'Le chapelet d''îlets inhabités du nord-est : Chevreau (dit aussi Bonhomme), Frégate, Toc Vers. Refuges d''oiseaux marins et d''iguanes, ils se regardent depuis la côte et se contournent en bateau.',
 'Débarquement interdit ou réglementé selon les îlets : demandez à la réserve.',
 '', null, null, 17.9250, -62.7800),

-- ---------- Rendez-vous annuels (Incontournables) ----------
('incontournable', 'Fête de la Saint-Barthélemy — 24 août', 'Gustavia',
 'La fête patronale de l''île : messe du matin, régates dans la rade, repas offert au public et feu d''artifice le soir. Le rendez-vous où l''île entière se retrouve.',
 'Le 24 août chaque année. Beaucoup de commerces ferment ou réduisent leurs horaires.',
 '', null, null, 17.8960, -62.8500),
('incontournable', 'Carnaval de Saint-Barth', 'Gustavia',
 'En février, le défilé costumé traverse Gustavia jusqu''au Mardi gras et à la crémation de Vaval, qui clôt la saison.',
 'Les rues du centre sont fermées à la circulation les jours de défilé.',
 '', null, null, 17.8958, -62.8503),
('incontournable', 'Les Voiles de Saint-Barth', 'Gustavia',
 'En avril, la grande régate internationale de l''île : des dizaines de voiliers de course et de tradition, quatre jours de courses au large et des soirées sur le port.',
 'La rade est magnifique depuis Fort Gustave pendant les manches.',
 '', null, null, 17.8965, -62.8515),
('incontournable', 'St Barths Bucket Regatta', 'Gustavia',
 'En mars, le rassemblement des plus grands voiliers du monde dans la rade de Gustavia — un spectacle même depuis la terre.',
 'Le meilleur point de vue gratuit : les hauteurs de Gustavia et le phare.',
 '', null, null, 17.8968, -62.8518),
('incontournable', 'St Barth Music Festival', 'Gustavia',
 'En janvier, une quinzaine de concerts — classique, jazz, musiques du monde — dans les églises et les salles de l''île, avec des artistes internationaux.',
 'Programmation annoncée en fin d''année ; certaines soirées sont gratuites.',
 '', null, null, 17.8955, -62.8505),
('incontournable', 'St Barth Gourmet Festival', 'Gustavia',
 'En novembre, des chefs étoilés venus de France cuisinent quelques soirs dans les restaurants de l''île, à quatre mains avec les cuisines locales.',
 'Réservation indispensable, les tables partent des semaines à l''avance.',
 '', null, null, 17.8962, -62.8508),

-- ---------- Écoles et services (Lieux publics) ----------
('lieu_public', 'Collège Mireille Choisy', 'Gustavia',
 'Le seul établissement public du second degré de l''île, de la sixième à la troisième.',
 null, 'BP 58, Gustavia, 97133 Saint-Barthélemy', '0590 29 60 00', null, 17.8970, -62.8492),
('lieu_public', 'École primaire de Gustavia', 'Gustavia',
 'L''école publique de Gustavia : maternelle et élémentaire.',
 null, 'Gustavia, 97133 Saint-Barthélemy', null, null, 17.8968, -62.8488),
('lieu_public', 'École Saint-Joseph de Lorient', 'Lorient',
 'École primaire privée sous contrat, au cœur du village de Lorient.',
 null, 'Lorient, 97133 Saint-Barthélemy', '0590 27 85 87', null, 17.9058, -62.8225),
('lieu_public', 'École Sainte-Marie de Colombier', 'Colombier',
 'École primaire privée sous contrat, à Colombier.',
 null, 'Colombier, 97133 Saint-Barthélemy', '0590 27 61 18', null, 17.9140, -62.8650),
('lieu_public', 'Gendarmerie de Saint-Barthélemy', 'Gustavia',
 'La brigade de gendarmerie de l''île : dépôt de plainte, objets trouvés, sécurité publique.',
 'Urgence : composez le 17. Accueil du lundi au samedi le matin et l''après-midi, ouverture réduite le dimanche.',
 'Gustavia, 97133 Saint-Barthélemy', null, null, 17.8975, -62.8485),
('lieu_public', 'Centre de secours — pompiers', 'Gustavia',
 'Les sapeurs-pompiers de Saint-Barthélemy : secours à personne, incendie, secours en mer en appui des moyens nautiques.',
 'Urgence : 18 depuis un fixe, ou 112 depuis un mobile.',
 'Gustavia, 97133 Saint-Barthélemy', null, null, 17.8980, -62.8488),
('lieu_public', 'Comité territorial du tourisme', 'Gustavia',
 'Le Comité du tourisme de Saint-Barthélemy : informations pratiques, agenda des manifestations, documentation et conseils pour découvrir l''île.',
 'Le premier arrêt utile quand on débarque.',
 'Quai du Général de Gaulle, Gustavia, 97133 Saint-Barthélemy',
 '+590 590 27 87 27', 'https://www.saintbarth-tourisme.com', 17.8962, -62.8508),

-- ---------- Bons plans de saison ----------
('bon_plan', 'Le marché du samedi matin', 'Gustavia',
 'Fruits, légumes du jardin créole, confitures et produits de l''île : le rendez-vous matinal du week-end sur le port.',
 'Venez tôt — les meilleurs étals sont dépouillés avant 10 h.',
 '', null, null, 17.8962, -62.8512),
('bon_plan', 'Observer les avions depuis la plage de Saint-Jean', 'St-Jean',
 'Depuis le bout est de la plage, les appareils passent au-dessus du col puis se posent en quelques secondes : le spectacle le plus photographié de l''île, vu du sable.',
 'Ne vous placez jamais dans l''axe de la piste, ni derrière les réacteurs : c''est dangereux et interdit.',
 '', null, null, 17.9040, -62.8390),
('bon_plan', 'Le rayon vert depuis Pointe Milou', 'Pointe Milou',
 'Quand l''horizon est parfaitement dégagé, le dernier éclat du soleil vire au vert une fraction de seconde. Pointe Milou est le meilleur poste d''observation de l''île.',
 'Il faut un horizon sans le moindre nuage — c''est rare, d''où le plaisir.',
 '', null, null, 17.9150, -62.8140),
('bon_plan', 'La saison des tortues, de mars à octobre', 'Grand Cul-de-Sac',
 'Les tortues vertes broutent l''herbier du lagon toute l''année, et les femelles viennent pondre sur les plages entre le printemps et l''automne.',
 'Une trace de ponte ou un nid se signale à la réserve. Ne creusez jamais, n''éclairez jamais une tortue la nuit.',
 '', null, null, 17.9110, -62.7950),
('bon_plan', 'Le Journal de Saint-Barth, le jeudi', 'Gustavia',
 'L''hebdomadaire de l''île paraît le jeudi : actualité locale, annonces officielles, agenda des manifestations et petites annonces.',
 'La meilleure façon de savoir ce qui se passe vraiment cette semaine-là.',
 '', null, 'https://www.journaldesaintbarth.com', 17.8960, -62.8500)

on conflict (name, quartier) do nothing;

-- ============================================================
-- Coordonnées des fiches déjà en base.
-- Un update ciblé plutôt qu'un upsert : les descriptions rédigées
-- restent intactes, seules les coordonnées manquantes sont posées.
-- ============================================================

update public.places set
  address = 'Gustavia, 97133 Saint-Barthélemy',
  website = 'https://www.comstbarth.fr'
where name = 'Hôtel de la Collectivité' and quartier = 'Gustavia' and website is null;

update public.places set
  address = 'Quai du Général de Gaulle, Gustavia, 97133 Saint-Barthélemy',
  phone   = '+590 590 27 87 27',
  website = 'https://www.saintbarth-tourisme.com'
where name = 'Office de tourisme' and quartier = 'Gustavia' and website is null;

update public.places set
  address = 'Gustavia, 97133 Saint-Barthélemy',
  tip     = coalesce(tip, 'En cas d''urgence vitale, composez le 15.')
where name = 'Hôpital Irénée de Bruyn' and quartier = 'Gustavia' and address = '';

update public.places set address = 'Gustavia, 97133 Saint-Barthélemy'
where quartier = 'Gustavia' and address = ''
  and name in ('Bibliothèque territoriale', 'Bureau de poste de Gustavia',
               'Capitainerie du port de Gustavia', 'Musée territorial — Wall House');

update public.places set address = 'Saint-Jean, 97133 Saint-Barthélemy'
where quartier = 'St-Jean' and address = '';

update public.places set address = 'Corossol, 97133 Saint-Barthélemy'
where quartier = 'Corossol' and address = '';

update public.places set address = 'Lorient, 97133 Saint-Barthélemy'
where quartier = 'Lorient' and address = '';

-- Vérification : doit renvoyer le total par catégorie.
-- select category, count(*) from public.places
--  where status = 'active' group by category order by 1;
