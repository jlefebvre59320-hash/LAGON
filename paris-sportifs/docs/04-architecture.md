# Architecture technique et schéma de base de données

Livrable 4 sur 10. Rédigé le 2026-09-05, révisé le même jour après deux décisions du commanditaire : usage strictement personnel, déploiement local sans Supabase ni Vercel. Schéma SQL complet dans `db/schema.sql`.

## 1. Vue d'ensemble

Tout tourne sur un seul poste. Un seul langage applicatif (Python), une seule base (PostgreSQL local), une interface web servie en local par le même processus que le moteur.

```text
 sources externes ──► moteur Python ──► PostgreSQL local (schéma bet) ──► interface web locale (FastAPI + Jinja2 + HTMX)
                        │  ingestion, nettoyage, rapprochement           servie sur http://localhost:8000, en français
                        │  features, modèles, backtest
                        │  prédictions horodatées, portefeuille fictif
                        └─ module Claude (extraction, rapprochement, explication), débrayable
```

Pourquoi ce changement par rapport à la première version (Supabase, Next.js, Vercel) : ces trois briques répondaient à un besoin d'hébergement multi-appareils et d'authentification. L'usage strictement personnel sur un poste les rend inutiles. Les retirer supprime tout coût d'hébergement, toute clé de service exposée à un tiers et une seconde pile de langage. Le prix payé : pas d'accès depuis un téléphone hors du réseau local, et une sauvegarde à organiser soi-même.

Pourquoi garder PostgreSQL plutôt que SQLite ou DuckDB : les triggers d'immuabilité sur `predictions` et `paper_bets`, les types énumérés, les contraintes et les vues sont écrits en PostgreSQL et fonctionnent tels quels ; DuckDB n'a pas de triggers, SQLite en a mais avec un typage faible qui affaiblit les garde-fous. PostgreSQL local s'installe en une commande (paquet système ou conteneur). DuckDB reste l'outil d'analyse ad hoc sur les fichiers Parquet de P0.

Pourquoi FastAPI et non Next.js : une interface locale de consultation et de saisie n'a pas besoin de rendu côté client élaboré. Jinja2 rend les pages en français côté serveur, HTMX gère les rafraîchissements partiels (relevé de cotes, verdicts) sans construire une application JavaScript. Une seule pile à maintenir, un seul processus à lancer. Si un jour l'accès à distance devient nécessaire, un tunnel chiffré vers le poste (ou un VPN) suffit ; on ne remet pas de base hébergée.

## 2. Moteur Python

Arborescence cible (`paris-sportifs/engine/`, initialisée en P0 sous `p0/`) :

```text
engine/
  ingest/         football_data.py, understat.py, odds_api.py, api_football.py, open_meteo.py, calendars.py
  reconcile/      teams.py (alias, validation), matches.py
  features/       form.py, schedule.py (repos, enchaînements), stakes.py (enjeu), weather.py, lineups.py
  models/         market.py (Shin, power, multiplicatif), elo.py, dixon_coles.py, ensemble.py
  backtest/       walk_forward.py, metrics.py, staking.py, strategy.py
  predict/        daily.py (horizons J-3, J-1, H-2), completeness.py, verdict.py
  ai/             extract.py, reconcile_assist.py, explain.py, verify.py, budget.py
  store/          parquet.py (P0), postgres.py (MVP, psycopg)
  web/            app.py (FastAPI), templates/ (Jinja2, fr), static/ (CSS, htmx.min.js embarqué)
  registry/       hypotheses.yaml, strategies.yaml
  cli.py          sous-commandes : ingest, predict, settle, backtest, serve
tests/
```

Règles de conception :

1. **Fonctions pures pour les modèles.** Entrée : tableau de matchs avec `available_at ≤ T`. Sortie : probabilités. Aucune lecture de base dans un modèle.
2. **Un objet `Clock`** transmis partout, qui fixe l'heure de décision `T`. Tous les filtres passent par lui ; le test anti-fuite vérifie qu'aucune ligne du jeu d'entrée n'a `available_at > T`.
3. **Versions explicites.** Chaque modèle expose `version` et `params` ; chaque exécution enregistre le commit git et l'empreinte des données.
4. **Sorties structurées.** Une prédiction est un enregistrement complet (probabilités, bornes, cote théorique, cote de référence et son horodatage, probabilité implicite avec méthode, espérance, facteurs, manques, complétude, verdict).
5. **L'interface ne calcule rien.** Elle lit `predictions`, `odds_quotes`, `paper_bets` et les vues ; elle écrit des relevés de cotes manuels, des mises fictives et des paramètres, et déclenche des commandes du moteur.

### 2.1 Cycle quotidien (MVP)

Planifié par des minuteries systemd (ou cron, ou le Planificateur de tâches sous Windows), chacune appelant une sous-commande du moteur. Le poste doit être allumé aux heures prévues ; une exécution manquée est rattrapée au démarrage suivant (`Persistent=true` sous systemd) et signalée dans le journal des données.

```text
06:00  engine ingest         calendriers, résultats de la veille, xG, météo réanalysée ; contrôles qualité (blocage si nécessaire)
07:00  engine reconcile      nouveaux matchs, alias en attente (validation dans l'interface)
09:00  engine predict --horizon D-3 D-1     relevé de cotes (The Odds API), prédictions
H-2    engine predict --horizon H-2         relevé de cotes, compositions, météo prévue, verdict ; déclenché par une minuterie calculée la veille
J+1    engine settle         règlement des paris fictifs, CLV avec la clôture, métriques
03:00  pg_dump               sauvegarde compressée dans un dossier synchronisé hors du poste (clé USB, disque externe, espace chiffré)
```

Les relevés de cotes des opérateurs français sont saisis dans l'interface à heures fixes (livrable 5 §2) ; l'écran de saisie horodate à la minute.

### 2.2 Modèles de P0 et leurs hypothèses

| Modèle | Hypothèses | Données | Limites |
|---|---|---|---|
| Marché seul | La cote de clôture, marge retirée, est la meilleure estimation disponible ; marge distribuée selon Shin | Cotes | Ne peut révéler aucun avantage par construction ; plancher et référence |
| Elo | Force scalaire mise à jour après chaque match ; avantage domicile constant par ligue ; nul par modèle ordonné | Résultats | Ignore l'ampleur des scores ; nul mal capté |
| Dixon-Coles | Buts ~ Poisson d'intensités attaque × défense × domicile ; correction des scores faibles ; pondération temporelle | Scores | Sous-dispersion ; force supposée stable sur la fenêtre |
| Dixon-Coles sur xG | Idem, intensités estimées sur les xG | Scores, xG | Dépend du fournisseur ; depuis 2014/15 |
| Ensemble | Logit multinomial sur les sorties des modèles, entraîné hors échantillon | Sorties des modèles | Tend à reproduire le marché ; variante sans cotes en entrée obligatoire |

Protocole de validation : livrable 7.

## 3. Base de données

Le schéma complet est dans `db/schema.sql` (PostgreSQL, schéma `bet`, trente tables). Il ne dépend d'aucune extension ni d'aucun service : il s'applique sur une instance locale avec `psql -f db/schema.sql`. Points de conception :

- **Provenance** : `sources`, `source_snapshots` ; chaque table de faits porte `snapshot_id`.
- **Deux horloges** : `published_at` et `available_at` sur `lineups`, `absences`, `information_items` ; `observed_at` sur `odds_quotes`, `match_xg`, `weather`.
- **Cotes** : une ligne par relevé, jamais d'écrasement ; `observed_precision` documente l'approximation des cotes Football-Data.
- **xG** : chaque valeur observée conservée avec sa date (Understat corrige a posteriori).
- **Prédictions immuables** : trigger interdisant UPDATE et DELETE ; trigger refusant une prédiction prospective postérieure au coup d'envoi.
- **Paris fictifs** : référence à la prédiction et à la cote exactes, puis à la clôture pour la CLV ; suppression interdite.
- **Registre** : `hypotheses` et `strategies` pré-enregistrées (`registered_at`).
- **IA** : `ai_calls` journalise fournisseur, modèle, version du prompt, coût ; `information_items` porte `extracted_by`, `verified_by`, `contradicts`, `superseded_by`.
- **Qualité** : `data_quality_flags` ; un drapeau `blocking` interrompt la génération de prédictions.

Ce que le schéma interdit volontairement : stocker une probabilité produite par une IA ; modifier une prédiction ; enregistrer une mise sans prédiction ni cote référencées.

Deux rôles PostgreSQL suffisent : `bet_engine` (lecture-écriture, utilisé par le moteur et les commandes) et `bet_web` (lecture sur tout, écriture limitée à `odds_quotes` avec `pipeline='prospective'`, `paper_bets` en insertion, `portfolios`, et une table de paramètres). Ce n'est pas de la sécurité contre un attaquant, c'est une protection contre une erreur de l'interface.

### 3.1 Schéma simplifié

```text
sources ─┬─ source_snapshots ─┐
         │                    ▼
competitions ── matches ──┬── match_stats
seasons ────────┘   │     ├── match_xg ── shots
teams ── team_aliases│     ├── weather
venues ── team_venues│     ├── odds_quotes ◄── bookmakers
referees ────────────┘     ├── lineups, absences, information_items ◄── ai_calls
                           └── predictions ◄── model_versions, data_versions
                                   │
                    strategies ── backtest_runs      portfolios ── paper_bets
                    hypotheses
```

## 4. Interface web locale

- FastAPI, gabarits Jinja2 en français, HTMX pour les rafraîchissements partiels, CSS maison sans dépendance externe (tout est servi depuis le poste ; aucune requête vers un CDN, l'application fonctionne hors ligne pour la consultation).
- Écoute sur `127.0.0.1:8000` uniquement. Pas d'authentification : le poste est le périmètre. Si l'on veut l'ouvrir au réseau local, ajouter un mot de passe unique et passer en HTTPS auto-signé ; ce n'est pas prévu au MVP.
- Lecture via des vues SQL (`v_dashboard`, `v_match_card`, `v_performance`, `v_data_journal`).
- Écritures : relevés de cotes manuels, mises fictives (insertion seulement), portefeuilles, paramètres et limites, validation d'alias.
- Actions : boutons « relancer l'ingestion », « générer les prédictions H-2 », « régler les paris de la veille », qui appellent les sous-commandes du moteur en arrière-plan et affichent le journal.
- Écrans : livrable 8 (inchangés ; la maquette ne présuppose aucune pile).

## 5. Module Claude

Rôles autorisés : extraire (texte → `information_items`), rapprocher (proposer des alias, jamais les valider), détecter des contradictions, proposer des hypothèses (statut « proposée »), expliquer une prédiction en français à partir de `predictions.factors` sans ajouter de chiffre.

Rôles interdits : produire ou modifier une probabilité, une cote théorique, une espérance ; valider un alias ; décider un verdict.

Mécanique : prompts versionnés dans le dépôt ; sortie contrainte à un schéma JSON, rejetée sinon ; seconde lecture optionnelle pour les extractions à fort enjeu, le désaccord remontant à l'humain et l'accord n'étant pas une preuve ; budget mensuel plafonné, coupure automatique, pipeline qui continue sans lui ; chaque information extraite conserve URL, auteur, `published_at`, `available_at`, statut officiel/presse/rumeur. La clé d'API est lue depuis un fichier `.env` local non versionné.

## 6. Sécurité, confidentialité, sauvegarde

- Clés d'API (The Odds API, API-Football, Claude) dans `.env` local, exclu du dépôt ; jamais dans la base.
- Base locale accessible uniquement depuis `localhost` ; mot de passe PostgreSQL propre au poste.
- Aucune donnée personnelle hors les paramètres de l'utilisateur.
- **Sauvegarde** : `pg_dump` quotidien compressé, conservé 30 jours, copié sur un support hors du poste ; les bruts (`data/raw/`) sont sauvegardés de la même façon car ils ne sont pas tous retéléchargeables (Understat corrige, Football-Data peut disparaître). Un test de restauration à chaque fin de phase.
- Le dépôt Git ne contient ni données, ni prédictions, ni rapports sur données réelles (`.gitignore` du prototype) ; il reste privé.

## 7. Installation et exploitation

| Élément | Choix | Note |
|---|---|---|
| Système | Linux, macOS ou Windows avec WSL | Le moteur est en Python 3.11+ pur ; PostgreSQL disponible partout |
| PostgreSQL | Paquet système ou conteneur (`docker compose up -d db`) | Version 15 ou supérieure ; `psql -f db/schema.sql` |
| Python | `python -m venv .venv`, `pip install -e engine` | Dépendances : numpy, pandas, scipy, pyarrow, requests, pyyaml, psycopg, fastapi, uvicorn, jinja2 |
| Planification | systemd timers (Linux), launchd (macOS), Planificateur de tâches (Windows) | Fichiers d'exemple à livrer en M1 dans `deploy/` |
| Interface | `engine serve` puis `http://127.0.0.1:8000` | Un seul processus uvicorn |
| Sauvegarde | script `deploy/backup.sh` appelé par une minuterie | `pg_dump` + copie de `data/raw/` |
| Coût d'infrastructure | 0 | Électricité du poste ; le poste doit être allumé aux heures planifiées les jours de match |

Contrainte d'exploitation à accepter : si le poste est éteint à H-2, la prédiction H-2 n'est pas produite et le match est marqué « données insuffisantes ». C'est préférable à une prédiction rétroactive, qui n'a aucune valeur.

## 8. Décisions et alternatives écartées

- **Supabase, Vercel** : écartés le 2026-09-05 sur décision du commanditaire ; inutiles pour un usage personnel local, ils ajoutaient coût, clés de service et dépendance à des tiers.
- **Next.js pour l'interface** : écarté avec l'hébergement ; une interface locale n'a pas besoin d'une seconde pile. Le code de Ti Kanal présent dans le dépôt n'est pas réutilisé.
- **Tout en TypeScript** : écarté, bibliothèques statistiques insuffisantes.
- **SQLite ou DuckDB comme base principale** : écartés au profit de PostgreSQL local pour les triggers d'immuabilité et les contraintes ; DuckDB reste l'outil d'analyse sur Parquet.
- **Calcul des probabilités dans l'interface** : écarté ; une seule implémentation, côté moteur.
- **Accès distant (téléphone hors du domicile)** : non prévu ; si le besoin apparaît, tunnel chiffré vers le poste plutôt qu'une base hébergée.
