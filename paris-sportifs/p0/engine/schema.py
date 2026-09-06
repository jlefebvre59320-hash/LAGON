"""Schéma des tableaux P0 (Parquet). Miroir simplifié de db/schema.sql.

matches : une ligne par match.
  match_id (str), competition (str: ENG1..), season (int: année de début), date (datetime64, heure locale
  approx. 15:00 si inconnue), kickoff_precision ('minute'|'day'), home, away (noms canoniques),
  hg, ag (int, buts), hg_ht, ag_ht, hs, as_, hst, ast, hc, ac, hy, ay, hr, ar, referee, snapshot (str)

odds : une ligne par relevé.
  match_id, bookmaker (str: 'B365','PS','Max','Avg'...), market ('1x2'|'ou'), line (float|NaN),
  selection ('home'|'draw'|'away'|'over'|'under'), price (float), is_closing (bool),
  observed_at (datetime64 : approximation documentée), observed_precision (str)

xg : une ligne par match et fournisseur.
  match_id, provider, home_xg, away_xg, observed_at
"""
from __future__ import annotations

MATCH_COLUMNS = [
    "match_id", "competition", "season", "date", "kickoff_precision", "home", "away",
    "hg", "ag", "hg_ht", "ag_ht", "hs", "as_", "hst", "ast", "hc", "ac", "hy", "ay", "hr", "ar",
    "referee", "snapshot",
]
ODDS_COLUMNS = [
    "match_id", "bookmaker", "market", "line", "selection", "price", "is_closing",
    "observed_at", "observed_precision",
]
XG_COLUMNS = ["match_id", "provider", "home_xg", "away_xg", "observed_at"]

SELECTIONS_1X2 = ("home", "draw", "away")
SELECTIONS_OU = ("over", "under")
