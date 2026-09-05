# Étude de faisabilité : analyse statistique des paris sportifs

Livrable 1 sur 10. Rédigé le 2026-09-05. Statut : version initiale, à réviser après le prototype P0.

Convention de confiance utilisée dans ce document : **élevée** (fait vérifié sur la source primaire ou résultat académique publié), **modérée** (cohérent avec plusieurs sources secondaires, non relu sur la source primaire), **faible** (estimation de l'équipe, à mesurer).

---

## 0. Résumé et recommandation

**Recommandation : commencer par le football, pas par le tennis.** Confiance modérée. Le tennis est plus simple à modéliser, mais le football offre le seul jeu de données gratuit qui combine, sur plus de dix saisons et pour les mêmes rencontres, des cotes horodatées de plusieurs bookmakers (dont des cotes de clôture), des statistiques de match et des xG. C'est cette combinaison qui permet de tester sérieusement la question posée (« existe-t-il un avantage mesurable ? ») et non seulement de prédire des résultats.

**Périmètre MVP proposé :** les cinq grands championnats européens (Angleterre, Espagne, Allemagne, Italie, France), deux marchés seulement : résultat 1N2 et total de buts plus/moins 2,5. Les handicaps asiatiques viennent en phase 2. Les combinés sont hors périmètre tant que les paris simples n'ont pas prouvé quelque chose.

**Ce que l'étude conclut sans ambiguïté :**

1. La référence à battre n'est pas « le résultat du match » mais **la cote de clôture de Pinnacle, marge retirée**. La littérature (Buchdahl, Štrumbelj) et l'expérience des parieurs professionnels convergent : cette cote est l'estimateur public le plus précis des probabilités réelles. Un modèle qui ne s'en approche pas n'a aucune chance de gagner de l'argent chez un bookmaker.
2. **Le contexte réglementaire français est la contrainte dominante.** Le taux de retour aux joueurs (TRJ) des opérateurs de paris sportifs en ligne agréés par l'ANJ est plafonné à 85 % en moyenne annuelle (décret n° 2020-1349, art. 27 ; confiance élevée, vérifié sur anj.fr). Cela signifie une marge moyenne d'au moins 15 % sur l'ensemble de l'offre, contre 2 à 4 % chez Pinnacle sur le 1N2 (Pinnacle annonce lui-même 2 % sur la Premier League contre 6 % en moyenne dans le secteur ; confiance modérée). Pinnacle et Betfair Exchange ne sont pas agréés en France. Tout backtest doit donc être exécuté **deux fois** : contre des cotes « marché efficient » (Pinnacle, Max) pour mesurer la qualité du modèle, et contre des cotes de type « opérateur français » pour mesurer ce qu'un parieur résidant en France pourrait réellement obtenir. Il est très probable que la seconde simulation soit négative même si la première est légèrement positive.
3. Le facteur qui a le plus de chances de contenir de l'information non encore intégrée dans les cotes (compositions et absences annoncées tardivement) est aussi celui dont **aucun historique gratuit horodaté n'existe**. Il ne pourra donc être évalué qu'en paris fictifs prospectifs, jamais en backtest. Il faut l'accepter dès maintenant.
4. Multiplier les variables n'améliorera pas les résultats par défaut. Le protocole impose que chaque famille de variables soit ajoutée une par une et démontre un gain de log-loss hors échantillon **et** un gain de rendement simulé contre la cote de clôture. Sans les deux, elle est retirée.

**Ce que l'étude ne promet pas :** aucun gain, aucune rentabilité, aucun système. La sortie la plus probable du prototype P0 est « le modèle est calibré mais ne bat pas la cote de clôture ». C'est un résultat utile : il permet d'arrêter à moindre coût.

---

## 1. Cadre de travail et définitions

### 1.1 Ce que « avantage statistique » veut dire ici

Un pari a une espérance positive si `p_modèle × cote > 1`, où `p_modèle` est la probabilité réelle de l'issue. Le problème est que `p_modèle` est inconnue ; on ne dispose que d'une estimation bruitée. Deux erreurs classiques :

- Confondre **précision de prédiction** (taux de bons pronostics) et **valeur**. Un modèle qui prédit 55 % des 1N2 n'a aucune valeur si les cotes reflètent déjà ces 55 %. Inversement, un modèle qui n'améliore la log-loss que de 0,5 % par rapport au marché peut être rentable s'il identifie où le marché se trompe.
- Confondre **biais de sélection** et **avantage**. Quand on ne parie que sur les issues où le modèle donne une cote théorique inférieure à la cote du marché, on sélectionne mécaniquement les cas où le modèle surestime la probabilité (erreur du modèle) autant que ceux où le marché la sous-estime (erreur du marché). C'est le « winner's curse » des paris à valeur. La seule protection est un échantillon test intact et une phase de paris fictifs prospectifs.

### 1.2 La référence : cote de clôture, marge retirée

Le prix de clôture (dernière cote avant le coup d'envoi) intègre toute l'information publique et les mises des parieurs les mieux informés. Chez Pinnacle, qui accepte les gagnants et ajuste ses prix par les volumes, la cote de clôture débarrassée de sa marge est un estimateur de probabilité difficile à améliorer (Buchdahl, *The Wisdom of the Crowd*, disponible sur football-data.co.uk ; confiance élevée quant à l'existence et la thèse du document, la page étant bloquée par le réseau au moment de la rédaction, les chiffres n'ont pas été relus).

Conséquences pratiques :

- **Métrique primaire de valeur : la CLV (closing line value).** Pour chaque pari fictif, rapport entre la cote obtenue et la cote de clôture équitable. Une stratégie qui obtient systématiquement des cotes supérieures à la clôture a un avantage, même si son bilan à court terme est négatif. Une stratégie rentable sans CLV positive est presque toujours de la chance.
- **Métrique primaire de modèle : log-loss et Brier contre la clôture Pinnacle**, pas seulement contre le résultat. Le modèle doit d'abord se rapprocher du marché, ensuite s'en écarter là où il a raison.

### 1.3 Retrait de la marge

Trois méthodes, à implémenter toutes et à comparer :

1. **Normalisation multiplicative** : `p_i = (1/c_i) / Σ(1/c_j)`. Simple, biaisée : elle attribue la marge proportionnellement et surestime les outsiders.
2. **Méthode de Shin (1993)** : suppose que la marge provient en partie de parieurs informés et corrige le biais favori-outsider. Štrumbelj (2014, *International Journal of Forecasting* 30, p. 934-943) montre sur données réelles que les probabilités issues de Shin sont de meilleures prévisions que la normalisation ou les régressions (confiance élevée).
3. **Méthode « power » / logarithmique** : `p_i = (1/c_i)^k` avec `k` tel que la somme fasse 1. Comportement proche de Shin, plus simple.

Le choix de méthode change l'espérance calculée de plusieurs points de pourcentage sur les outsiders. Toute espérance affichée dans l'application doit indiquer la méthode utilisée.

### 1.4 Ce qui n'est pas dans le périmètre

Paris en direct, exécution automatique, arbitrage entre bookmakers, marchés joueurs (buteur, passeur), sports autres que football et tennis.

---

## 2. Comparaison football / tennis

### 2.1 Grille

Notation de 1 (défavorable) à 5 (favorable) pour le projet tel que défini. Le poids reflète l'importance du critère pour tester l'existence d'un avantage, pas pour construire une application agréable.

| Critère | Poids | Football | Tennis | Commentaire |
|---|---|---|---|---|
| Historique de cotes gratuit, aligné avec les résultats | 5 | 5 | 4 | Football : football-data.co.uk, ~25 saisons, plusieurs bookmakers, cotes de clôture depuis la saison 2019/20 (confiance modérée sur la saison exacte), marchés 1N2, O/U 2,5, handicap asiatique. Tennis : tennis-data.co.uk, ATP depuis 2001 et WTA depuis 2007 (confiance modérée), un seul jeu de cotes par match, marché vainqueur uniquement. |
| Cotes accessibles pour le paper trading (prospectif) | 4 | 4 | 4 | The Odds API (gratuit limité) couvre les deux ; football-data publie un fichier de cotes des rencontres à venir. |
| Statistiques de performance gratuites au-delà du score | 4 | 5 | 2 | Football : tirs, cadrés, corners, cartons depuis 2000/01 ; xG et tirs géolocalisés depuis 2014/15 sur 6 ligues (Understat). Tennis : les statistiques de service depuis 1991 venaient des dépôts de Jeff Sackmann, qui **renvoient 404 au 2026-09-05** (vérifié) ; il ne reste que des copies tierces non auditées (TML-Database, forks) et rien sur la qualité du point. |
| Données d'effectif / disponibilité des joueurs | 4 | 2 | 1 | Football : compositions officielles ~1 h avant, blessures via sources semi-structurées (Transfermarkt, scraping interdit par ses CGU, à vérifier), pas d'historique horodaté gratuit. Tennis : forfaits et blessures non structurés, découverts souvent à l'annonce du tableau ou au jour même. |
| Simplicité du modèle de référence | 3 | 3 | 5 | Tennis : deux issues, Elo par surface atteint le niveau des bookmakers sur les têtes de série (Kovalchik 2016). Football : trois issues, dépendance des scores (Dixon-Coles 1997), nul structurellement mal calibré. |
| Volume de rencontres par an dans le périmètre | 3 | 3 | 5 | Football 5 ligues : 1 752 matchs/saison (3×380 + 2×306). Tennis ATP tour principal : ~2 400 à 2 900 simples/an, plus WTA et Challengers. |
| Règles de règlement des paris | 3 | 5 | 2 | Football : quasi aucune ambiguïté (hors report). Tennis : 3,3 % des matchs ATP se terminent par abandon (Gallo-Salazar et al., PLOS ONE 2024, base 1978-2019 ; confiance élevée), et les règles de remboursement diffèrent selon l'opérateur. |
| Efficacité présumée du marché (plus c'est inefficace, mieux c'est) | 4 | 2 | 3 | Les deux sont très efficaces au niveau élite. Le tennis présente un biais favori-outsider documenté (Forrest & McHale 2007). Les marchés secondaires du football (O/U, handicaps, ligues inférieures) sont réputés moins efficaces mais avec des limites de mise faibles. |
| Documentation académique des modèles | 2 | 5 | 4 | Football : Dixon-Coles, Elo (Hvattum & Arntzen 2010), ratings issus des cotes (Wunderlich & Memmert 2018), challenge MLJ 2017 (Hubáček et al. 2019). Tennis : Kovalchik 2016, modèles hiérarchiques point-jeu-set. |
| Coût d'entrée en données payantes si nécessaire | 2 | 3 | 3 | Comparable. Historiques de cotes horodatées : payants dans les deux cas. |
| Pertinence de l'inventaire de variables déjà rédigé par le commanditaire | 1 | 5 | 3 | La liste des variables fournie est nettement plus mûre pour le football. |
| **Total pondéré (sur 175)** | | **131** | **113** | L'écart vient surtout de la disponibilité des données d'effectif, des règles de règlement et de la disparition de la source tennis de référence. La décision reste dictée par les deux critères les plus lourds, pas par le total. |

### 2.2 Lecture

L'argument le plus fort **en faveur du tennis**, qu'il faut énoncer avant de l'écarter : le tennis est un sport où le modèle peut être entièrement spécifié à partir de données gratuites (résultats, statistiques de service, classements, cotes) et où l'absence de « team news » pèse moins. Un Elo par surface bien réglé est au niveau des bookmakers pour les matchs des mieux classés. On pourrait donc tester la thèse « le modèle bat-il le marché ? » plus vite et plus proprement. Si l'objectif était de produire une preuve de concept académique, le tennis serait le bon choix.

Pourquoi le football l'emporte quand même pour ce projet :

1. **La question posée est celle de l'avantage face aux cotes, sur plusieurs marchés.** Seul le football offre gratuitement, pour une même rencontre, des cotes d'ouverture approchées (collectées le vendredi ou le mardi) **et** de clôture, sur trois marchés. Cela permet de mesurer la CLV en backtest, ce que le tennis ne permet pas avec un seul jeu de cotes non horodaté.
2. **Les xG changent la nature du signal.** Une équipe qui perd en créant 2,5 xG contre 0,4 a été malchanceuse ; le marché le sait aussi, mais l'ampleur de la correction est mesurable. Le tennis n'a pas d'équivalent gratuit du xG (les statistiques de service sont agrégées par match, sans qualité du point).
3. **Les abandons au tennis introduisent un bruit de règlement de 3 à 4 % des matchs** qui dépasse l'ordre de grandeur de l'avantage recherché (1 à 3 % de rendement). Il faut modéliser la probabilité d'abandon et les règles de chaque opérateur avant de pouvoir simuler quoi que ce soit.
4. **Les marchés secondaires du football (totaux, handicaps) sont le lieu le plus plausible d'un avantage résiduel** avec des données publiques ; le tennis n'offre gratuitement que le marché vainqueur.

Fait aggravant apparu pendant la vérification : les trois dépôts de données de Jeff Sackmann (résultats et statistiques ATP et WTA, point par point des Grands Chelems) ne sont plus accessibles publiquement au 2026-09-05, et son profil GitHub ne liste plus que le Match Charting Project. Toute étude tennis reposerait sur des copies dont la maintenance et la conformité à la licence CC BY-NC-SA ne sont pas garanties. Confiance élevée sur le constat, inconnue sur sa cause et sa durée.

Ce qui ferait basculer la décision : si le prototype P0 montre que le modèle football ne parvient pas à approcher la log-loss de la clôture à moins de 2 % après ablation complète, il sera plus économique de passer au tennis (Elo par surface) qu'à des données football payantes.

### 2.3 Ce que le tennis garderait comme rôle

Phase 2, après un verdict sur le football. Le moteur Elo/logistique et le protocole de backtest sont réutilisables presque tels quels. Les marchés handicap de jeux et totaux de jeux nécessiteraient un modèle hiérarchique point → jeu → set → match qui, lui, n'a de sens qu'avec des probabilités de point au service fiables par surface.

---

## 3. Gratuit ou payant : ce qui est réellement possible

### 3.1 Réalisable avec des données gratuites (confiance élevée sauf mention)

- Backtest complet 1N2 et O/U 2,5 sur les 5 grandes ligues, saisons 2014/15 à 2025/26, avec cotes Bet365, Pinnacle, moyenne et maximum du marché, et cotes de clôture sur les saisons récentes.
- Modèles Elo, Dixon-Coles, régression sur xG et statistiques de tirs, ratings dérivés des cotes.
- Variables de contexte dérivables du calendrier seul : jours de repos, enchaînement de matchs, matchs européens en semaine (à partir des calendriers UEFA publics), moment de la saison, enjeu de classement calculé.
- Météo historique par stade (Open-Meteo, archive ERA5 depuis 1940 ; conditions vérifiées sur le code source du site : usage non commercial, 10 000 appels/jour, données CC BY 4.0 ; confiance élevée).
- Arbitre par match pour la Premier League (colonne Referee de football-data, disponibilité à confirmer ligue par ligue).
- Paper trading prospectif avec cotes courantes de plusieurs bookmakers via The Odds API (quota gratuit limité) et le fichier de rencontres à venir de football-data.

### 3.2 Nécessite un abonnement ou n'existe pas

- **Historique horodaté des cotes** (plusieurs instantanés entre ouverture et clôture) : payant (The Odds API plan historique, Betfair historic data, agrégateurs). Indispensable pour évaluer une stratégie qui parie à J-2 plutôt qu'à la clôture.
- **Historique horodaté des compositions probables et des annonces de blessure** : n'existe pas gratuitement sous forme exploitable. Les blessures sur Transfermarkt sont rétrospectives et sans horodatage de l'annonce.
- **Données événementielles complètes** (passes, pressing, positions) : Opta/Stats Perform, StatsBomb, Wyscout, tarifs sur devis. StatsBomb Open Data couvre des compétitions choisies, licence non commerciale.
- **Cotes des opérateurs français** en historique : aucune source publique connue. Il faudra les collecter soi-même dès le début du paper trading.
- **Compositions officielles en temps réel** : API-Football (freemium) ou équivalent ; le quota gratuit est insuffisant pour 5 ligues, et la documentation avertit que pour certaines compétitions les compositions ne sont publiées qu'après le match.
- **Cotes Pinnacle en direct** : l'API Pinnacle est « closed for the general public since July 23rd, 2025 » (documentation officielle, confiance élevée) ; un accès reste possible sur demande motivée pour des projets académiques ou de handicapping pré-match. Les cotes Pinnacle courantes passent donc par un agrégateur (The Odds API) et les historiques par Football-Data.

### 3.3 Coût indicatif du MVP en données

Zéro euro pour le backtest P0. De l'ordre de quelques dizaines d'euros par mois pour le paper trading si l'on veut plus de 500 requêtes de cotes par mois (chiffres exacts dans l'inventaire des sources, livrable 2). Les données événementielles payantes ne sont pas justifiées avant d'avoir prouvé que les variables gratuites laissent un résidu exploitable.

---

## 4. Limites structurelles à accepter

| Limite | Effet sur le projet | Réponse |
|---|---|---|
| Cotes de clôture gratuites seulement depuis ~2019/20 | La CLV ne peut être mesurée que sur 6 à 7 saisons | Utiliser les saisons antérieures pour l'entraînement des modèles de résultat, et les saisons avec clôture pour la mesure de valeur |
| Cotes « vendredi/mardi » sans heure exacte | L'horodatage de décision est approximatif | Traiter ces cotes comme « cote disponible à J-1/J-2 approximativement » ; ne jamais les présenter comme cote d'ouverture |
| Pas d'historique de compositions | La variable la plus prometteuse n'est pas backtestable | La tester uniquement en prospectif, avec horodatage strict de l'annonce et de la prédiction |
| Marge des opérateurs français ≥ 15 % en moyenne | Un avantage de 2 % contre Pinnacle devient une perte contre un opérateur français | Double simulation obligatoire ; afficher l'espérance par opérateur |
| Limites de mise et fermetures de compte chez les opérateurs | Le rendement simulé surestime le rendement réel | Plafonner les mises simulées ; documenter cette limite dans chaque rapport |
| xG hétérogènes entre fournisseurs (Understat vs Opta vs StatsBomb) | Les modèles ne sont pas transférables d'un fournisseur à l'autre | Un seul fournisseur par version de modèle ; version du fournisseur stockée avec chaque prédiction |
| Changements de règles (VAR, 5 remplacements, temps additionnel long depuis 2022) | Dérive des distributions de buts et de cartons | Fenêtres glissantes, pondération temporelle, test de stabilité par saison |
| Surapprentissage par multiplication des stratégies | Une stratégie sur vingt sera « rentable » par hasard | Registre pré-enregistré des hypothèses, correction pour tests multiples, échantillon final intact |
| Fraîcheur des données gratuites (publication J+1 pour les CSV) | Pas utilisable pour décider avant le match sans source complémentaire | Séparer le pipeline historique (CSV) du pipeline prospectif (API) et vérifier leur cohérence |

---

## 5. Protocole de validation des familles de variables

Ordre d'ajout imposé, du plus simple au plus coûteux. Une famille est conservée si, en walk-forward saison par saison, elle améliore la log-loss médiane contre le résultat **et** ne dégrade pas la log-loss contre la clôture Pinnacle **et** améliore la CLV simulée. Trois conditions, sinon retrait.

| Ordre | Famille | Source gratuite | Hypothèse testable |
|---|---|---|---|
| 0 | Marché seul (cote de clôture, marge retirée) | football-data | Référence. Tout ce qui suit doit la battre ou l'améliorer. |
| 1 | Résultats et buts (Elo, Dixon-Coles) | football-data | Le marché a déjà tout ça. Sert de plancher. |
| 2 | Tirs, tirs cadrés, xG | football-data, Understat | Les performances sous-jacentes corrigent la chance récente. Effet attendu : faible mais réel sur les totaux. |
| 3 | Calendrier : repos, enchaînement, match européen en semaine | Calendriers publics | La fatigue est déjà pricée pour les grands clubs ; peut-être pas pour les petits. |
| 4 | Enjeu : maintien, titre, qualification, calculés mathématiquement | Dérivé des classements | « Motivation » remplacé par des critères explicites (points nécessaires, nombre de matchs restants). |
| 5 | Arbitre (cartons, penalties) | football-data (PL), worldfootball | Utile pour cartons et penalties, presque nul pour le 1N2. Petits échantillons. |
| 6 | Météo et terrain | Open-Meteo | Pluie et vent réduisent les totaux ? Effet probablement marginal. |
| 7 | Compositions et absences | API payante ou collecte manuelle | Non backtestable. Prospectif uniquement. |
| 8 | Signaux textuels extraits par Claude (rumeurs, presse) | Presse, réseaux sociaux | Prospectif uniquement, avec étiquette « rumeur » ou « officiel ». |

Un modèle qui intègre la famille 0 comme variable (par exemple Elo calibré sur les cotes à la manière de Wunderlich & Memmert) est en général le meilleur en log-loss, mais il ne peut pas révéler d'avantage par construction s'il ne fait que reproduire le marché. Il faut donc toujours conserver une variante **sans cotes en entrée** et comparer les deux.

---

## 6. Le plus petit prototype capable de tester sérieusement l'idée (P0)

Objectif : répondre en trois à quatre semaines à une seule question. *Sur les 5 grandes ligues, saisons 2019/20 à 2025/26, un modèle construit uniquement sur des données gratuites obtient-il une CLV positive et un rendement simulé non négatif contre la cote maximale du marché, avec un intervalle de confiance qui exclut zéro ?*

### 6.1 Contenu

1. **Ingestion** : CSV football-data (5 ligues, 2000/01 à aujourd'hui), xG Understat (6 ligues, 2014/15 à aujourd'hui) via un extracteur respectueux de leurs serveurs, table de correspondance des noms d'équipes vérifiée à la main.
2. **Modèles** : (a) probabilités du marché, marge retirée par Shin ; (b) Elo avec avantage domicile ; (c) Dixon-Coles avec décroissance temporelle ; (d) Dixon-Coles dont les intensités sont estimées sur xG plutôt que sur buts ; (e) régression logistique multinomiale sur les sorties de b, c, d.
3. **Protocole** : entraînement sur toutes les saisons antérieures, prédiction saison par saison en walk-forward, aucune donnée postérieure au coup d'envoi. Saison 2025/26 mise sous scellés jusqu'à la fin.
4. **Métriques** : log-loss et Brier contre résultat et contre clôture ; calibration par déciles ; rendement à mise fixe et à mise Kelly fractionnaire (1/8) contre Bet365, Pinnacle, Max ; CLV ; drawdown maximal ; probabilité de perte à horizon 500 paris par bootstrap.
5. **Simulation « France »** : rendement recalculé avec une marge de 12 % appliquée à la cote équitable (hypothèse à remplacer par des cotes réellement collectées dès le paper trading).
6. **Sortie** : un rapport reproductible (notebook ou script) et une table de prédictions horodatées.

### 6.2 Critères de décision à l'issue de P0

- **Poursuivre** : CLV moyenne > 1,00 avec IC à 95 % excluant 1, sur au moins 300 paris sélectionnés par saison, et rendement à mise fixe contre Max non significativement négatif sur 3 saisons consécutives.
- **Corriger** : modèle calibré (log-loss à moins de 1 % de la clôture) mais CLV nulle. Ajouter une famille de variables (ordre du §5) et réitérer une fois.
- **Abandonner la voie « données gratuites »** : log-loss à plus de 3 % de la clôture après les familles 1 à 4. Décider entre tennis, données payantes, ou arrêt.

Ces seuils sont fixés avant de voir les résultats et ne seront pas déplacés après.

### 6.3 Ce que P0 n'inclut pas

Interface, base de données de production, intégration de Claude, tennis, combinés, cotes en temps réel. Tout cela n'a de sens que si P0 conclut « poursuivre » ou « corriger ».

---

## 7. Hypothèses explicites et questions bloquantes

### Hypothèses retenues sans confirmation

1. L'utilisateur final est un particulier résidant en France, qui n'a légalement accès qu'aux opérateurs agréés ANJ. Si l'utilisateur a accès à Pinnacle ou à un exchange, la conclusion sur la viabilité change fortement.
2. Le projet accepte un résultat négatif comme livrable valable.
3. Les données à usage non commercial (Sackmann, StatsBomb Open Data) sont utilisables parce que l'application est un outil personnel non commercialisé. Si l'application devait être vendue ou ouverte au public, plusieurs sources tombent.
4. Le scraping de sites dont les conditions l'interdisent est exclu ; les sites sans conditions explicites sont interrogés avec un délai de plusieurs secondes entre requêtes et un cache local.

### Questions réellement bloquantes

Une seule pour démarrer P0 : **l'application est-elle destinée à un usage strictement personnel, ou à être distribuée ?** La réponse détermine les licences utilisables et l'architecture (locale vs hébergée). En l'absence de réponse, P0 est mené sous l'hypothèse « usage personnel ».

Deux questions non bloquantes pour P0, bloquantes pour le MVP : chez quels opérateurs les cotes doivent-elles être collectées en paper trading ? Quel budget mensuel maximal pour les données ?

---

## 8. Références vérifiées

- Dixon M.J., Coles S.G. (1997). Modelling Association Football Scores and Inefficiencies in the Football Betting Market. *Journal of the Royal Statistical Society, Series C*, 46(2), 265-280.
- Hvattum L.M., Arntzen H. (2010). Using ELO ratings for match result prediction in association football. *International Journal of Forecasting*, 26(3), 460-470.
- Štrumbelj E. (2014). On determining probability forecasts from betting odds. *International Journal of Forecasting*, 30(4), 934-943.
- Kovalchik S. (2016). Searching for the GOAT of tennis win prediction. *Journal of Quantitative Analysis in Sports*, 12(3), 127-138. Onze modèles, 2 395 matchs ATP 2014 ; Elo (variante FiveThirtyEight) et régressions sur classement les plus précis ; 75 % de bons pronostics sur les mieux classés, comparable aux bookmakers.
- Forrest D., McHale I. (2007). Anyone for Tennis (Betting)? *European Journal of Finance*, 13(8), 751-768.
- Wunderlich F., Memmert D. (2018). The Betting Odds Rating System: Using soccer forecasts to forecast soccer. *PLoS ONE*, 13(6), e0198668.
- Hubáček O., Šourek G., Železný F. (2019). Learning to predict soccer results from relational data with gradient boosted trees. *Machine Learning*, 108, 29-47. Solution gagnante du Soccer Prediction Challenge 2017 ; 200 000+ matchs.
- Gallo-Salazar C. et al. (2024). Retirements of professional tennis players in second- and third-tier tournaments on the ATP and WTA tours. *PLoS ONE*. Base ATP : 584 806 matchs, 3,30 % d'abandons, 0,43 % de forfaits ou disqualifications.
- ANJ, *Les paris sportifs* et décision de la commission des sanctions du 1er octobre 2024 : plafond du TRJ à 85 % pour les paris sportifs en ligne, apprécié par agrément et par année civile.
- Buchdahl J., *Using the Wisdom of the Crowd to find value in a football match betting market*, football-data.co.uk (PDF). Existence vérifiée par recherche ; contenu non relu (accès réseau bloqué au moment de la rédaction). La méthode « power » de retrait de marge y est décrite sous le nom de méthode logarithmique (vérifié via la documentation du paquet R `implied`).
- Pinnacle, documentation officielle de l'API, https://github.com/pinnacleapi/pinnacleapi-documentation : fermeture au public depuis le 23 juillet 2025 (lu le 2026-09-05).
- Dépôts GitHub de Jeff Sackmann : tennis_atp, tennis_wta, tennis_slam_pointbypoint en erreur 404 le 2026-09-05 ; tennis_MatchChartingProject actif (dernière mise à jour 25 mai 2026), licence CC BY-NC-SA 4.0.
