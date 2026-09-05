# Protocole de backtest reproductible

Livrable 7 sur 10. Rédigé le 2026-09-05. Implémenté dans `p0/backtest/`.

## 1. Séparation chronologique

- **Entraînement** : toutes les saisons antérieures à la saison test, dans une fenêtre de 6 saisons, plus les matchs de la saison test déjà joués avant l'heure de décision.
- **Validation** : la première saison test sert à entraîner l'ensemble et à choisir les hyperparamètres (ξ, K, seuil d'espérance) ; les saisons suivantes servent au test.
- **Test** : saisons 2019/20 à 2024/25 pour le P0 réel (les cotes de clôture n'existent qu'à partir de 2019/20 dans Football-Data ; saison exacte à confirmer).
- **Scellés** : la saison 2025/26 n'est jamais chargée dans un backtest avant la fin de P0. Elle est ouverte une seule fois, après que les stratégies retenues ont été figées par écrit dans `registry/strategies.yaml` avec un commit daté.

## 2. Walk-forward

Pour chaque saison test S, l'horloge T part du premier match de S et avance par pas de `refit_days` (7 jours par défaut). À chaque pas :

1. `history = matchs terminés avant T` (coup d'envoi + 3 h ≤ T), `xg = lignes xg avec observed_at ≤ T` ; la `Clock` vérifie l'absence de toute ligne postérieure et lève une exception sinon.
2. Les modèles sont réajustés sur `history`.
3. Ils prédisent les matchs dont le coup d'envoi est dans [T, T + refit_days).
4. Les probabilités du marché pré-clôture (cotes PS ou Max, marge retirée) et de la clôture sont calculées pour les mêmes matchs. La clôture n'est jamais utilisée comme entrée d'un modèle : elle sert de référence et au calcul de la CLV.

L'ensemble est entraîné après coup, saison par saison, uniquement sur les prédictions hors échantillon des saisons antérieures à celle qu'il prédit ; il n'est disponible qu'à partir de la deuxième saison test.

## 3. Prévention des fuites

| Fuite possible | Parade implémentée |
|---|---|
| Résultat du match utilisé dans sa propre prédiction | `Clock.matches_before` exclut tout match dont le coup d'envoi + 3 h > T |
| xG corrigé a posteriori | Table `xg` avec `observed_at` ; filtre ≤ T |
| Cote de clôture utilisée comme entrée | Les modèles ne reçoivent que `matches` et `xg` ; les cotes ne sont lues que dans `walk_forward` pour la référence et dans `strategy` pour la sélection |
| Cote « pré-clôture » Football-Data en réalité collectée après une annonce | Horodatée J-1 15:00 avec `observed_precision='afternoon'` ; le rapport rappelle l'approximation ; en prospectif, les relevés sont horodatés à la minute |
| Ensemble entraîné sur la saison qu'il prédit | Boucle saison par saison, `seasons < s` |
| Hyperparamètres choisis en regardant la saison test | Registre d'hypothèses ; balayage sur la saison de validation seulement ; saison sous scellés |
| Alias d'équipe résolu grâce à une information future | Alias validés à la main, indépendants du temps (sauf `valid_from/valid_to` explicites) |

Le test `test_walk_forward_produces_all_models_and_no_leak` vérifie qu'aucune prédiction n'est horodatée après le coup d'envoi.

## 4. Comparaisons obligatoires

Chaque rapport contient, sur les **mêmes matchs** :

1. modèle uniforme implicite (log 3 = 1,0986 pour le 1N2 ; log 2 = 0,6931 pour le O/U) comme borne ;
2. marché pré-clôture, marge retirée ;
3. clôture, marge retirée ;
4. chaque modèle et l'ensemble.

Un modèle qui ne bat pas la borne uniforme est bogué. Un modèle qui bat la clôture de plus de 1 % est suspect avant d'être prometteur.

## 5. Mesures

| Famille | Mesure | Implémentation |
|---|---|---|
| Qualité des probabilités | Log-loss, Brier, ECE et table de calibration par déciles, par marché et par saison | `metrics.log_loss`, `brier`, `calibration_table`, `expected_calibration_error` |
| Valeur | CLV = cote obtenue × probabilité équitable de clôture ; moyenne, IC 95 % bootstrap, part > 1 | `metrics.clv`, `strategy.summarise_bets` |
| Rendement | ROI à mise fixe et Kelly 1/8 plafonné à 2 % ; IC 95 % bootstrap ; P(ROI < 0) | `metrics.roi`, `bootstrap_ci`, `staking` |
| Risque | Drawdown maximal en unités, plus longue série perdante, probabilité de perte à 500 paris (rééchantillonnage) | `max_drawdown`, `longest_losing_streak`, `prob_loss_at_horizon` |
| Volume | Nombre de paris par saison et par stratégie | `n_bets` |

## 6. Sensibilité

À exécuter avant tout verdict « poursuivre », chaque variante étant inscrite au registre :

- **Cotes** : Max → Avg → B365 → FR_SIM 8 %, 12 %, 15 %. La stratégie doit rester à CLV > 1 contre Avg pour être crédible.
- **Seuil d'espérance** : 0 %, 2 %, 4 %, 6 %. Une CLV qui n'apparaît qu'à un seuil précis est un artefact.
- **Données manquantes** : retirer aléatoirement 20 % des xG ; retirer une ligue entière ; le modèle doit se dégrader continûment, pas s'effondrer.
- **Coûts** : plafond de mise à 50 % des mises simulées (limitation de compte) ; retard d'exécution (cote jouée = cote de clôture au lieu de pré-clôture).
- **Hyperparamètres** : ξ ∈ {0,002 ; 0,0035 ; 0,005}, K ∈ {15 ; 20 ; 30}, refit 7 et 14 jours.

## 7. Contrôle du surapprentissage par multiplication des essais

- Toute stratégie et toute hypothèse sont inscrites dans `registry/` avant exécution, avec la date.
- Le rapport final indique le nombre total d'essais effectués.
- Les IC de CLV des stratégies retenues sont corrigés pour tests multiples (Holm) avant le verdict.
- La saison sous scellés tranche en dernier ressort, une seule fois.

## 8. Reproductibilité

- Bruts conservés avec empreinte SHA-256 (`data/raw/<source>/<date>/`).
- `matches.parquet`, `odds.parquet`, `xg.parquet` régénérables depuis les bruts par `p0 build` et `p0 xg`.
- Chaque rapport écrit `predictions_<horodatage>.parquet` et `model_eval_<horodatage>.csv`.
- Graine fixe pour les bootstraps (`seed=0`).
- Version du code : commit git noté dans le rapport (à ajouter au `meta` en M1).

## 9. Après le backtest : paper trading

Le backtest ne remplace pas l'épreuve prospective. La phase M2 applique le même moteur en temps réel : prédictions horodatées avant le coup d'envoi, cotes relevées à la minute, CLV calculée avec la clôture réelle. Les critères de sortie sont ceux du livrable 10 §2.2.
