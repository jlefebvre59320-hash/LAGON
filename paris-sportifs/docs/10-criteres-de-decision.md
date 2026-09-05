# Critères pour poursuivre, corriger ou abandonner

Livrable 10 sur 10. Rédigé le 2026-09-05. Ces critères sont fixés avant de voir les résultats et ne seront pas déplacés après. Toute modification passe par une nouvelle version datée de ce document, avec la justification, avant l'exécution du test concerné.

## 1. Vocabulaire

- **Clôture** : cote de clôture Pinnacle (à défaut : maximum du marché), marge retirée par Shin.
- **CLV** : cote obtenue × probabilité équitable de clôture. Moyenne calculée sur les paris sélectionnés ; intervalle de confiance à 95 % par bootstrap.
- **Écart de log-loss** : (log-loss du modèle − log-loss de la clôture) / log-loss de la clôture, sur les mêmes matchs.
- **Exposition égale** : toutes les stratégies comparées misent le même total sur la même période.

## 2. Critères par phase

### 2.1 Fin de P0 (backtest, saisons 2019/20 à 2024/25, saison 2025/26 sous scellés)

| Verdict | Condition | Action |
|---|---|---|
| **Poursuivre** | Au moins une stratégie pré-enregistrée avec : CLV moyenne > 1,00 et borne basse de l'IC 95 % > 1,00 ; au moins 300 paris par saison test ; ROI à mise fixe contre Max dont l'IC 95 % ne contient pas de valeur < −1 % ; résultat reproduit sur la saison sous scellés (ouverte une seule fois) | Passer à M1 |
| **Corriger** | Écart de log-loss du meilleur modèle hors marché ≤ 1 % mais aucune stratégie ne satisfait les conditions ci-dessus | Ajouter **une** famille de variables dans l'ordre du livrable 1 §5, réitérer **une** fois ; si toujours « corriger », traiter comme « abandonner cette voie » |
| **Abandonner cette voie** | Écart de log-loss > 3 % après les familles 1 à 4, ou deux itérations « corriger » consécutives | Choisir entre : tennis (Elo par surface, données à auditer), historique de cotes horodatées payant pour mesurer la CLV à J-2, ou arrêt du projet |

Règle de la saison sous scellés : elle n'est évaluée qu'une fois, après que les stratégies retenues sur les saisons précédentes ont été figées par écrit. Si le résultat sous scellés contredit le backtest (CLV ≤ 1 ou ROI < −3 %), le verdict est « corriger » au mieux.

### 2.2 Fin de M2 (paper trading prospectif, ≥ 200 paris fictifs, ≥ 12 semaines)

| Verdict | Condition |
|---|---|
| **Poursuivre** | CLV moyenne prospective > 1,00 avec IC 95 % excluant 1 ; calibration du modèle (ECE) ≤ 0,03 sur les paris joués ; aucun incident de fuite de données |
| **Corriger** | CLV entre 0,99 et 1,01, ou ECE entre 0,03 et 0,05 : un cycle de correction, puis 8 semaines de paper trading supplémentaires |
| **Abandonner** | CLV < 0,99 sur ≥ 200 paris, ou incident de fuite non expliqué, ou ROI simulé « France » (opérateurs agréés réellement relevés) < −5 % avec IC excluant 0 alors que la CLV contre Pinnacle est positive : l'avantage existe mais n'est pas capturable depuis la France |

Le troisième cas mérite d'être écrit à l'avance : c'est le résultat le plus probable si le modèle est bon. Il vaut arrêt du volet « paris » et éventuellement poursuite du volet « analyse » comme outil de compréhension, sans portefeuille.

### 2.3 Familles de variables (à chaque ajout)

Une famille est conservée si, en walk-forward, elle remplit **les trois** conditions : log-loss médiane par saison améliorée contre le résultat ; log-loss contre la clôture non dégradée ; CLV de la stratégie de référence non dégradée. Sinon elle est retirée et l'hypothèse est marquée « dropped » dans le registre.

### 2.4 Combinés (phase 2 éventuelle)

Aucun combiné n'est évalué avant un verdict « poursuivre » en M2. Condition d'ouverture du chantier : un modèle des dépendances entre sélections (au minimum, corrélation empirique des résidus entre marchés d'un même match et entre matchs d'une même journée) validé hors échantillon. Condition de conservation : à exposition égale, probabilité de perte à 500 paris et drawdown non supérieurs à ceux des paris simples, pour un rendement au moins égal.

## 3. Garde-fous permanents

- Un ROI positif sans CLV positive est classé « chance » et n'ouvre aucun droit à poursuivre.
- Aucun changement de seuil, de modèle ou de stratégie n'est appliqué au portefeuille fictif avant d'avoir été pré-enregistré.
- Toute stratégie testée est comptée, y compris celles abandonnées : le rapport final indique le nombre total d'essais et applique une correction pour tests multiples (Bonferroni ou Holm sur les IC de CLV) avant de déclarer « poursuivre ».
- Le drawdown maximal historique et la plus longue série perdante sont affichés à côté de tout rendement.
- Les limites de budget, de mise et d'exposition ne sont pas des suggestions : le moteur refuse une mise fictive qui les dépasse.
- Le verdict « aucun pari intéressant » sur une journée entière est un fonctionnement normal et n'est pas un défaut à corriger.

## 4. Revue

Une revue à date fixe (fin de P0, fin de M2, fin de M3) applique ces critères et produit une décision écrite en une page : verdict, chiffres, nombre d'essais, ce qui change. La revue est faite avant de regarder les résultats de la semaine en cours.
