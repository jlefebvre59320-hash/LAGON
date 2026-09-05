# Périmètre MVP

Livrable 3 sur 10. Rédigé le 2026-09-05. Dépend des conclusions du livrable 1 (football d'abord) et de l'inventaire du livrable 2.

## 1. Ce que le MVP est

Un outil personnel d'analyse et de simulation, en français, qui pour chaque rencontre du périmètre :

1. calcule des probabilités d'issues à partir d'un moteur statistique versionné ;
2. les compare aux cotes disponibles, marge retirée selon une méthode explicitée ;
3. affiche l'espérance de gain, l'incertitude, les facteurs principaux et les informations manquantes ;
4. enregistre chaque prédiction de façon immuable et horodatée avant le coup d'envoi ;
5. permet de simuler des stratégies de mise sur l'historique et sur un portefeuille fictif ;
6. sait conclure « aucun pari intéressant » et l'affiche comme un résultat normal.

Il n'exécute aucun pari, ne se connecte à aucun compte de bookmaker et ne promet rien.

## 2. Ce que le MVP n'est pas

Hors périmètre, sans exception jusqu'au verdict de P0 puis du paper trading :

- paris en direct et données en cours de match ;
- combinés et systèmes (la modélisation des dépendances entre sélections est un chantier de phase 2, conditionné aux résultats des paris simples) ;
- tennis et tout autre sport ;
- marchés joueurs (buteur, cartons par joueur), scores exacts, mi-temps ;
- exécution automatique, alertes push agressives, gestion multi-utilisateurs ;
- toute stratégie d'augmentation de mise après perte.

## 3. Périmètre sportif

| Dimension | Choix | Justification |
|---|---|---|
| Sport | Football masculin | Livrable 1 |
| Compétitions | Premier League, La Liga, Bundesliga, Serie A, Ligue 1 | Seules compétitions où xG (Understat), cotes multi-bookmakers avec clôture (Football-Data) et calendriers gratuits sont tous disponibles depuis 2014/15 |
| Extension possible en cours de MVP | Championship, Ligue 2, Bundesliga 2, Serie B, Segunda | Cotes disponibles, xG absent : utile pour tester si le modèle sans xG tient sur des marchés réputés moins efficaces. Décision après P0. |
| Saisons historiques | 2000/01 à 2025/26 pour les résultats et cotes ; 2014/15 à 2025/26 pour les xG | Disponibilité |
| Saison sous scellés | 2025/26 pour P0 ; glissante ensuite (toujours la dernière saison complète) | Protocole |
| Marchés | 1N2 ; plus/moins 2,5 buts | Cotes historiques de clôture disponibles pour les deux ; le second est le lieu le plus plausible d'un signal xG |
| Marché en phase 2 | Handicap asiatique (ligne principale) | Colonnes `AHh`, `PAHH/PAHA` disponibles depuis 2019/20 |
| Bookmakers de référence | Pinnacle (clôture) pour la vérité de marché ; Bet365, Max, Avg pour le rendement simulé | Colonnes Football-Data |
| Bookmakers cibles (paper trading) | 3 opérateurs agréés ANJ à choisir par l'utilisateur, plus Pinnacle via agrégateur comme témoin | Collecte propre |

## 4. Fonctionnalités du MVP

### 4.1 Moteur (Python, batch)

| Fonction | Contenu | Priorité |
|---|---|---|
| Ingestion historique | CSV Football-Data (résultats, stats, cotes), xG Understat, calendriers, météo, stades | P0 |
| Rapprochement | Table d'alias équipes et compétitions, validée à la main, avec journal des rapprochements | P0 |
| Modèles | Marché seul (Shin) ; Elo ; Dixon-Coles buts ; Dixon-Coles xG ; régression multinomiale d'ensemble | P0 |
| Backtest walk-forward | Entraînement glissant, prédiction saison par saison, aucune fuite | P0 |
| Métriques | Log-loss, Brier, calibration par déciles, CLV, rendement mise fixe et Kelly fractionnaire, drawdown, bootstrap | P0 |
| Registre d'hypothèses | Fichier versionné listant chaque variable et stratégie testée avant de l'exécuter | P0 |
| Prédictions prospectives | Génération quotidienne pour les matchs à J-3, J-1 et H-2, horodatées, immuables | MVP |
| Collecte de cotes courantes | The Odds API (Pinnacle témoin) ; saisie ou import des cotes des opérateurs français | MVP |
| Compositions et absences | API-Football, avec horodatage de publication mesuré | MVP, prospectif seulement |
| Portefeuille fictif | Mises simulées, limites de budget et d'exposition, journal immuable | MVP |
| Extraction assistée par Claude | Structuration d'annonces officielles et d'articles en événements horodatés, étiquetés officiel/presse/rumeur | MVP, dégradable |

### 4.2 Interface (Next.js, français)

| Écran | Contenu minimal | Priorité |
|---|---|---|
| Tableau de bord | Rencontres à venir du périmètre, verdict par match (« intéressant », « rien », « données insuffisantes »), filtres compétition, marché, qualité des données | MVP |
| Fiche rencontre | Probabilités et incertitude, cote théorique, cotes disponibles avec horodatage, probabilité implicite, espérance par bookmaker, facteurs principaux, informations manquantes, sources et dates | MVP |
| Comparaison modèle / marché | Graphique probabilité modèle contre probabilité implicite, historique de la cote | MVP |
| Simulateur | Choix d'une stratégie (seuil d'espérance, mise fixe ou Kelly fractionnaire, plafonds), exécution sur l'historique, courbe de capital, drawdown, probabilité de perte | MVP |
| Portefeuille fictif | Positions, budget restant, exposition, historique immuable | MVP |
| Suivi des performances | Calibration, log-loss vs marché, CLV, rendement, séries de pertes, par saison et par marché | MVP |
| Paramètres et limites | Budget, mise maximale, exposition maximale par match et par journée, méthode de retrait de marge | MVP |
| Journal des données | Dernière mise à jour par source, trous, alertes de qualité | MVP |

Aucune notification push dans le MVP. Une alerte sobre dans l'interface signale les matchs où le verdict est « intéressant » ; jamais de compte à rebours ni d'incitation.

## 5. Données et qualité

Chaque rencontre porte un **score de complétude** (0 à 100) calculé sur la présence des familles de données : résultats et cotes historiques des deux équipes sur 10 matchs, xG sur 10 matchs, cote de clôture ou cote courante datée de moins de 6 h, composition officielle, météo. En dessous d'un seuil (fixé à 60 pour P0), le verdict est « données insuffisantes » quel que soit le calcul.

Toute information stockée porte : source, URL ou fichier, date de publication, date de disponibilité pour le moteur, version de l'extracteur.

## 6. Contraintes non fonctionnelles

- **Reproductibilité** : un backtest se relance à l'identique à partir d'un identifiant de version de données et de modèle.
- **Immuabilité** : les prédictions et les mises fictives ne sont jamais modifiées ni supprimées ; une correction est une nouvelle ligne.
- **Fonctionnement dégradé** : sans Claude, sans API payante, sans réseau, le moteur produit des prédictions à partir des données locales et le signale.
- **Coûts** : chaque appel externe (API de données, Claude) est journalisé avec son coût.
- **Respect des sources** : délais entre requêtes, cache, arrêt en cas d'interdiction.
- **Langue** : interface et documents en français ; identifiants de code en anglais.

## 7. Jalons

| Jalon | Contenu | Critère de passage |
|---|---|---|
| P0 | Moteur et backtest sur données gratuites, sans interface | Verdict poursuivre / corriger / abandonner selon les seuils du livrable 1 §6.2 |
| M1 | Base de données, pipeline prospectif quotidien, prédictions horodatées, interface tableau de bord et fiche | 4 semaines de prédictions prospectives sans incident de fuite |
| M2 | Simulateur, portefeuille fictif, suivi des performances, collecte des cotes françaises | 3 mois de paper trading, au moins 200 paris fictifs, CLV mesurée |
| M3 | Extraction assistée par Claude, compositions et absences, score de complétude enrichi | Gain hors échantillon démontré ou retrait de la famille |
| Décision | Rapport de viabilité | Critères du livrable 10 |

## 8. Hypothèses et décisions en suspens

- Usage personnel, utilisateur résidant en France (hypothèse du livrable 1).
- La pile Next.js et Supabase déjà présente dans le dépôt est retenue pour l'interface et la base, avec un **projet Supabase distinct** de Ti Kanal (données et droits sans rapport). Le moteur est en Python.
- Les trois opérateurs agréés à suivre en paper trading restent à nommer par l'utilisateur ; par défaut, les trois plus gros par part de marché.
- Budget de données plafonné à 50 $/mois jusqu'au verdict M2.
