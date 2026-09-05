# P0 : moteur probabiliste et backtest

Prototype décrit dans `../docs/06-modele-de-reference.md` et `../docs/07-protocole-de-backtest.md`.

```bash
python -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
pytest                                        # tests sur données synthétiques
p0 synthetic --seasons 2015 2022              # monde simulé dans data/synthetic
p0 backtest --data data/synthetic --test-seasons 2019 2022 --refit-days 14
```

Données réelles (poste avec accès à football-data.co.uk et understat.com) :

```bash
p0 download --seasons 2000 2025
p0 build --accept-unvalidated                 # révèle les alias manquants
# éditer p0/reconcile/aliases.csv : corriger, puis validated=true après vérification
p0 build
p0 xg --seasons 2014 2025
p0 backtest --test-seasons 2019 2024
```

Ne jamais inclure la saison 2025/26 dans `--test-seasons` avant la fin de P0 (saison sous scellés).

Conditions d'usage des sources : voir `../docs/02-inventaire-des-sources.md`. Understat n'a pas de conditions publiées ; le client attend au moins 6 s entre deux requêtes, met tout en cache et s'arrête au premier 403 ou 429.
