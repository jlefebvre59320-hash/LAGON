# Guide pas à pas : exécuter P0 sur votre poste

Rédigé le 2026-09-05. Ce guide couvre la phase P0 (livrable 9 §1), du poste vide au verdict. Chaque étape indique la commande, la durée attendue, ce que vous devez voir, et quoi faire si ce n'est pas le cas. Les commandes sont données pour Linux et macOS ; sous Windows, utilisez WSL ou remplacez `. .venv/bin/activate` par `.venv\Scripts\activate`.

**Collez les commandes une par une, sans les lignes de commentaires.** Dans zsh (le shell par défaut de macOS), une ligne commençant par `#` collée dans le terminal n'est pas un commentaire : elle produit `unknown file attribute` et peut désynchroniser les commandes suivantes (un second `git clone` s'exécute alors dans le mauvais dossier). L'aide-mémoire en fin de guide est sans commentaires pour cette raison.

Temps total estimé : une demi-journée de manipulation, dont une à deux heures de validation manuelle des noms d'équipes, plus le temps de calcul du backtest (30 à 60 minutes).

---

## Étape 0 : prérequis (10 minutes)

Vous avez besoin de Python 3.11 ou plus récent, de git, d'un accès Internet non filtré vers football-data.co.uk et understat.com, et de 2 Go d'espace disque.

```bash
python3 --version        # doit afficher 3.11 ou plus
git --version
```

Si Python est absent ou trop ancien : installez-le depuis python.org (Windows, macOS) ou via le gestionnaire de paquets (Linux : `sudo apt install python3.11 python3.11-venv`).

## Étape 1 : récupérer le code (2 minutes)

```bash
git clone -b claude/sports-betting-analysis-app-fm181u https://github.com/jlefebvre59320-hash/LAGON.git
cd LAGON/paris-sportifs/p0
```

Vous devez voir les dossiers `engine/` (le paquet Python), `tests/`, `data/` et le fichier `pyproject.toml`.

## Étape 2 : environnement Python et tests (5 minutes)

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
pytest
```

Attendu : `21 passed` en une vingtaine de secondes. Ces tests tournent sur des données synthétiques ; ils vérifient le moteur, pas les données réelles.

En cas d'échec : copiez la sortie complète et arrêtez-vous là ; c'est un problème de code ou d'environnement, pas de données.

## Étape 3 : vérifier les sources depuis votre poste (30 minutes, une fois)

Les neuf points du livrable 2 §G n'ont pas pu être relus depuis l'environnement de rédaction. Avant de dépendre des données, ouvrez dans un navigateur :

1. https://www.football-data.co.uk/notes.txt et https://www.football-data.co.uk/data.php : la saison d'apparition des colonnes de clôture (`PSCH`, `B365CH`) ; notez-la dans `docs/00-journal-des-decisions.md`.
2. https://understat.com : cherchez un lien « Terms » ou « Conditions » en bas de page. S'il en existe un qui interdit l'accès automatisé, **n'exécutez pas l'étape 7** et signalez-le.
3. Les autres points (The Odds API, ANJ, API-Football, Transfermarkt, Betfair, Wikidata) ne concernent pas P0 ; ils peuvent attendre M1.

## Étape 4 : télécharger Football-Data (5 à 10 minutes)

```bash
p0 download --seasons 2000 2025
```

Attendu : `130 fichiers téléchargés dans .../data/raw/football-data`. Chaque fichier a une empreinte `.sha256` à côté. Volume : environ 15 Mo. Le téléchargeur attend une seconde entre deux fichiers, réessaie jusqu'à cinq fois (2, 4, 8, 16 s) sur une erreur 503 ou réseau, et continue avec les fichiers suivants si l'un échoue.

Si la commande se termine par `N fichier(s) en échec`, relancez-la telle quelle quelques minutes plus tard : les fichiers déjà présents sont sautés, seuls les manquants sont retentés. Une erreur 404 sur une saison ancienne d'une ligue signifie que le fichier n'existe pas sur le site ; l'historique commence plus tard pour cette ligue, ce n'est pas bloquant.

Le site football-data.co.uk est un site personnel ; le 5 septembre 2026 il est resté indisponible plus de cinq heures. Deux voies de secours, dans cet ordre :

```bash
p0 download --seasons 2000 2024 --via-wayback
```

lit les copies de l'archive Internet (Wayback Machine) des mêmes fichiers. Pour une saison terminée, la copie est identique à l'original ; la provenance est notée dans un fichier `.source` à côté de chaque CSV. Les fichiers non archivés sont signalés en échec et seront repris sur le site quand il reviendra (la relance saute ceux déjà présents). La saison en cours n'est pas à prendre par cette voie.

```bash
p0 import-club-data
```

télécharge un jeu dérivé de Football-Data maintenu sur GitHub (licence MIT, 45 Mo, cotes Bet365 et maximum du marché, **sans cotes de clôture**). Il permet de faire les étapes 5 à 7 (`p0 aliases --source club`, `p0 build --source club`) et de commencer les modèles, mais ni la CLV ni le verdict automatique. Reconstruire depuis Football-Data dès que possible.

## Étape 5 : état des noms d'équipes (2 minutes)

```bash
p0 aliases
```

Attendu : le nombre d'équipes distinctes dans les bruts (de l'ordre de 150 à 170 sur 26 saisons et 5 ligues), la liste des noms **inconnus** de la table d'alias, et la liste des alias **non validés** effectivement présents. Au premier lancement, tous les alias sont non validés (c'est voulu) et quelques dizaines de noms sont probablement inconnus (clubs promus anciens que la table livrée ne couvre pas).

## Étape 6 : compléter et valider les alias (1 à 2 heures, une fois)

C'est l'étape manuelle du projet, et elle ne se contourne pas. Un mauvais rapprochement fausse silencieusement tout le reste.

1. Ouvrez `engine/reconcile/aliases.csv` dans un tableur ou un éditeur. Colonnes : `canonical, source, alias, method, validated`.
2. Pour chaque nom inconnu affiché par `p0 aliases`, ajoutez une ligne `canonical,football-data,<nom Football-Data>,manual,true` (la commande affiche déjà la ligne à coller, il ne manque que le nom canonique). Le nom canonique est celui d'Understat quand l'équipe y figure, sinon un nom lisible de votre choix, stable dans le temps.
3. Pour chaque alias existant, vérifiez que `alias` désigne bien `canonical` (exemple : `Ath Bilbao` → `Athletic Club`). Corrigez les erreurs éventuelles ; la table a été rédigée de mémoire et n'a pas été relue contre les fichiers.
4. Une fois relu, marquez les alias validés. Deux façons : mettre `true` dans la colonne `validated` directement, ou écrire les alias relus dans un fichier texte (un par ligne) et lancer :

```bash
p0 aliases --mark-validated alias_relus.txt
```

5. Relancez `p0 aliases` jusqu'à obtenir `Alias inconnus : 0` et `Alias Football-Data non validés et présents dans les données : 0`.

Les alias Understat (`source = understat`) se valident à l'étape 7, quand vous verrez les noms réels.

## Étape 7 : construire les tables (2 minutes)

```bash
p0 build
```

Attendu : quelques lignes `QUALITÉ : ...` (normales sur les saisons anciennes : colonnes absentes, cotes manquantes) puis `N matchs, M relevés de cotes écrits dans .../data/processed`. Ordre de grandeur : 45 000 matchs, plusieurs millions de relevés.

Si la commande s'arrête sur `X équipes après rapprochement, attendu 18 ou 20` : deux alias pointent vers le même canonique ou un alias manque pour une saison ; la ligne indique la ligue, la saison et la liste des équipes, ce qui suffit à trouver le doublon. Corrigez le CSV et relancez.

Si vous voulez avancer sans avoir tout validé (pour un essai), `p0 build --accept-unvalidated` passe outre. Ne faites pas de backtest de référence dans ce mode.

## Étape 8 : récupérer les xG Understat (15 à 20 minutes)

Uniquement si l'étape 3 point 2 n'a rien révélé de contraire.

```bash
p0 xg --seasons 2014 2025 --accept-unvalidated
```

Le client attend au moins 6 secondes entre deux pages (60 pages, donc 6 minutes minimum), met chaque page en cache dans `data/raw/understat/` et s'arrête net si le site répond 403 ou 429. Attendu : une ligne par ligue et saison, `ENG1 2014 : 380 xG`, et éventuellement `N matchs Understat non rapprochés`.

Pour chaque match non rapproché, le nom Understat n'est pas dans la table : ajoutez la ligne `canonical,understat,<nom Understat>,manual,true` et relancez (le cache évite de retélécharger). Quand tout est rapproché, passez les alias Understat en `validated=true` et relancez sans `--accept-unvalidated`.

## Étape 9 : le backtest (30 à 60 minutes de calcul)

```bash
p0 backtest --test-seasons 2019 2024 --refit-days 7
```

**Ne mettez pas 2025 dans la plage.** La saison 2025/26 est sous scellés (livrable 10 §2.1) ; elle ne sera ouverte qu'une fois, après que les stratégies retenues auront été figées par écrit.

Le rapport s'affiche et s'écrit dans `reports/backtest_<date>.md`, avec les prédictions (`predictions_<date>.parquet`) et l'évaluation par modèle (`model_eval_<date>.csv`). Avec `--verbose`, chaque refit hebdomadaire est affiché.

Si le calcul est trop long, `--refit-days 14` divise la durée par deux au prix d'un léger retard d'information.

## Étape 10 : lire le rapport (30 minutes)

Dans l'ordre :

1. **Section 1, marché 1x2.** `market_close` doit être en tête ou proche. Si un modèle bat la clôture de plus de 1 % de log-loss, ne vous réjouissez pas : cherchez une fuite (livrable 7 §3) avant toute autre chose.
2. **Écart relatif** entre le meilleur modèle hors marché et la clôture : c'est le chiffre qui décide entre « corriger » et « abandonner cette voie ».
3. **Section 2.** Pour chaque stratégie, regardez la CLV et son intervalle **avant** le ROI. Un ROI positif avec une CLV inférieure à 1 est de la chance de sélection, le rapport synthétique l'a montré (livrable 6 §3).
4. **Section 3.** Les déciles extrêmes sont-ils peuplés ? Un écart de calibration supérieur à 0,05 sur un décile de plus de 100 paris est un défaut du modèle.
5. **Section 4.** Le verdict automatique applique les seuils du livrable 10. Il ne remplace pas la lecture, il l'encadre.

## Étape 11 : consigner (20 minutes)

1. Dans `engine/registry/hypotheses.yaml`, renseignez `outcome` pour H0 à H5 avec les chiffres du rapport (une phrase chacune).
2. Dans `docs/00-journal-des-decisions.md`, ajoutez une ligne : date, verdict P0, écart de log-loss, meilleure CLV et son IC, nombre total d'essais effectués (y compris ceux qui n'ont pas donné de rapport).
3. Commitez le registre, le journal et le rapport Markdown (pas les Parquet ni les CSV, exclus par `.gitignore`) :

```bash
cd ..
git add p0/engine/registry/hypotheses.yaml docs/00-journal-des-decisions.md p0/reports/*.md p0/engine/reconcile/aliases.csv
git commit -m "P0 : premier backtest réel, alias validés, verdict consigné"
git push
```

## Étape 12 : et ensuite

| Verdict | Action suivante |
|---|---|
| Poursuivre | M1 (livrable 9) : installer PostgreSQL en local, appliquer `db/schema.sql`, brancher le moteur |
| Corriger | Ajouter **une** famille de variables (ordre du livrable 1 §5, la famille 3 « calendrier » est la première candidate), l'inscrire dans `hypotheses.yaml` avant de coder, relancer une fois |
| Abandonner cette voie | Décision entre tennis, historique de cotes payant, ou arrêt ; le livrable 10 §2.1 donne les trois options |

Dans tous les cas, la saison 2025/26 reste scellée jusqu'à ce que les stratégies retenues soient figées par un commit daté.

---

## Aide-mémoire des commandes (sans commentaires, à coller ligne par ligne)

```bash
cd LAGON/paris-sportifs/p0
. .venv/bin/activate
p0 download --seasons 2000 2025
p0 aliases
p0 aliases --mark-validated alias_relus.txt
p0 build
p0 xg --seasons 2014 2025 --accept-unvalidated
p0 backtest --test-seasons 2019 2024 --refit-days 7
pytest
```
