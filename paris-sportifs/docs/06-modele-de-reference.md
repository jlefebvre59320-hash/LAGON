# Premier modèle de référence

Livrable 6 sur 10. Rédigé le 2026-09-05. Code : `p0/` (paquet Python `p0`, 20 tests, tous passants le 2026-09-05).

## 1. Ce qui est livré

Un moteur complet, exécutable hors ligne sur données synthétiques et prêt à tourner sur les données réelles dès qu'un poste non filtré permet de les télécharger. Il ne contient aucune interface : c'est volontaire (livrable 1 §6.3).

| Composant | Fichier | Rôle |
|---|---|---|
| Horloge de décision | `p0/clock.py` | Filtre unique anti-fuite ; lève `LeakageError` si une ligne postérieure à T atteint un modèle |
| Ingestion Football-Data | `p0/ingest/football_data.py` | Téléchargement avec empreinte, lecture tolérante (encodage, dates, lignes vides), projection dans le schéma P0, horodatage documenté des cotes (« afternoon » = J-1 15:00 ; « closing » = coup d'envoi − 1 min), contrôles de qualité |
| Ingestion Understat | `p0/ingest/understat.py` | Décodage du bloc `datesData`, cache disque, délai ≥ 6 s, arrêt sur 403/429 |
| Rapprochement | `p0/reconcile/teams.py`, `aliases.csv` | 328 alias Football-Data et Understat pour les 5 ligues, **tous marqués non validés** ; le mode strict refuse un alias non validé ; contrôle 18/20 équipes par saison |
| Marge | `p0/models/market.py` | Multiplicative, power, Shin |
| Elo | `p0/models/elo.py` | K = 20, avantage domicile 60, multiplicateur logarithmique de l'écart de buts, conversion 1N2 par logit ordonné |
| Dixon-Coles | `p0/models/dixon_coles.py` | Poisson bivarié avec correction ρ, pondération exp(−ξ·jours), ξ = 0,0035 (demi-vie ≈ 200 jours) ; variante xG par quasi-vraisemblance (ρ = 0) |
| Ensemble | `p0/models/ensemble.py` | Logit multinomial L2 sur les log-rapports des modèles de base et du marché pré-clôture, entraîné sur les prédictions hors échantillon des saisons antérieures |
| Walk-forward | `p0/backtest/walk_forward.py` | Refit tous les 7 jours (paramètre), fenêtre de 6 saisons, référence marché pré-clôture et clôture |
| Stratégies | `p0/backtest/strategy.py`, `registry/strategies.yaml` | 7 stratégies pré-enregistrées ; sélection par espérance ; mise fixe ou Kelly 1/8 plafonné ; CLV ; simulation « FR_SIM » à marge 12 % |
| Métriques | `p0/backtest/metrics.py` | Log-loss, Brier, calibration par déciles et ECE, ROI avec IC bootstrap, drawdown, série perdante, probabilité de perte à 500 paris |
| Rapport et verdict | `p0/report.py` | Markdown ; verdict poursuivre / corriger / abandonner selon les seuils du livrable 10 |
| Monde synthétique | `p0/synthetic.py` | Saisons simulées avec bookmakers à marge et bruit connus, pour tester la chaîne |

## 2. Hypothèses de chaque modèle et ce qu'elles coûtent

**Marché seul.** La clôture Pinnacle, marge retirée par Shin, est le plancher. Sur données réelles, la littérature (Štrumbelj 2014, Buchdahl) attend qu'aucun modèle sur données publiques ne fasse mieux en log-loss ; si le P0 réel dit le contraire de plus de 1 %, la première hypothèse à examiner est une fuite, pas un génie.

**Elo.** Force scalaire, mise à jour locale. Il oublie l'ampleur des scores (partiellement corrigé par le multiplicateur) et ne produit pas de totaux. Sa force : robustesse, aucun refit coûteux. Sa faiblesse : le nul, que le logit ordonné ne capte que par l'écart de classement.

**Dixon-Coles.** Intensités multiplicatives attaque × défense, stables sur la fenêtre pondérée. Le paramètre ρ corrige les scores faibles ; la Poisson reste sous-dispersée pour les scores élevés. Le choix de ξ est un compromis : trop grand, le modèle suit le bruit ; trop petit, il ignore les transferts d'été. La valeur 0,0035/jour est un point de départ à balayer (0,002 à 0,006) en walk-forward, **en enregistrant chaque essai**.

**Dixon-Coles sur xG.** Même structure, observations réelles. Gain attendu : moins de variance, puisque le xG est moins bruité que le but ; risque : dépendance à un fournisseur unique et à sa méthode, et aucune information sur la finition (un attaquant qui surperforme durablement son xG est invisible). Une variante intermédiaire (cible = moyenne buts/xG) est à tester en famille 2.

**Ensemble.** Il apprend le poids de chaque source, y compris du marché pré-clôture. Par construction, il tend à reproduire le marché ; c'est pourquoi la variante **sans marché en entrée** doit toujours être calculée en parallèle : c'est elle qui peut révéler un avantage, et c'est elle que les stratégies S1 et S2 utilisent (Dixon-Coles seuls).

## 3. Résultats sur le monde synthétique (illustration, pas un résultat)

Monde : 20 équipes, saisons 2015 à 2022, forces dérivant de 0,05 par saison, bookmaker « PS » à marge 2,5 % et bruit 3 % avant clôture, clôture à bruit 1 %, « B365 » à 5 % et bruit 6 %, « Max » = meilleur des deux. Test walk-forward 2019 à 2022, refit 14 jours, exécution 62 s.

| Modèle (1N2) | Log-loss | Brier | ECE |
|---|---|---|---|
| ensemble | 1,0393 | 0,6257 | 0,023 |
| market_pre | 1,0415 | 0,6270 | 0,035 |
| market_close | 1,0422 | 0,6275 | 0,030 |
| elo | 1,0451 | 0,6293 | 0,038 |
| dixon_coles_xg | 1,0471 | 0,6305 | 0,028 |
| dixon_coles | 1,0510 | 0,6322 | 0,036 |

| Stratégie | Paris | ROI | IC 95 % | CLV | IC 95 % CLV | Verdict induit |
|---|---|---|---|---|---|---|
| S1 Dixon-Coles, 1N2, Max, fixe | 1 428 | +1,8 % | [−5,8 ; +9,4] | 0,992 | [0,991 ; 0,994] | pas de CLV |
| S3 ensemble, 1N2, Max, fixe | 651 | +12,4 % | [−0,5 ; +24,8] | 0,996 | [0,993 ; 0,999] | **ROI élevé, CLV < 1 : chance de sélection** |
| S5 ensemble, 1N2, Max, Kelly 1/8 | 651 | +14,5 % | [+0,4 ; +28,6] | 0,996 | [0,993 ; 0,999] | idem |
| S6 ensemble, 1N2, FR_SIM 12 % | 128 | +14,4 % | [−14 ; +46] | 0,893 | : | 128 paris seulement, IC énorme |
| S7 ensemble, O/U, Max, fixe | 361 | −0,0 % | [−12 ; +12] | 0,995 | [0,992 ; 0,998] | rien |

Trois enseignements que le vrai P0 devra garder en tête :

1. **Un ROI de +14 % avec un IC excluant zéro et une CLV inférieure à 1 est possible sur 650 paris.** C'est le biais de sélection du parieur à valeur (livrable 1 §1.1). Le verdict automatique a répondu « corriger », pas « poursuivre ». Sans le critère CLV, on aurait conclu à tort.
2. Dans ce monde, l'ensemble bat légèrement la clôture en log-loss (−0,3 %) parce que la clôture synthétique est elle-même bruitée et que l'ensemble agrège plusieurs estimations indépendantes. Sur données réelles, la clôture agrège déjà des milliers de parieurs : ce résultat ne se reproduira probablement pas, et s'il se reproduit il faudra le vérifier sur la saison sous scellés avant d'y croire.
3. La calibration par déciles se dégrade aux extrêmes (déciles 1, 6 et au-delà, effectifs faibles) : les plafonds de cote (1,2 à 10) dans les stratégies sont justifiés.

## 4. Exécution sur données réelles

```bash
cd paris-sportifs/p0
python -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"
pytest                                   # 20 tests, données synthétiques, ~20 s
p0 download --seasons 2000 2025          # 130 CSV Football-Data (~15 Mo)
p0 build --accept-unvalidated            # première passe : signale les alias inconnus
#   corriger p0/reconcile/aliases.csv, passer validated à true après vérification manuelle
p0 build                                 # mode strict
p0 xg --seasons 2014 2025                # Understat, ~60 pages, ≥ 6 s chacune, cache
p0 backtest --test-seasons 2019 2024 --refit-days 7   # saison 2025 sous scellés : ne pas la passer
```

Durée estimée du backtest réel (5 ligues, 6 saisons test, refit hebdomadaire, 3 modèles) : 30 à 60 minutes sur un portable. Les prédictions, l'évaluation et le rapport sont écrits dans `reports/`.

## 5. Ce que P0 ne fait pas encore

Variables de calendrier, d'enjeu, d'arbitre, de météo (familles 3 à 6) : à ajouter une par une après le premier verdict, chacune avec son hypothèse pré-enregistrée. Handicap asiatique. Balayage systématique de ξ et K avec correction pour tests multiples. Sauvegarde des paramètres estimés par refit (utile pour le diagnostic). Connexion à la base PostgreSQL (M1).
