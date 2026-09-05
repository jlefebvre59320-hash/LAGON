# Inventaire des sources de données

Livrable 2 sur 10. Rédigé le 2026-09-05, à partir de trois campagnes de vérification menées le même jour.

## Comment lire ce document

Chaque fait porte un **statut de vérification** :

- **V1** : lu le 2026-09-05 sur la page primaire, ou sur le code source officiel du site (dépôt GitHub de l'éditeur), ou sur le fichier de données lui-même. Texte cité entre guillemets.
- **V2** : lu sur une copie miroir ou une documentation tierce sérieuse (fork, paquet logiciel documentant l'API), la page primaire étant inaccessible depuis l'environnement de rédaction. À relire sur la source primaire avant tout usage contractuel.
- **V3** : indication issue d'extraits de moteur de recherche ou de connaissance de l'équipe, non confirmée. À vérifier avant intégration ; ne pas citer comme établi.

**Contrainte de l'environnement de rédaction** : le proxy de sortie réseau bloque la quasi-totalité des sites de données sportives, de bookmakers et d'organismes publics (liste en §G). Seuls github.com, raw.githubusercontent.com et pypi.org répondaient. Tout ce qui est V1 ci-dessous a donc été lu sur GitHub ou dans des fichiers de données. Les items V3 doivent être revérifiés depuis un poste non filtré avant le démarrage du prototype.

Cadre d'usage confirmé le 2026-09-05 : strictement personnel, sans distribution. Les sources à licence non commerciale sont donc utilisables ; les interdictions d'accès automatisé restent applicables quel que soit l'usage.

Règle appliquée : une donnée visible sur un site n'est pas une donnée réutilisable. La colonne « Réutilisation » distingue : *licence ouverte* (CC0, CC BY, ODbL, domaine public), *usage non commercial* (CC BY-NC, conditions du service), *téléchargement toléré sans licence explicite*, *interdit ou à autorisation*.

Aucune source ci-dessous n'a été inventée. Quand une capacité d'API n'a pas pu être confirmée, elle est indiquée « non confirmée ».

---

## A. Football : résultats, cotes historiques, statistiques de match

### A1. Football-Data.co.uk

| Champ | Contenu |
|---|---|
| URL | https://www.football-data.co.uk/data.php ; notes : https://www.football-data.co.uk/notes.txt ; matchs à venir : https://www.football-data.co.uk/matches.php |
| Organisme | Site personnel de Joseph Buchdahl (Royaume-Uni) (V2, cité par le README de github.com/footballcsv/cache.footballdata) |
| Couverture | Championnats européens (Angleterre, Écosse, Allemagne, Italie, Espagne, France, Pays-Bas, Belgique, Portugal, Turquie, Grèce, plusieurs divisions) plus fichiers « extra » hors Europe (V3 pour la liste exacte). Résultats depuis 1993/94 (V2 : « datasets for the football leagues from 25 seasons back to 1993/94 », README footballcsv). Statistiques de match : les notes indiquent que celles des saisons 2000/01 et 2001/02 pour l'Angleterre, l'Écosse et l'Allemagne « were provided by Sports.com » (V2) ; la saison de début par ligue n'est pas énoncée. |
| Variables résultats (V2, copie des notes) | `Div, Date, Time, HomeTeam, AwayTeam, FTHG, FTAG, FTR, HTHG, HTAG, HTR`. |
| Statistiques « where available » (V2) | `Attendance, Referee, HS/AS` (tirs), `HST/AST` (cadrés), `HHW/AHW` (poteaux), `HC/AC` (corners), `HF/AF` (fautes), `HFKC/AFKC`, `HO/AO` (hors-jeu), `HY/AY, HR/AR` (cartons), `HBP/ABP` (points de sanction). Nuance : « English and Scottish yellow cards do not include the initial yellow card when a second is shown to a player converting it into a red ». |
| Cotes 1N2 (V2) | « These are for pre-closing odds. For the closing odds, as below but with an additional "C" character following the bookmaker abbreviation/Max/Avg (e.g. B365CH = closing Bet365 home win odds). » Bookmakers listés dans les notes récentes : 1XBet (1XB), Bet365 (B365), Betfair (BF), Betfred (BFD), BetMGM (BMGM), BetVictor (BV), Blue Square (BS), Bwin (BW), Coral (CL), Gamebookers (GB), Interwetten (IW), Ladbrokes (LB), Paddy Power (PP), Pinnacle (PS/P), Skybet (SK), Sporting Odds (SO), Sportingbet (SB), Stan James (SJ), Stanleybet (SY), VC Bet (VC), William Hill (WH) ; agrégats Betbrain (`Bb1X2, BbMxH, BbAvH`…) puis `MaxH/AvgH` « Market maximum/average » ; `BFEH` = Betfair Exchange. Avertissement des notes : « some abbreviations are no longer in use ». |
| Autres marchés (V2) | Plus/moins 2,5 buts : `B365>2.5, P>2.5, Max>2.5, Avg>2.5` et équivalents `<2.5`. Handicap asiatique : `AHh` « Market size of handicap (home team) (since 2019/2020) », `B365AHH/AHA, PAHH/PAHA, MaxAHH, AvgAHH`. |
| Horodatage des cotes (V2) | « Betting odds for weekend games are collected Friday afternoons, and on Tuesday afternoons for midweek games. » Pas d'heure ; les cotes de clôture n'ont pas d'horodatage propre. |
| Saison d'apparition des cotes de clôture | **Non énoncée dans les notes** (V2). Le champ `AHh` date de 2019/20 ; la saison exacte des colonnes « C » reste à lire sur data.php. |
| Sources déclarées (V2) | Résultats : XScores ; statistiques : BBC, Flashscore, ESPN, Bundesliga.de, Gazzetta.it, Football.fr ; cotes : Betbrain.com, Oddsportal.com, bookmakers individuels. |
| Fréquence | Deux mises à jour par semaine (V2, README footballcsv). Fichier des rencontres à venir avec cotes : V3 (page bloquée). |
| Coût, licence | Gratuit. **Aucune mention de licence, de copyright ni de conditions dans les notes** (V2, lecture complète de la copie). Réutilisation : téléchargement toléré sans licence explicite ; usage personnel, pas de redistribution. |
| Fiabilité, trous | Référence de fait de la littérature amateur et académique. Colonnes variables selon saisons et ligues ; bookmakers disparus ; noms d'équipes propres au site. |
| Historique exploitable | **Oui.** Colonne vertébrale du backtest P0. |

### A2. Understat

| Champ | Contenu |
|---|---|
| URL | https://understat.com/ |
| Organisme | Non identifié (V3) |
| Couverture | Six championnats (Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Premier League russe) depuis 2014/15 (V3, concordant sur plusieurs extraits ; page bloquée). |
| Variables | Par tir : coordonnées, xG, joueur, situation, type ; par match : xG, xPoints, tirs, PPDA, « deep completions » ; par joueur : xG, xA, npxG (V3). Modèle annoncé : réseau de neurones entraîné sur plus de 100 000 tirs (V3). |
| Accès et conditions | **Pas d'API officielle ; aucune page de conditions identifiée** (V3). Les données sont embarquées en JSON dans les pages et servies par un point interne `/getLeagueData/{league}/{season}` exploité par des extracteurs tiers (V3). Réutilisation : zone grise. Décision : extraction lente (≥ 6 s entre requêtes), cache local complet, usage personnel, pas de redistribution ; arrêt immédiat si des conditions l'interdisant apparaissent. |
| Fiabilité | xG propriétaire, non comparable à Opta ni StatsBomb. Un seul fournisseur par version de modèle. |
| Historique exploitable | **Oui** en pratique, 11 saisons sur 5 des 6 ligues cibles, sous la réserve de conditions ci-dessus. |

### A3. FBref (Sports Reference)

| Champ | Contenu |
|---|---|
| URL | https://fbref.com ; https://www.sports-reference.com/bot-traffic.html ; https://www.sports-reference.com/data_use.html |
| Organisme | Sports Reference LLC (États-Unis) |
| Couverture | Statistiques avancées Opta (xG, passes progressives) pour les grands championnats ; passage de StatsBomb à Opta le 25 octobre 2022 (V3). |
| Conditions (V3, extraits) | Blocage au-delà de dix requêtes par minute sur FBref et Stathead, « jail for up to a day » ; la page « data use » indique que les données proviennent de tiers et ne peuvent pas être fournies en téléchargement ; demandes sur mesure à partir de 5 000 $. |
| Réutilisation | Interdit ou à autorisation pour tout usage systématique. **Non retenu pour le pipeline automatisé.** Contrôle manuel ponctuel possible. |

### A4. StatsBomb Open Data (V1)

| Champ | Contenu |
|---|---|
| URL | https://github.com/statsbomb/open-data (redirige vers l'organisation hudl) |
| Organisme | « StatsBomb Services Ltd … registered in England and Wales with number 10377735 » (LICENSE.pdf) |
| Couverture (competitions.json lu) | Ligue 1 : 2015/16, 2021/22, 2022/23. Premier League : 2003/04, 2015/16. La Liga : 2004/05 à 2020/21 plus 1973/74. Bundesliga : 2015/16, 2023/24. Serie A : 1986/87, 2015/16. Champions League : 18 saisons sélectionnées 1970/71 à 2018/19. Coupes du monde 1958, 1962, 1970, 1974, 1986, 1990, 2018, 2022. Euro 2020 et 2024. Copa América 2024, CAN 2023, MLS 2023, Indian Super League 2021/22, Coupe du Roi (3 saisons), championnat argentin (2), Europa League 1988/89, Coupe du monde U20 1979. Compétitions féminines : FA WSL (4 saisons), Coupes du monde 2019 et 2023, Euro 2022 et 2025, Liga F, Frauen Bundesliga, Serie A féminine, NWSL 2018 et 2023. |
| Format | « provided as JSON files exported from the StatsBomb Data API » : `competitions.json`, `matches/`, `events/`, `lineups/`, `three-sixty/` (360 pour une sélection). Documentation versionnée (Events v4.0.0, Lineups v2.0.0, Matches v3.0.0). |
| Licence (LICENSE.pdf, « last updated 8 September 2023 ») | « 1.2. The User may not: 1.2.1. edit, distort, distribute, reproduce, sell or in any way provide the data to any external or third party; 1.2.2. commercially exploit the data or any analysis derived from the use of the Service » ; « 1.4 The User is required to accredit any publication of analysis formed from StatsBomb Data with the StatsBomb brand logo » ; « 2.1 … StatsBomb have full rights to withhold the Service at any time without prior warning ». Droit anglais. |
| Mise à jour | Dernier commit 26 mai 2026 : « Added 1647 new games, updated 1213 games ». |
| Historique exploitable pour les paris | **Non pour le backtest** : saisons isolées, aucune cote. 2015/16 est la seule saison commune aux cinq grands championnats. Utile pour construire et valider un modèle xG maison, et tester des variables de style sur une saison. Usage non commercial strict. |

### A5. openfootball (V1)

| Champ | Contenu |
|---|---|
| URL | https://github.com/openfootball/football.json ; https://github.com/openfootball/england |
| Licence | « The football.json schema, data and scripts are dedicated to the public domain. Use as you please with no restrictions whatsoever. » (CC0) |
| Couverture | football.json : saisons 2010-11 à 2026-27 ; Angleterre (4 divisions), Allemagne (3), Espagne (2), Italie (2), France (Ligue 1 et 2), autres. England : 2000-01 à 2026-27. |
| Variables | `round, date, time, team1, team2, score.ft, score.ht` (Angleterre : plus les buteurs). **Aucune cote, statistique, arbitre ni affluence.** |
| Mise à jour | « auto-updated once a day (5 o'clock UTC) » depuis les fichiers Football.TXT ; dernier commit 2 septembre 2026. L'amont dépend de contributions manuelles. |
| Usage | Calendriers pour le calcul des repos et enchaînements ; source de secours pour les résultats. |

### A6. Base « European Soccer Database » (Kaggle, Hugo Mathien)

| Champ | Contenu |
|---|---|
| URL | https://www.kaggle.com/datasets/hugomathien/soccer (bloqué ; description lue sur une copie tierce, github.com/abfsoliman/European-Soccer-Dataset, V2) |
| Couverture (V2) | « 11 European Countries with their lead championship, Seasons 2008 to 2016 », « +25,000 matches +10,000 players », « Betting odds from up to 10 providers », « Detailed match events … for +10,000 matches », attributs joueurs et équipes issus des jeux FIFA. Sept tables SQLite. |
| Licence | ODbL (V3). Bookmakers : dérivés de Football-Data (V3). |
| Usage | Compositions (positions x/y) pour 2008-2016, rares dans une source gratuite, mais sans horodatage d'annonce. Figé. |

### A7. ClubElo

| Champ | Contenu |
|---|---|
| URL | http://clubelo.com/API ; http://api.clubelo.com/ (hôte bloqué) |
| Contenu (V3) | Classement Elo quotidien des clubs européens depuis 1939, CSV par date (`api.clubelo.com/YYYY-MM-DD`), par club, et calendrier avec probabilités. Conditions non lues. |
| Usage | Contrôle externe de l'Elo maison. |

### A8. FiveThirtyEight SPI (archive) (V1 pour le dépôt)

| Champ | Contenu |
|---|---|
| URL | https://github.com/fivethirtyeight/data/tree/master/soccer-spi ; CSV hébergés sur projects.fivethirtyeight.com (bloqué) |
| Contenu | « spi_matches.csv contains match-by-match SPI ratings and forecasts back to 2016 » ; colonnes `season, date, league, team1, team2, spi1, spi2, prob1, prob2, probtie, proj_score1, proj_score2, importance1, importance2, score1, score2, xg1, xg2, nsxg1, nsxg2, adj_score1, adj_score2`. |
| Licence | « our data sets are available under the Creative Commons Attribution 4.0 International License » (README racine). |
| Arrêt | « As of June 13, 2023, sports predictions and forecasts are no longer being updated. » Dernier commit soccer-spi : 19 décembre 2022. Accessibilité effective des CSV : V3. |
| Usage | Référence de calibration externe 2016-2023, indépendante des bookmakers, avec un indicateur « importance » du match calculé, utile pour tester la famille « enjeu ». Pas de cotes. |

### A9. API-Football (api-sports.io)

| Champ | Contenu |
|---|---|
| URL | https://www.api-football.com (bloqué) |
| Plans (V3, extraits) | Gratuit : 100 requêtes/jour, tous endpoints (fixtures, compositions, événements, statistiques, blessures, « sidelined », cotes pré-match et en direct, prédictions). Pro 19 $/mois 7 500 req/jour ; Ultra 29 $/mois 75 000 ; Mega 39 $/mois 150 000. Prépaiement, arrêt à quota atteint. |
| Points d'alerte (V3, extrait de documentation) | « For some competitions, lineups are not available before the fixture and are instead updated and available after the match with a variable delay depending on the competition. » Profondeur de l'historique des cotes : aucune indication lue ; à considérer comme courte. Blessures : agrégation de sources publiques, qualité inconnue. |
| Usage | Source prospective principale pour compositions officielles et blessures, à condition de mesurer sur les cinq ligues l'heure réelle de publication des compositions avant coup d'envoi. **Inutilisable pour le backtest.** |

### A10. football-data.org

| Champ | Contenu |
|---|---|
| URL | https://www.football-data.org (bloqué) |
| Gratuit (V3, extraits) | 12 compétitions (Champions League, Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Eredivisie, Primeira Liga, Championship, Série A brésilienne, Coupe du monde, Euro), calendriers, résultats différés, classements, 10 requêtes/minute. Pas de compositions en gratuit. |
| Payant (V3) | Statistiques de match et cotes en suppléments d'environ 15 €/mois chacun ; pack « deep data » environ 29 €/mois. |
| Usage | Calendriers stables pour le pipeline prospectif. |

### A11. Transfermarkt

| Champ | Contenu |
|---|---|
| URL | https://www.transfermarkt.com (inaccessible) |
| Contenu (V3) | Valeurs marchandes, effectifs, blessures et suspensions par club avec dates, historique par joueur. |
| Conditions | **Non lues** ; aucune citation trouvée. Hypothèse de travail : accès automatisé non autorisé. |
| Usage | Consultation manuelle. Dates rétrospectives, sans horodatage d'annonce : inutilisable pour un backtest honnête des absences. |

### A12. Sofascore, WhoScored, Flashscore, FotMob

Conditions non lues (V3, extraits) : Sofascore/Torneo interdirait « robots or scripts, scraping, crawling » ; WhoScored : reproduction des statistiques « prohibited without an official licence » ; Flashscore : interdiction de copier ou télécharger le contenu. Pas d'API publique. **Exclus du pipeline.** Vérification manuelle seulement.

### A13. Fournisseurs professionnels

- **Opta / Stats Perform, StatsBomb (payant), Wyscout** : pas de tarif public, devis (V3). Stats Perform est fournisseur officiel de la LFP depuis 2016/17 (V3).
- **Sportmonks** (V2, copie des plans datée mai 2026 sur github.com/api-evangelist/sportmonks) : Free (Superliga danoise, Premiership écossaise) ; Starter 29 €/mois, 5 ligues au choix, 2 000 appels/entité/heure ; Growth 99 €/mois, 30 ligues ; Pro 249 €/mois, 120 ligues ; Enterprise sur devis avec « Historical Data ». Flux de cotes premium en option ; **historique des cotes conservé seulement « until 7 days after the match has started »** (V3). Donc pas de source d'historique long.

### A14. Sites officiels des ligues

Aucune API ouverte identifiée (V3). Communiqués officiels (suspensions, décisions disciplinaires, horaires) : source d'autorité à suivre par lecture assistée, avec horodatage de publication.

---

## B. Tennis

### B1. Dépôts de Jeff Sackmann (Tennis Abstract) : **indisponibles à la source au 2026-09-05** (V1)

| Champ | Contenu |
|---|---|
| URL | https://github.com/JeffSackmann/tennis_atp , /tennis_wta , /tennis_slam_pointbypoint : **HTTP 404** (github.com et raw.githubusercontent.com, plusieurs tentatives). Le profil https://github.com/JeffSackmann?tab=repositories n'affiche qu'un dépôt public, tennis_MatchChartingProject. Une issue de ce dépôt (28 avril 2026) demande sans réponse si le projet est encore maintenu. |
| Cause | Inconnue (suppression, passage en privé, renommage) (V3). |
| Contenu historique, d'après un fork de 2015 (github.com/stakah/tennis_atp, V2) | Résultats ATP « 1973 to 2015 » ; classements « mostly complete from 1983 through 2014 » ; trois fichiers par saison (tour principal, qualifications/Challengers, Futures) ; statistiques : « Tour-level statistics cover 1991 onward; challenger events from 2008 forward; and tour-level qualifying from 2011 forward ». |
| Licence (V2, fork et V1 sur le Match Charting Project) | « licensed under a Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License … Attribution is required. Non-commercial use only. » |
| Alternatives lues (V1) | **TML-Database** (https://github.com/Tennismylife/TML-Database) : matchs ATP 1968-2025, « updated daily or more frequently », « based on Jeff Sackmann's work », CC BY-NC-SA, sources déclarées « ATP official website, newspapers, blogs, and other tennis stats sites ». **github.com/jameswmiller/ATP_project** : copie des données Sackmann du 1er janvier 1991 au 7 août 2023. Fiabilité et complétude de ces copies : non auditées. |
| Match Charting Project (V1) | Dépôt actif (mise à jour 25 mai 2026) ; « shot-by-shot data for every point of a match » ; « over 5,000 matches » dans le README (chiffre ancien) ; échantillon non exhaustif choisi par les bénévoles ; licence CC BY-NC-SA 4.0 avec avertissement : « If violations continue, I may stop updating the repo entirely. » |
| Conséquence | La base de référence gratuite du tennis n'est plus disponible à la source. Un projet tennis dépendrait de copies non maintenues officiellement, ou d'une API payante. **Cela pèse contre le tennis comme premier sport.** |

### B2. Tennis-Data.co.uk

| Champ | Contenu |
|---|---|
| URL | http://www.tennis-data.co.uk/alldata.php ; notes.txt (bloqués) |
| Organisme | Même éditeur que Football-Data.co.uk (V3) |
| Couverture (V3) | ATP depuis 2000 ou 2001, WTA depuis 2007 ; un fichier par saison (xls/csv). |
| Variables (V2, colonnes relevées dans des dépôts tiers utilisant ces fichiers) | Tournoi, date, série, surface, intérieur/extérieur, tour, format, vainqueur, perdant, classements et points, scores par set `W1..W5/L1..L5`, `Wsets/Lsets`, `Comment` (« Completed », « Retired », « Walkover »), cotes `B365W/L, EXW/L, LBW/L, SJW/L, UBW/L, PSW/L, MaxW/L, MinW/L, AvgW/L` (42 colonnes dans une version). Max/Avg d'après Oddsportal (V3). |
| Horodatage | Un seul jeu de cotes, sans heure documentée (V3). Pas de CLV calculable. |
| Licence | Non identifiée (V3). |
| Historique exploitable | Probablement oui pour le marché vainqueur, sous les réserves ci-dessus. |

### B3. ATP, WTA, ITF

Conditions non lues. Extraits (V3) : ATP interdirait la « systematic retrieval of data or other Content from the Website, including but not limited to scores, statistics, and/or rankings … absent prior express written permission » ; WTA interdirait les « automated means to access the WTA Sites ». ITF : le « Tennis Open Data Standards (TODS) » est un standard d'échange, pas un jeu de données ouvert (V3). Annonces de forfaits publiées en actualités sur atptour.com (V3). Aucune API publique identifiée.

### B4. Ultimate Tennis Statistics / tennis-crystal-ball (V1)

Code Apache 2.0, algorithmes CC BY-NC-SA 4.0 ; Elo hebdomadaires « overall, by surface, outdoor or indoor, set or game » ; base Docker figée à la saison 2019 et dépendante du dépôt Sackmann désormais indisponible. Référence de méthode, pas source de données.

### B5. Règles de règlement en cas d'abandon

Pages officielles non lues. Extraits (V3) : Pinnacle, « At least one full set of the match must be completed for Money Line bets to stand » ; Betfair Exchange, « If less than one set has been completed at the time of the retirement … all bets … will be void » ; Betfair Sportsbook, remboursement intégral sur ITF/UTR/exhibitions quel que soit le moment. Bet365, Unibet, Winamax : non vérifiés. Ordre de grandeur : 3,30 % d'abandons et 0,43 % de forfaits ou disqualifications sur 584 806 matchs ATP 1978-2019 (PLOS ONE 2024, V2). Tant que la règle de chaque opérateur simulé n'est pas documentée, aucune simulation tennis n'est valide.

### B6. APIs tennis payantes

Sportradar (essai 30 jours, tarif non public, historique « current season plus the two previous seasons ») ; api-tennis.com (environ 120 $/mois) ; offres RapidAPI de 10 à 100 $/mois. Tout V3. Historique de cotes : non confirmé pour aucune.

---

## C. Cotes : historique et temps réel

### C1. The Odds API

| Champ | Contenu |
|---|---|
| URL | https://the-odds-api.com (bloqué) ; code officiel lu : https://github.com/the-odds-api/samples-python (V1) |
| Comptage (V1, code officiel) | « The usage quota cost = [number of markets specified] x [number of regions specified] » ; historique : « 10 x [number of markets specified] x [number of regions specified] ». Régions `uk, us, us2, eu, au` ; marchés de l'endpoint standard `h2h, spreads, totals`. |
| Historique (V1 partiel) | « Historical odds are only available on paid usage plans. » Documentation tierce (paquet R oddsapiR, V2) : marchés principaux « back to June 2020 », marchés additionnels depuis le 3 mai 2023 à 5 minutes. Extrait (V3) : instantanés toutes les 10 minutes depuis le 6 juin 2020, toutes les 5 minutes depuis septembre 2022. |
| Tarifs (V3) | Gratuit 500 crédits/mois ; 20 000 crédits 30 $/mois ; 100 000 crédits 59 $/mois ; 5 M 119 $/mois ; 15 M 249 $/mois. |
| Bookmakers région `eu` (V3) | Extraits citant 1xBet, 888sport, Betsson, Coolbet, Matchbook, NordicBet, Pinnacle, Suprabets, Betclic, William Hill. **Winamax, ParionsSport, PMU : absents de tous les extraits.** Couverture des opérateurs français non confirmée, probablement très partielle. |
| Usage | Cotes courantes pour le paper trading, dont Pinnacle. Historique horodaté payant : seule source identifiée pour reconstituer une CLV à J-2 sur 2020-2026. Ne remplace pas la collecte des cotes des opérateurs français. |

### C2. Pinnacle (V1 pour l'API)

- **API** (https://github.com/pinnacleapi/pinnacleapi-documentation) : « Access to Pinnacle API suite has been closed for the general public since July 23rd, 2025. » Accès réservé à « select high value bettors & commercial partnerships », avec un soutien annoncé aux « academics and pregame handicapping projects » sur demande à api@pinnacle.com ; compte approvisionné requis ; deux adresses IP maximum ; cotes limitées à « 1 request per 2 minutes, per endpoint, per sportId ». **Aucun endpoint d'historique documenté.**
- **Marge** : Pinnacle annonce 2 % sur le 1N2 de Premier League contre 6 % pour le secteur (V3, article non lu) ; mesures indépendantes récentes 2 à 4 % (V3).
- **Accès depuis la France** : Pinnacle n'apparaît dans aucun extrait de la liste des opérateurs agréés ANJ (V3).
- **Cotes historiques Pinnacle** : disponibles indirectement via Football-Data (`PSH/PSD/PSA`, `PSCH/PSCD/PSCA`, `P>2.5`, `PAHH`) et Tennis-Data (`PSW/PSL`). C'est la voie retenue.

### C3. Betfair Exchange, données historiques (V1 via le guide Betfair Australie sur GitHub)

| Champ | Contenu |
|---|---|
| URL | https://historicdata.betfair.com (bloqué) ; guide lu : dépôt betfair-datascientists.github.io |
| Niveaux | BASIC : « 1 minute intervals », « last traded price », « no volume », gratuit. ADVANCED : « 1 second intervals », « price ladder (top 3) », « volume », payant. PRO : « API tick intervals (50ms) », « price ladder (full) », payant. Prix non lus (V3). |
| Couverture | « complete historic data for nearly all markets offered on the Exchange since 2016 ». Archives TAR/bz2 par marché, filtres sport, dates, type de marché, pays. « You can only 'purchase' each time period of data once. » |
| Accès | Compte Betfair requis (V3). Betfair n'accepte pas les résidents français d'après des sources tierces (V3 ; aucune page officielle lue) ; pas d'agrément ANJ pour l'Exchange (V3). |
| API Exchange (V1 partiel) | Clé « delayed » gratuite (délai 1 à 180 s, sans volumes) ; clé « live » à activer, frais uniques annoncés à 299 £ ou 499 £ selon les extraits (V3, contradictoires). |
| Usage | Référence de probabilité alternative à Pinnacle (marché à commission), gratuite au niveau BASIC. Ingestion lourde. Phase 2. |

### C4. OddsPortal, BetExplorer, Oddschecker

Conditions non lues. Extraits (V3) : OddsPortal et BetExplorer interdiraient « scraping or recreating [content] without express consent » et la charge du serveur « with automated requests ». Pas d'API. **Exclus.** Football-Data en dérive ses colonnes Max/Avg, ce qui suffit.

### C5. Agrégateurs professionnels

OpticOdds (tarif sur devis, historique complet des mouvements, « 200+ sportsbooks »), SportsDataIO (essai avec données brouillées, production sur devis, « closing lines »), Sportmonks (voir A13, historique J+7). Tout V3. Non nécessaires avant un paper trading avancé.

### C6. Cotes des opérateurs agréés en France

**Aucune source historique publique identifiée.** Liste des opérateurs agréés (V3, extrait de la page ANJ « opérateurs agréés ») : betclic.fr, bet365.fr, betsson.fr, bwin.fr, circusbet.fr, feelingbet.fr, france-pari.fr, genybet.fr, netbet.fr, olybet.fr, parionsweb.fr, partouchesport.fr, pmu.fr, pokerstarssports.fr, unibet.fr, vbet.fr, winamax.fr, zebet.fr, et d'autres selon la date. Pinnacle et Betfair absents. Aucune API ni archive : la seule voie est la **collecte propre** à heures fixes dès le début du paper trading, dans le respect des conditions de chaque site.

Contexte réglementaire (V2, anj.fr et Légifrance via extraits concordants) : TRJ en ligne plafonné à 85 % en moyenne annuelle par agrément (décret n° 2020-1349, art. 27) ; neuf opérateurs sanctionnés en octobre 2024 pour dépassement sur 2022. Conséquence : marge moyenne d'au moins 15 % sur l'offre globale d'un opérateur, répartie de façon inégale entre marchés (V3 pour la répartition). L'ANJ publie des bilans de marché en PDF et quelques jeux sur data.gouv.fr, dont un « top 100 des rencontres les plus pariées » (V3).

### C7. Kaggle « Beat The Bookie » (V1 pour le dépôt source)

https://github.com/Lisandro79/BeatTheBookie : « Closing odds » pour 880 494 matchs du 1er janvier 2000 au 6 septembre 2015 (912 ligues, 32 bookmakers), séries de cotes horaires 72 h avant le match pour 31 074 matchs (sept. 2015 à mars 2016) et 82 786 matchs (mars à nov. 2016). **Aucune licence dans le README.** Intérêt : seul jeu gratuit identifié avec des séries de cotes intra-semaine, utilisable pour étudier la dynamique ouverture → clôture sur 2015-2016, pas pour la production.

---

## D. Contexte : météo, lieux, arbitres, calendriers

### D1. Open-Meteo (V1, code source du site officiel)

| Champ | Contenu |
|---|---|
| URL | https://open-meteo.com ; archive : /en/docs/historical-weather-api |
| Conditions | « You may only use the free API services for non-commercial purposes. » Exemples admis : sites privés sans abonnement ni publicité, domotique, recherche publique, éducation. Quotas : « 600 calls / min », « 5.000 calls / hour », « 10.000 calls / day », « 300.000 calls / month ». |
| Archive | ERA5 depuis 1940, 0,25°, horaire, « Daily with 5 days delay » ; ERA5-Land depuis 1950, 0,1° ; ECMWF IFS 9 km depuis 2017 ; CERRA 5 km Europe 1985 à juin 2021. Variables : température, humidité, précipitations, vent, rayonnement, neige. |
| Licence | « API data are offered under Attribution 4.0 International (CC BY 4.0) » ; attribution « Weather data by Open-Meteo.com ». Code AGPLv3. |
| Usage | Météo au stade à l'heure du coup d'envoi, historique et prospectif. Réanalyse sur grille, pas de station : précision suffisante pour pluie/vent/température, pas pour l'état du terrain. |

### D2. Meteostat (V1, dépôt de documentation)

Données de stations (NOAA, DWD), bibliothèque Python. **Licence contradictoire dans les documents de l'éditeur** : CC BY 4.0 sur la page licence et le README Python, CC BY-NC 4.0 dans la FAQ et le README du serveur. À clarifier avec l'éditeur avant tout usage autre que personnel. Non nécessaire si Open-Meteo suffit.

### D3. Wikidata et OpenStreetMap

OSM (V1, fichier de locales du site officiel) : « OpenStreetMap is open data, licensed under the Open Data Commons Open Database License (ODbL) », attribution « © OpenStreetMap contributors », partage à l'identique des bases dérivées. Wikidata : CC0 pour les données structurées (V3, page bloquée). Usage : coordonnées et capacité des stades, avec table stade × saison × club.

### D4. Arbitres

Colonne `Referee` de Football-Data (V2 ; ligues couvertes à vérifier). Sites de statistiques d'arbitres : conditions à lire (V3). Échantillons petits.

### D5. Calendriers européens et internationaux

openfootball (A5, CC0) et football-data.org (A10) suffisent pour calculer repos et enchaînements ; UEFA et FIFA sans API ouverte (V3).

---

## E. Textes, annonces, réseaux sociaux

Sources pour l'extraction assistée par IA. Règles : conserver URL, auteur, date de publication et date d'ingestion ; étiqueter *officiel* (club, ligue, fédération), *presse* (média et journaliste identifiés) ou *rumeur*. Une rumeur ne modifie jamais une probabilité ; elle peut déclencher une vérification.

- Sites et comptes officiels des clubs : blessures, compositions à H-1.
- Communiqués des ligues : suspensions, commissions de discipline.
- Presse sportive : compositions probables, à traiter comme estimation signée.
- Réseaux sociaux : accès API payant ou restreint (V3) ; hors périmètre P0.

---

## F. Synthèse : ce que le MVP utilisera

| Besoin | Source retenue | Statut | Coût |
|---|---|---|---|
| Résultats, statistiques, cotes historiques (dont Pinnacle et clôture) | Football-Data.co.uk | V2 | 0 |
| xG | Understat (extraction lente, cache, arrêt si conditions contraires) | V3 | 0 |
| Calendriers prospectifs | football-data.org gratuit, openfootball | V3 / V1 | 0 |
| Cotes courantes pour paper trading | The Odds API | V1 partiel | 0 puis ~30 $/mois |
| Météo | Open-Meteo | V1 | 0 |
| Coordonnées des stades | OSM (ODbL) / Wikidata | V1 / V3 | 0 |
| Compositions et blessures prospectives | API-Football | V3 | 0 puis 19 $/mois |
| Cotes des opérateurs français | Collecte propre | : | temps humain |
| Calibration externe et indice d'enjeu | FiveThirtyEight SPI 2016-2023 | V1 | 0 |
| Événementiel pour R&D xG | StatsBomb Open Data | V1 | 0, non commercial |
| Tennis (phase 2) | Tennis-Data + copie TML-Database, à auditer | V3 / V1 | 0, non commercial |

## G. Vérifications à refaire hors de cet environnement

Domaines bloqués le 2026-09-05 : football-data.co.uk, tennis-data.co.uk, understat.com, fbref.com, sports-reference.com, api-football.com, api-sports.io, football-data.org, kaggle.com, clubelo.com, transfermarkt.*, sofascore.com, whoscored.com, flashscore.*, sportmonks.com, statsbomb.com, hudl.com, wyscout.com, statsperform.com, ligue1.com, lfp.fr, tennisabstract.com, atptour.com, wta.com, itftennis.com, the-odds-api.com, pinnacle.com, betfair.com et sous-domaines, oddsportal.com, betexplorer.com, open-meteo.com, meteostat.net, wikidata.org, openstreetmap.org, anj.fr, data.gouv.fr, legifrance.gouv.fr, web.archive.org.

À relire en priorité avant P0, dans cet ordre :

1. Football-Data : data.php (ligues, saisons), matches.php (bookmakers courants, fichier des rencontres à venir), saison d'apparition des colonnes de clôture, présence de `Referee` par ligue.
2. Understat : existence de conditions d'utilisation.
3. The Odds API : tarifs, liste des bookmakers région `eu`, date de début et pas des instantanés historiques.
4. ANJ : liste des opérateurs agréés à jour et règles de règlement de chacun (football : report ; tennis : abandon).
5. API-Football : profondeur de l'historique des cotes et des blessures, heure de publication des compositions par ligue.
6. Transfermarkt : conditions d'utilisation.
7. Sackmann : statut des dépôts tennis_atp et tennis_wta ; audit d'une copie (TML-Database) si le tennis est engagé.
8. Betfair : prix des niveaux ADVANCED/PRO et éligibilité des résidents français.
9. Wikidata : licence CC0 (page « Wikidata:Licensing »).
