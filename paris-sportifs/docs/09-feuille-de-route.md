# Feuille de route, coûts et dépendances

Livrable 9 sur 10. Rédigé le 2026-09-05. Hypothèse : une personne à temps partiel (10 à 15 h par semaine), usage personnel.

## 1. Phases

| Phase | Durée | Contenu | Livrables | Condition d'entrée | Condition de sortie |
|---|---|---|---|---|---|
| **P0 : preuve statistique** | 3 à 4 semaines | Téléchargement Football-Data 2000-2026 ; xG Understat 2014-2026 ; validation manuelle des 328 alias ; backtest walk-forward 2019/20 à 2024/25 ; rapport | Rapport de backtest, registre d'hypothèses renseigné | Code P0 (livré), accès réseau non filtré | Verdict poursuivre / corriger / abandonner (livrable 10) |
| **M1 : pipeline prospectif** | 4 à 6 semaines | Projet Supabase, schéma `bet`, moteur en cron, prédictions J-3/J-1/H-2 horodatées, tableau de bord et fiche rencontre | Base en production, 2 écrans | Verdict P0 ≠ abandonner | 4 semaines de prédictions sans incident de fuite ni trou de données |
| **M2 : simulation et paper trading** | 8 à 12 semaines (calendrier sportif) | Simulateur, portefeuille fictif, collecte des cotes de 3 opérateurs agréés, suivi des performances, CLV | 5 écrans, ≥ 200 paris fictifs | M1 stable | Rapport de paper trading avec CLV et IC |
| **M3 : information contextuelle** | 6 à 8 semaines | API-Football (compositions, absences), extraction assistée par Claude, score de complétude enrichi, tests d'ablation en prospectif | Module IA, journal des données | M2 en cours | Gain hors échantillon démontré, ou retrait de la famille |
| **Décision** | 1 semaine | Rapport de viabilité selon le livrable 10 | Rapport | Fin de M2 et M3 | Continuer, réduire, arrêter |

Durée totale avant décision : 6 à 8 mois, dictée par le calendrier des matchs (le paper trading a besoin de journées réelles) et non par le développement.

## 2. Coûts

### 2.1 Données et services (par mois)

| Poste | P0 | M1 | M2 | M3 | Note |
|---|---|---|---|---|---|
| Football-Data, Understat, openfootball, Open-Meteo, OSM | 0 | 0 | 0 | 0 | Gratuit, usage personnel ; respecter les délais |
| The Odds API | 0 | 0 (500 crédits) | 30 $ | 30 $ | 3 relevés/jour × 2 marchés × 1 région dépassent le gratuit dès M2 |
| API-Football | 0 | 0 | 0 | 19 $ | 100 req/jour insuffisantes pour compositions H-1 sur 5 ligues |
| Claude (extraction, explication) | 0 | 0 | 0 | 10 à 30 $ | Plafond fixé dans `ai_calls` ; coupure automatique |
| Supabase | 0 | 0 à 25 $ | 25 $ | 25 $ | Le palier gratuit suffit probablement jusqu'à M2 |
| Vercel | 0 | 0 | 0 | 0 | Palier gratuit |
| Hébergement du cron (petit serveur ou machine locale) | 0 | 0 à 5 $ | 5 $ | 5 $ | |
| **Total** | **0** | **0 à 30 $** | **~60 $** | **~110 $** | Sous le plafond de 50 $ jusqu'à M2 si Supabase reste gratuit |

Aucun achat de données payantes (Opta, StatsBomb, historique de cotes horodatées) n'est prévu avant la décision. Si le verdict de P0 est « corriger » après ablation des familles 1 à 4, la première dépense à envisager est l'historique The Odds API (plan à 59 $/mois, coût ×10 par requête historique) pour mesurer la CLV à J-2 sur 2020-2026 ; budget estimé 100 à 200 $ ponctuels.

### 2.2 Temps

| Phase | Heures estimées | Dont validation manuelle |
|---|---|---|
| P0 | 40 à 60 | 8 (alias) |
| M1 | 60 à 80 | 5 |
| M2 | 60 à 90 | 30 (relevés de cotes à heures fixes) |
| M3 | 60 à 80 | 15 (validation des extractions) |

## 3. Dépendances et risques

| Dépendance | Risque | Probabilité | Impact | Parade |
|---|---|---|---|---|
| Football-Data continue de publier | Arrêt du site personnel | Faible | Bloquant pour l'historique | Conserver tous les bruts ; openfootball pour les résultats ; sans cotes, le projet perd sa raison d'être |
| Understat reste accessible sans conditions contraires | Changement de structure ou interdiction | Moyenne | Perte des xG prospectifs | Cache complet ; modèle sans xG maintenu en parallèle ; StatsBomb Open Data pour un xG maison si nécessaire |
| The Odds API couvre Pinnacle en région `eu` | Retrait d'un bookmaker | Faible | Perte de la référence courante | Betfair BASIC historique comme référence alternative (phase 2) |
| Opérateurs français : cotes accessibles pour relevé manuel | Blocage, changement de site | Faible | Paper trading « France » incomplet | Réduire à 2 opérateurs ; documenter |
| API-Football publie les compositions avant le match sur les 5 ligues | Documentation ambiguë | Moyenne | Famille « compositions » non testable | Mesurer sur 4 semaines avant d'en dépendre |
| Licences non commerciales (Sackmann, StatsBomb) | Passage à un usage distribué | Dépend de la décision | Retrait de sources | Décision d'usage à prendre avant M1 |
| Surapprentissage par multiplication des essais | Toujours présent | Élevée | Faux positif | Registre pré-enregistré, saison sous scellés, IC bootstrap, seuils fixés à l'avance |
| Biais de survie de l'utilisateur (continuer parce qu'on a investi) | Élevée | Élevé | Critères d'arrêt écrits (livrable 10), revue à date fixe |

## 4. Ordre des travaux immédiats

1. Depuis un poste non filtré, relire les neuf points de vérification du livrable 2 §G.
2. `p0 download`, `p0 build --accept-unvalidated`, corriger les alias, valider la table (`validated=true`), relancer `p0 build` en mode strict.
3. `p0 xg`, puis `p0 backtest --test-seasons 2019 2024`.
4. Renseigner `hypotheses.yaml` avec les résultats et rédiger le verdict.
5. Si « poursuivre » ou « corriger » : créer le projet Supabase, appliquer `db/schema.sql`, brancher le moteur.
