"""Extraction des xG de match depuis Understat.

Understat n'a pas d'API officielle ni de conditions d'utilisation identifiées (livrable 2, A2).
Ce module applique donc : un délai minimal entre requêtes, un cache disque complet, un User-Agent
identifiable, et il s'arrête à la première réponse 403/429. Les pages de ligue contiennent un bloc
JavaScript `datesData = JSON.parse('...')` dont la chaîne est échappée en \\xNN ; on le décode.

Ligues : EPL, La_liga, Bundesliga, Serie_A, Ligue_1, RFPL ; saisons depuis 2014 (année de début).
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

import pandas as pd

from p0.schema import XG_COLUMNS

LEAGUES = {"ENG1": "EPL", "ESP1": "La_liga", "GER1": "Bundesliga", "ITA1": "Serie_A", "FRA1": "Ligue_1"}
URL = "https://understat.com/league/{league}/{season}"
MIN_DELAY_S = 6.0

_DATES_RE = re.compile(r"datesData\s*=\s*JSON\.parse\('((?:\\.|[^'\\])*)'\)")


def decode_js_string(s: str) -> str:
    """Décode les échappements \\xNN et \\uNNNN d'une chaîne JavaScript."""
    s = re.sub(r"\\x([0-9a-fA-F]{2})", lambda m: chr(int(m.group(1), 16)), s)
    s = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s)
    return s.replace("\\'", "'").replace('\\"', '"').replace("\\\\", "\\")


def parse_league_page(html: str) -> pd.DataFrame:
    """Extrait les matchs (id, date, équipes, buts, xG) d'une page de ligue Understat."""
    m = _DATES_RE.search(html)
    if not m:
        raise ValueError("bloc datesData introuvable : structure de page modifiée ?")
    data = json.loads(decode_js_string(m.group(1)))
    rows = []
    for g in data:
        if not g.get("isResult"):
            continue
        rows.append({
            "understat_id": str(g["id"]), "date": pd.Timestamp(g["datetime"]),
            "home": g["h"]["title"], "away": g["a"]["title"],
            "hg": int(g["goals"]["h"]), "ag": int(g["goals"]["a"]),
            "home_xg": float(g["xG"]["h"]), "away_xg": float(g["xG"]["a"]),
        })
    return pd.DataFrame(rows)


class UnderstatClient:
    def __init__(self, cache_dir: Path, fetch=None, min_delay_s: float = MIN_DELAY_S):
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.min_delay_s = min_delay_s
        self._last = 0.0
        if fetch is None:
            import requests

            def fetch(url: str) -> str:
                r = requests.get(url, timeout=60, headers={"User-Agent": "paris-sportifs-p0 (usage personnel, cache local)"})
                if r.status_code in (403, 429):
                    raise PermissionError(f"Understat a répondu {r.status_code} : arrêt, ne pas insister")
                r.raise_for_status()
                return r.text
        self._fetch = fetch

    def league_season(self, competition: str, season: int, refresh: bool = False) -> pd.DataFrame:
        league = LEAGUES[competition]
        cache = self.cache_dir / f"{league}_{season}.html"
        if cache.exists() and not refresh:
            html = cache.read_text(encoding="utf-8")
        else:
            wait = self.min_delay_s - (time.monotonic() - self._last)
            if wait > 0:
                time.sleep(wait)
            html = self._fetch(URL.format(league=league, season=season))
            self._last = time.monotonic()
            cache.write_text(html, encoding="utf-8")
        df = parse_league_page(html)
        df["competition"] = competition
        df["season"] = season
        return df


def to_xg_table(understat_df: pd.DataFrame, match_ids: pd.Series, observed_at: pd.Timestamp) -> pd.DataFrame:
    """Assemble la table xg du schéma P0 une fois les match_id rapprochés (même index)."""
    out = pd.DataFrame({
        "match_id": match_ids.values, "provider": "understat",
        "home_xg": understat_df["home_xg"].values, "away_xg": understat_df["away_xg"].values,
        "observed_at": observed_at,
    })
    return out[XG_COLUMNS]
