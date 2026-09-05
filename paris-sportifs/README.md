# Paris sportifs : outil d'analyse et de simulation

Projet indépendant de l'application Ti Kanal hébergée dans ce dépôt. Tout ce qui le concerne vit dans `paris-sportifs/`.

Objet : estimer des probabilités d'issues sportives à partir de sources recoupées, les comparer aux cotes des bookmakers, et évaluer des stratégies sur données historiques puis en paris fictifs. L'outil doit pouvoir conclure « aucun pari intéressant ». Il ne promet ni gain ni rentabilité.

## Livrables

| N° | Livrable | Fichier | Statut |
|---|---|---|---|
| 1 | Étude de faisabilité et choix du premier sport | `docs/01-etude-de-faisabilite.md` | Rédigé, à réviser après P0 |
| 2 | Inventaire vérifié des sources de données | `docs/02-inventaire-des-sources.md` | Rédigé, vérifications réseau partielles (voir document) |
| 3 | Périmètre MVP | `docs/03-perimetre-mvp.md` | À faire |
| 4 | Architecture technique et schéma de base | | À faire |
| 5 | Plan de collecte, nettoyage, rapprochement | | À faire |
| 6 | Premier modèle de référence | | À faire (prototype P0) |
| 7 | Protocole de backtest reproductible | | À faire |
| 8 | Maquettes des écrans principaux | | À faire |
| 9 | Feuille de route, coûts, dépendances | | À faire |
| 10 | Critères poursuivre / corriger / abandonner | Ébauche dans `docs/01`, §6.2 | À formaliser |

## Principes non négociables

- La cote de clôture de Pinnacle, marge retirée, est la référence. Un modèle est jugé d'abord sur sa capacité à s'en approcher, ensuite sur sa capacité à la battre là où il a raison.
- Toute prédiction est horodatée avant le coup d'envoi et stockée de façon immuable, avec la version du modèle et des données.
- Aucune information postérieure à l'heure de décision n'entre dans une prédiction. Les événements en direct sont séparés des données d'avant-match.
- Chaque famille de variables doit démontrer son utilité hors échantillon avant d'être conservée.
- Les combinés ne sont pas évalués tant que les paris simples n'ont pas prouvé quelque chose.
- Le moteur statistique calcule les probabilités. Une IA peut extraire, rapprocher, expliquer ; elle ne modifie pas une probabilité.
