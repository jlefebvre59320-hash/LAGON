# Architecture technique et schéma de base de données

Livrable 4 sur 10. Rédigé le 2026-09-05. Schéma SQL complet dans `db/schema.sql`.

## 1. Vue d'ensemble

Trois blocs, découplés par la base de données :

```text
 sources externes ──► moteur Python (batch) ──► PostgreSQL (Supabase, schéma bet) ──► interface Next.js
                         │   ingestion, nettoyage, rapprochement
                         │   features, modèles, backtest
                         │   prédictions horodatées, portefeuille fictif
                         └── module Claude (extraction, rapprochement, explication), débrayable
```

- **Moteur Python** : seul endroit où une probabilité est calculée. Exécuté par cron (quotidien et jours de match) ou à la main. En P0, il tourne seul, sans base, sur des fichiers Parquet locaux.
- **PostgreSQL** : source de vérité pour les faits, les cotes, les prédictions immuables et le portefeuille. Supabase pour l'hébergement, l'authentification et l'API REST auto-générée. **Projet Supabase distinct** de Ti Kanal.
- **Next.js** : lecture seule sur les prédictions, écriture limitée aux paramètres, au portefeuille fictif et aux saisies de cotes. Aucune probabilité n'est calculée côté interface.

Pourquoi Python et pas TypeScript pour le moteur : les bibliothèques statistiques nécessaires (optimisation par maximum de vraisemblance, distributions, bootstrap, calibration) sont matures en Python (scipy, statsmodels) et inexistantes ou fragiles en TypeScript. Le coût est un second langage dans le dépôt, accepté.

## 2. Moteur Python

Arborescence cible (`paris-sportifs/engine/`, initialisée en P0 sous `p0/`) :

```text
engine/
  ingest/         football_data.py, understat.py, odds_api.py, api_football.py, open_meteo.py, calendars.py
  reconcile/      teams.py (alias, validation), matches.py
  features/       form.py, schedule.py (repos, enchaînements), stakes.py (enjeu), weather.py, lineups.py
  models/         market.py (Shin, power, multiplicatif), elo.py, dixon_coles.py, ensemble.py
  backtest/       walk_forward.py, metrics.py (log loss, Brier, calibration, CLV, ROI, drawdown, bootstrap), staking.py
  predict/        daily.py (horizons J-3, J-1, H-2), completeness.py, verdict.py
  ai/             extract.py, reconcile_assist.py, explain.py, verify.py, budget.py
  store/          parquet.py (P0), postgres.py (MVP)
  registry/       hypotheses.yaml, strategies.yaml
  cli.py
tests/
```

Règles de conception :

1. **Fonctions pures pour les modèles.** Entrée : tableau de matchs avec `available_at ≤ T`. Sortie : probabilités. Aucune lecture de base dans un modèle.
2. **Un objet `Clock`** transmis partout, qui fixe l'heure de décision `T`. Tous les filtres de données passent par lui. Le test anti-fuite vérifie qu'aucune ligne du jeu d'entrée n'a `available_at > T`.
3. **Versions explicites.** Chaque modèle expose `version` et `params` ; chaque exécution enregistre le commit git et l'empreinte des données.
4. **Sorties structurées.** Une prédiction est un enregistrement complet (probabilités, bornes, cote théorique, cote de référence et son horodatage, probabilité implicite avec méthode, espérance, facteurs, manques, complétude, verdict) et rien d'autre.

### 2.1 Cycle quotidien (MVP)

```text
06:00  ingestion calendriers, résultats de la veille, xG, météo réanalysée
06:30  contrôles de qualité ; si blocage : arrêt, alerte dans le journal
07:00  rapprochement des nouveaux matchs et alias en attente de validation
09:00  relevé de cotes J-3 et J-1 ; prédictions J-3 et J-1
H-2    relevé de cotes, compositions si publiées, météo prévue ; prédiction H-2 ; verdict
J+1    règlement des paris fictifs, calcul de la CLV avec la cote de clôture, mise à jour des métriques
```

### 2.2 Modèles de P0 et leurs hypothèses

| Modèle | Hypothèses | Données | Limites |
|---|---|---|---|
| Marché seul | La cote de clôture, marge retirée, est la meilleure estimation disponible ; la marge est distribuée selon Shin (parieurs informés) | Cotes | Ne peut révéler aucun avantage par construction ; sert de plancher et de référence |
| Elo | La force d'une équipe est un scalaire qui évolue par mises à jour après chaque match ; avantage domicile constant par ligue ; probabilité de nul dérivée d'un modèle ordonné | Résultats | Ignore l'ampleur des scores ; nul mal capté ; réglage de K et de la décroissance |
| Dixon-Coles | Buts de chaque équipe ~ Poisson d'intensités attaque × défense × domicile ; correction de dépendance pour 0-0, 1-0, 0-1, 1-1 ; pondération temporelle exponentielle | Scores | Poisson sous-dispersé pour les gros scores ; force supposée stable sur la fenêtre |
| Dixon-Coles sur xG | Idem, intensités estimées sur les xG plutôt que sur les buts, buts observés utilisés pour la vraisemblance | Scores, xG | Dépend du fournisseur de xG ; disponible depuis 2014/15 seulement |
| Ensemble | Régression logistique multinomiale sur les logits des modèles précédents, entraînée hors échantillon | Sorties des modèles | Peut surapprendre si entraînée sur les mêmes saisons que ses entrées ; d'où l'entraînement en walk-forward strict |

Protocole de validation commun : livrable 7.

## 3. Base de données

Le schéma complet est dans `db/schema.sql` (schéma PostgreSQL `bet`, 30 tables). Points de conception :

- **Provenance** : `sources`, `source_snapshots` ; chaque table de faits porte `snapshot_id`.
- **Deux horloges** : `published_at` et `available_at` sur `lineups`, `absences`, `information_items` ; `observed_at` sur `odds_quotes`, `match_xg`, `weather`.
- **Cotes** : une ligne par relevé (`odds_quotes`), jamais d'écrasement ; `observed_precision` documente l'approximation des cotes Football-Data (« afternoon », « closing »).
- **xG** : `match_xg` garde chaque valeur observée avec sa date, car Understat corrige a posteriori.
- **Prédictions immuables** : trigger interdisant UPDATE et DELETE ; trigger refusant une prédiction prospective postérieure au coup d'envoi.
- **Paris fictifs** : `paper_bets` référence la prédiction et la cote exacte utilisées, puis la cote de clôture pour la CLV ; suppression interdite.
- **Registre** : `hypotheses` et `strategies` sont pré-enregistrées avant d'être testées (`registered_at`), pour contrôler le surapprentissage par multiplication des essais.
- **IA** : `ai_calls` journalise fournisseur, modèle, version du prompt, coût, statut ; `information_items` porte `extracted_by`, `verified_by`, `contradicts`, `superseded_by`.
- **Qualité** : `data_quality_flags` avec sévérité ; un drapeau `blocking` interrompt la génération de prédictions.

Ce que le schéma interdit volontairement : stocker une probabilité produite par une IA (`information_items.summary` est du texte structuré, pas un chiffre de probabilité) ; modifier une prédiction ; enregistrer une mise sans prédiction ni cote référencées.

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

## 4. Interface Next.js

- Application dédiée, déployée séparément (`paris-sportifs/web/`, phase M1), même charte de code que Ti Kanal (App Router, Supabase SSR, CSP stricte) mais projet Supabase et Vercel distincts.
- Lecture via vues SQL dédiées (`v_dashboard`, `v_match_card`, `v_performance`) exposées par l'API Supabase avec RLS restreignant à l'utilisateur propriétaire.
- Écritures autorisées : `portfolios`, `paper_bets` (insertion seulement), `odds_quotes` avec `pipeline = 'prospective'` et `source_id = 'manual'`, paramètres utilisateur.
- Pas de calcul de probabilité côté client. Les espérances affichées sont celles stockées dans `predictions.expected_value`, recalculées côté serveur si une cote plus récente existe, avec la méthode de marge indiquée.
- Écrans : livrable 8.

## 5. Module Claude

Rôles autorisés : extraire (texte → `information_items`), rapprocher (proposer des alias, jamais les valider), détecter des contradictions entre `information_items`, proposer des hypothèses (→ `hypotheses`, statut « proposée »), expliquer une prédiction en français à partir de `predictions.factors` (sans ajouter de chiffre).

Rôles interdits : produire ou modifier une probabilité, une cote théorique, une espérance ; valider un alias ; décider un verdict.

Mécanique :

- Prompts versionnés dans le dépôt ; `ai_calls.prompt_version` obligatoire.
- Sortie contrainte à un schéma JSON ; toute sortie non conforme est rejetée et journalisée.
- Seconde lecture optionnelle par un second appel (modèle différent ou prompt différent) pour les extractions à fort enjeu (composition officielle) ; le désaccord bloque l'insertion et remonte à l'humain ; l'accord n'est pas une preuve et est stocké comme tel (`verified_by`).
- Budget mensuel plafonné ; au-delà, le module se coupe et le pipeline continue sans lui (`information_items` non alimenté, complétude réduite, verdict « données insuffisantes » plus fréquent).
- Toute information extraite conserve URL, auteur, `published_at`, `available_at`, statut officiel/presse/rumeur.

## 6. Sécurité et confidentialité

- Clés d'API en variables d'environnement serveur, jamais côté client (même règle que `.env.example` de Ti Kanal).
- RLS activée sur toutes les tables du schéma `bet` ; le moteur écrit avec la clé service, l'interface avec la clé anonyme et une session utilisateur.
- Données personnelles : aucune, hors le compte de l'utilisateur.
- Journal d'audit : `source_snapshots`, `ai_calls`, `data_quality_flags` suffisent au MVP.

## 7. Déploiement

| Composant | P0 | MVP |
|---|---|---|
| Moteur | Poste local, Python 3.11, fichiers Parquet | Serveur ou conteneur avec cron, PostgreSQL Supabase |
| Base | Aucune | Supabase (projet dédié), migrations versionnées dans `db/` |
| Interface | Aucune | Vercel (projet dédié) |
| Secrets | Fichier `.env` local | Variables d'environnement Vercel et serveur |
| Coût d'infrastructure | 0 | Supabase gratuit ou ~25 $/mois selon volume ; Vercel gratuit ; hébergement du cron ~5 $/mois |

## 8. Décisions et alternatives écartées

- **Tout en TypeScript** : écarté, bibliothèques statistiques insuffisantes.
- **Base locale SQLite/DuckDB pour le MVP** : l'usage strictement personnel étant confirmé (2026-09-05), cette option redevient sérieuse. Postgres reste préféré pour les triggers d'immuabilité et l'interface web, mais un déploiement entièrement local (moteur, PostgreSQL local ou DuckDB, interface servie en local) est acceptable et supprime tout coût d'hébergement. Décision à prendre à l'entrée de M1 selon le besoin réel d'une interface accessible depuis un téléphone.
- **Réutiliser le projet Supabase de Ti Kanal** : écarté ; données et droits sans rapport, risque de fuite entre applications.
- **Calcul des probabilités dans l'interface** : écarté ; une seule implémentation, versionnée, côté moteur.
