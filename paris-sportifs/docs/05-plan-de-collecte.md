# Plan de collecte, de nettoyage et de rapprochement

Livrable 5 sur 10. Rédigé le 2026-09-05.

## 1. Principes

1. **Le brut est conservé.** Chaque fichier ou réponse d'API est stocké tel quel (`raw/<source>/<date>/<nom>`), avec son empreinte SHA-256, l'URL, l'heure de téléchargement et la version de l'extracteur. Le nettoyage est rejouable ; le brut ne l'est pas.
2. **Deux horloges.** Chaque information porte `published_at` (quand elle a existé dans le monde) et `available_at` (quand le moteur l'a eue). Une prédiction horodatée `T` ne peut utiliser que des informations dont `available_at ≤ T`. C'est la seule règle anti-fuite qui tienne en pratique.
3. **Pipeline historique et pipeline prospectif séparés.** Le premier lit des fichiers publiés après les matchs ; le second interroge des API avant les matchs. Ils alimentent les mêmes tables, avec un champ `pipeline` qui permet de vérifier leur cohérence quand les deux existent pour un même match.
4. **Respect des sources.** Délai minimal entre requêtes, cache local, identification honnête (`User-Agent` avec contact), arrêt si une condition d'utilisation l'interdit.

## 2. Sources et cadences

| Source | Pipeline | Cadence | Déclencheur | Délai attendu | Volume |
|---|---|---|---|---|---|
| Football-Data CSV (5 ligues, saison courante) | Historique | 2 fois/semaine (mercredi, lundi) | Cron | J+1 à J+2 après les matchs | 5 fichiers de ~100 Ko |
| Football-Data CSV (saisons passées) | Historique | Une fois, puis à chaque changement d'empreinte | Manuel | : | ~125 fichiers |
| Understat (matchs, tirs) | Historique | Quotidien, la nuit | Cron | Soir du match ou J+1 | ~10 pages/jour, ≥ 6 s entre requêtes |
| football-data.org (calendrier) | Prospectif | Quotidien | Cron | Immédiat | 5 requêtes/jour |
| The Odds API (h2h, totals, région eu) | Prospectif | J-3 à 9 h, J-1 à 9 h, H-2 | Cron | Immédiat | 2 marchés × 1 région = 2 crédits par appel et par sport ; ~180 crédits/mois pour 5 ligues à 3 relevés |
| Cotes opérateurs français | Prospectif | Mêmes heures | Saisie ou import manuel (P0/M1), agrégateur sous contrat plus tard | Immédiat | 3 opérateurs × 2 marchés × ~20 matchs/semaine |
| API-Football (compositions, blessures) | Prospectif | Blessures : quotidien ; compositions : H-1, H-0:30 | Cron | Variable selon la ligue, à mesurer | ~50 requêtes/jour pour 5 ligues |
| Open-Meteo (archive et prévision) | Les deux | Historique : une fois par match passé ; prospectif : J-1 et H-2 | Cron | ERA5 : 5 jours de retard | ~30 requêtes/jour |
| Stades (OSM / Wikidata) | Référentiel | Une fois par saison | Manuel | : | ~100 lignes |
| Annonces officielles (clubs, ligues) | Prospectif | Toutes les 2 h les jours de match, quotidien sinon | Cron, lecture assistée | Immédiat | Texte |

## 3. Nettoyage par source

### 3.1 Football-Data

- Encodage : fichiers en Latin-1 ou UTF-8 selon les saisons ; détecter et normaliser.
- Dates : `dd/mm/yy` avant 2017 environ, `dd/mm/yyyy` ensuite ; colonne `Time` absente avant 2019/20. Sans heure, fixer 15:00 locale et marquer `kickoff_precision = 'day'`.
- Colonnes : le jeu varie par saison et par ligue. Charger en schéma large, projeter dans le schéma cible avec un dictionnaire de colonnes versionné (`B365H`, `PSH`, `PSCH`, `Max>2.5`…), et journaliser les colonnes inconnues.
- Cotes : rejeter les valeurs < 1,01 ou > 1 000 ; rejeter un 1N2 dont la somme des inverses est hors de [1,00 ; 1,25] ; marquer le match `odds_quality = 'suspect'` plutôt que corriger.
- Lignes vides ou incomplètes en fin de fichier : fréquentes, à ignorer.
- Cartons : la note sur le second jaune en Angleterre et Écosse impose de ne pas comparer les compteurs de jaunes entre ligues sans correction.
- Matchs reportés ou annulés : présents avec score vide ; les exclure du modèle, les garder pour le calendrier.

### 3.2 Understat

- Identifiants de match Understat stables ; conserver `understat_match_id`.
- Tirs : coordonnées normalisées [0,1] ; convertir en mètres si un modèle xG maison est construit.
- Rejouer l'extraction si le xG total d'un match a changé (Understat corrige a posteriori) et conserver les deux valeurs avec leurs dates.
- Pas de xG pour les Coupes ni les compétitions européennes : la fatigue européenne est calculée sur le calendrier, pas sur les xG.

### 3.3 Cotes courantes (The Odds API et saisie)

- Chaque relevé est une ligne : bookmaker, marché, sélection, cote, `observed_at`, `source`, `pipeline`. Jamais d'écrasement.
- Ligne de total : stocker la ligne (2,5 ; 2,75…) avec la cote ; le modèle ne compare que sur la même ligne.
- Détection de cotes obsolètes : un relevé plus vieux que 6 h à H-2 est marqué `stale` et exclu de l'espérance affichée.

### 3.4 Compositions et absences

- Composition officielle : enregistrer l'heure de première apparition dans l'API (`available_at`), pas l'heure du coup d'envoi.
- Blessures : stocker l'événement (joueur, type, date d'annonce, date de retour estimée, source) ; ne jamais déduire une absence d'un match manqué a posteriori.
- Compositions probables (presse) : statut `press`, nom du média et du journaliste, jamais fusionnées avec l'officiel.

### 3.5 Météo

- Interroger à la position du stade, à l'heure du coup d'envoi arrondie à l'heure. Conserver température, précipitations sur 3 h précédentes, vent moyen et rafales.
- Prospectif : conserver la prévision utilisée à la décision et, après le match, la réanalyse. La différence mesure l'erreur de prévision.

## 4. Rapprochement des entités

### 4.1 Équipes

Le problème central. « Man United », « Manchester Utd », « Manchester United », « MUN » désignent la même équipe selon la source.

- Table `teams` (identifiant interne, nom canonique, pays) et table `team_aliases` (alias, source, saison de validité, méthode de rapprochement : manuel, exact, normalisé, assisté, confiance).
- Étapes : normalisation (minuscules, accents, ponctuation, suffixes FC/CF/AC/SC), correspondance exacte sur les alias connus, puis proposition assistée (distance de chaînes et, si disponible, Claude) **soumise à validation humaine** avant insertion. Aucun alias n'entre sans validation pour les cinq ligues, ce qui représente environ 120 équipes : c'est une journée de travail, une fois.
- Contrôle de cohérence : pour une saison et une ligue, chaque source doit produire exactement 18 ou 20 équipes distinctes après rapprochement, et le même nombre de matchs. Tout écart bloque le chargement.

### 4.2 Matchs

Clé de rapprochement : compétition, saison, équipe domicile, équipe extérieur, date à ± 1 jour. Deux sources qui donnent des scores différents pour le même match déclenchent une alerte, pas un choix automatique.

### 4.3 Compétitions et saisons

Codes Football-Data (`E0`, `SP1`, `D1`, `I1`, `F1`), codes Understat (`EPL`, `La_liga`, `Bundesliga`, `Serie_A`, `Ligue_1`), codes football-data.org (`PL`, `PD`, `BL1`, `SA`, `FL1`) : table fixe. Saison définie par l'année de début.

### 4.4 Joueurs (phase M3)

Identifiants API-Football comme pivot ; alias par source ; même règle de validation humaine pour les cas ambigus (homonymes, translittérations).

## 5. Contrôles de qualité automatiques

Exécutés après chaque chargement ; un échec bloque la génération de prédictions et s'affiche dans le journal des données.

| Contrôle | Règle |
|---|---|
| Complétude saison | Nombre de matchs attendu par ligue et saison (380 ou 306), tolérance sur la saison en cours |
| Unicité | Un seul match par (saison, domicile, extérieur) |
| Cohérence des scores | Somme des buts cohérente avec `FTR` ; mi-temps ≤ final |
| Cohérence des cotes | Somme des inverses dans [1,00 ; 1,25] ; clôture présente pour ≥ 95 % des matchs depuis 2019/20 |
| Cohérence xG | xG match dans [0 ; 8] ; écart xG Understat / tirs plausible |
| Fraîcheur | Dernière mise à jour de chaque source inférieure au délai attendu × 2 |
| Anti-fuite | Aucune ligne avec `available_at` postérieure à l'heure de prédiction dans le jeu d'entrée d'un modèle (test automatisé sur chaque exécution) |

## 6. Provenance et versions

- `sources` : catalogue des sources avec licence, conditions, contact, cadence.
- `source_snapshots` : chaque téléchargement, avec empreinte et statut de chargement.
- Chaque ligne de données de fait référence son `snapshot_id`.
- Chaque prédiction référence la version des données (`data_version`, empreinte des snapshots utilisés) et la version du modèle (`model_version`).

## 7. Ce qui n'est pas collecté

Données en direct, réseaux sociaux par API, pages dont les conditions interdisent l'accès automatisé (FBref, Sofascore, WhoScored, Flashscore, OddsPortal, Transfermarkt en l'état), données payantes tant que P0 n'a pas conclu.
