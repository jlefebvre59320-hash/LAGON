"""Extraction des xG de match depuis Understat.

Understat n'a pas d'API officielle ni de conditions d'utilisation identifiées (livrable 2, A2 ; la page
de ligue ne contient aucun lien vers des conditions, vérifié le 2026-09-06). Depuis 2025 la page HTML
est vide et les données sont chargées par le navigateur via `GET /getLeagueData/{league}/{season}`
(lu dans js/league.min.js le 2026-09-06). Le serveur répond 404 sans les en-têtes d'une requête
XMLHttpRequest, et renvoie du JSON compressé gzip (magic 1f 8b), avec ou sans Content-Encoding.

Règles appliquées : délai minimal entre requêtes, cache disque complet du brut, User-Agent de
navigateur, arrêt définitif au premier 403 ou 429.

Structure lue le 2026-09-06 (EPL 2014) : {"teams": {id: {"id", "title", "history": [{"h_a", "date",
"scored", "missed", "xG", "xGA", "npxG", "npxGA", "xpts", "ppda", "deep", ...}]}}, ...}. Les matchs
sont reconstitués en appariant l'entrée domicile d'un club et l'entrée extérieur de l'autre à la même
date avec buts et xG croisés. Si une liste de matchs (`dates` ou `datesData`, ancien format) existe,
elle est utilisée en priorité.

Ligues : EPL, La_liga, Bundesliga, Serie_A, Ligue_1, RFPL ; saisons depuis 2014 (année de début).
"""
from __future__ import annotations

import gzip
import json
import re
import time
from pathlib import Path

import pandas as pd

from engine.schema import XG_COLUMNS

LEAGUES = {"ENG1": "EPL", "ESP1": "La_liga", "GER1": "Bundesliga", "ITA1": "Serie_A", "FRA1": "Ligue_1"}
BASE = "https://understat.com/"
DATA_URL = BASE + "getLeagueData/{league}/{season}"
PAGE_URL = BASE + "league/{league}/{season}"
MIN_DELAY_S = 6.0
BROWSER_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) "
              "Version/17.4 Safari/605.1.15")


def xhr_headers(league: str, season: int) -> dict:
    return {"User-Agent": BROWSER_UA, "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Referer": PAGE_URL.format(league=league, season=season)}


def decode_payload(raw: bytes) -> dict | list:
    """Octets bruts (gzip ou non) -> objet JSON."""
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8"))


# ---- ancien format (bloc datesData dans le HTML), conservé pour les caches existants ----
_DATES_RE = re.compile(r"datesData\s*=\s*JSON\.parse\('((?:\\.|[^'\\])*)'\)")


def decode_js_string(s: str) -> str:
    s = re.sub(r"\\x([0-9a-fA-F]{2})", lambda m: chr(int(m.group(1), 16)), s)
    s = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), s)
    return s.replace("\\'", "'").replace('\\"', '"').replace("\\\\", "\\")


def parse_league_page(html: str) -> pd.DataFrame:
    m = _DATES_RE.search(html)
    if not m:
        raise ValueError("bloc datesData introuvable : la page ne contient plus les données (utiliser getLeagueData)")
    return matches_from_dates(json.loads(decode_js_string(m.group(1))))


def matches_from_dates(data: list) -> pd.DataFrame:
    rows = []
    for g in data:
        if not g.get("isResult", True):
            continue
        rows.append({"understat_id": str(g["id"]), "date": pd.Timestamp(g["datetime"]),
                     "home": g["h"]["title"], "away": g["a"]["title"],
                     "hg": int(g["goals"]["h"]), "ag": int(g["goals"]["a"]),
                     "home_xg": float(g["xG"]["h"]), "away_xg": float(g["xG"]["a"])})
    return pd.DataFrame(rows, columns=["understat_id", "date", "home", "away", "hg", "ag", "home_xg", "away_xg"])


# ---- nouveau format : reconstitution depuis teams[*].history ----
def matches_from_teams(teams: dict) -> pd.DataFrame:
    """Apparie, pour chaque date, l'entrée domicile d'un club avec l'entrée extérieur d'un autre dont
    les buts et les xG sont les images croisées. Lève ValueError si un appariement est ambigu."""
    homes, aways = [], []
    for t in teams.values():
        for h in t.get("history", []):
            rec = {"team": t["title"], "date": pd.Timestamp(h["date"]), "scored": int(h["scored"]),
                   "missed": int(h["missed"]), "xg": float(h["xG"]), "xga": float(h["xGA"])}
            (homes if h["h_a"] == "h" else aways).append(rec)
    by_date: dict[pd.Timestamp, list] = {}
    for a in aways:
        by_date.setdefault(a["date"], []).append(a)
    rows, unmatched = [], 0
    for h in homes:
        cands = [a for a in by_date.get(h["date"], [])
                 if a["scored"] == h["missed"] and a["missed"] == h["scored"]
                 and abs(a["xg"] - h["xga"]) < 1e-3 and abs(a["xga"] - h["xg"]) < 1e-3 and a["team"] != h["team"]]
        if len(cands) != 1:
            unmatched += 1
            continue
        a = cands[0]
        by_date[h["date"]].remove(a)
        rows.append({"understat_id": None, "date": h["date"], "home": h["team"], "away": a["team"],
                     "hg": h["scored"], "ag": h["missed"], "home_xg": h["xg"], "away_xg": h["xga"]})
    df = pd.DataFrame(rows, columns=["understat_id", "date", "home", "away", "hg", "ag", "home_xg", "away_xg"])
    if unmatched:
        df.attrs["unmatched_home_entries"] = unmatched
    return df


def parse_league_payload(data: dict | list) -> pd.DataFrame:
    if isinstance(data, list):
        return matches_from_dates(data)
    for key in ("dates", "datesData", "matches"):
        if key in data and isinstance(data[key], list) and data[key]:
            return matches_from_dates(data[key])
    if "teams" in data:
        return matches_from_teams(data["teams"])
    raise ValueError(f"structure inconnue : clés {list(data)[:10]}")


class UnderstatClient:
    def __init__(self, cache_dir: Path, fetch=None, min_delay_s: float = MIN_DELAY_S):
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.min_delay_s = min_delay_s
        self._last = 0.0
        if fetch is None:
            import requests

            def fetch(url: str, headers: dict) -> bytes:
                r = requests.get(url, timeout=60, headers=headers)
                if r.status_code in (403, 429):
                    raise PermissionError(f"Understat a répondu {r.status_code} : arrêt, ne pas insister")
                r.raise_for_status()
                return r.content
        self._fetch = fetch

    def league_season(self, competition: str, season: int, refresh: bool = False) -> pd.DataFrame:
        league = LEAGUES[competition]
        cache = self.cache_dir / f"{league}_{season}.json.gz"
        legacy = self.cache_dir / f"{league}_{season}.html"
        if cache.exists() and not refresh:
            raw = cache.read_bytes()
        elif legacy.exists() and not refresh and "datesData" in legacy.read_text(encoding="utf-8", errors="ignore"):
            df = parse_league_page(legacy.read_text(encoding="utf-8"))
            df["competition"], df["season"] = competition, season
            return df
        else:
            wait = self.min_delay_s - (time.monotonic() - self._last)
            if wait > 0:
                time.sleep(wait)
            raw = self._fetch(DATA_URL.format(league=league, season=season), xhr_headers(league, season))
            self._last = time.monotonic()
            if raw[:2] != b"\x1f\x8b":
                raw = gzip.compress(raw)  # cache homogène
            cache.write_bytes(raw)
        df = parse_league_payload(decode_payload(raw))
        df["competition"] = competition
        df["season"] = season
        return df


def to_xg_table(understat_df: pd.DataFrame, match_ids: pd.Series, observed_at: pd.Timestamp) -> pd.DataFrame:
    out = pd.DataFrame({"match_id": match_ids.values, "provider": "understat",
                        "home_xg": understat_df["home_xg"].values, "away_xg": understat_df["away_xg"].values,
                        "observed_at": observed_at})
    return out[XG_COLUMNS]
