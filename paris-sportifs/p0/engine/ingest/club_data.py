"""Source de secours : « Club Football Match Data 2000-2025 » (github.com/xgabora/Club-Football-Match-Data-2000-2025).

Jeu dérivé de Football-Data.co.uk (résultats, statistiques, cotes Bet365 et maximum du marché, plus/moins
2,5, handicap asiatique) et de ClubElo, licence MIT, mis à jour régulièrement (dernière ligne lue :
3 septembre 2026). Noms d'équipes identiques à ceux de Football-Data.

Limites, à garder en tête : **aucune cote de clôture** (donc pas de CLV, et le verdict automatique du
rapport sera « indéterminé ») ; une seule série de cotes par bookmaker (Bet365 pré-clôture) ; pas
d'arbitre ; l'origine exacte des colonnes n'est pas documentée ligne à ligne. Cette source sert à
démarrer (validation des alias, construction des tables, premiers modèles) quand Football-Data est
indisponible ; elle ne remplace pas les fichiers originaux pour la mesure de valeur.
"""
from __future__ import annotations

import hashlib
import io
from pathlib import Path

import numpy as np
import pandas as pd

from engine.ingest.football_data import DIV_TO_COMPETITION
from engine.schema import MATCH_COLUMNS, ODDS_COLUMNS

URL = "https://raw.githubusercontent.com/xgabora/Club-Football-Match-Data-2000-2025/main/data/Matches.csv"
SOURCE = "club-data-xgabora"

STATS = {"HomeShots": "hs", "AwayShots": "as_", "HomeTarget": "hst", "AwayTarget": "ast", "HomeCorners": "hc",
         "AwayCorners": "ac", "HomeYellow": "hy", "AwayYellow": "ay", "HomeRed": "hr", "AwayRed": "ar",
         "HTHome": "hg_ht", "HTAway": "ag_ht"}


def season_of(date: pd.Series) -> pd.Series:
    """Saison = année de début : juillet à décembre -> année courante, janvier à juin -> année précédente."""
    return np.where(date.dt.month >= 7, date.dt.year, date.dt.year - 1)


def normalise(df: pd.DataFrame, divs: list[str], snapshot: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    df = df[df["Division"].isin(divs)].copy()
    date = pd.to_datetime(df["MatchDate"], errors="coerce")
    t = pd.to_datetime(df["MatchTime"], format="%H:%M", errors="coerce") if "MatchTime" in df else pd.Series(pd.NaT, index=df.index)
    has_t = t.notna()
    kickoff = date + pd.Timedelta(hours=15)
    kickoff = kickoff.where(~has_t, date + pd.to_timedelta(t.dt.hour.fillna(0), unit="h") + pd.to_timedelta(t.dt.minute.fillna(0), unit="m"))
    ok = date.notna() & df["HomeTeam"].notna() & df["AwayTeam"].notna()
    df, kickoff, has_t = df[ok], kickoff[ok], has_t[ok]
    comp = df["Division"].map(DIV_TO_COMPETITION)
    season = pd.Series(season_of(pd.to_datetime(df["MatchDate"])), index=df.index)
    key = comp + "_" + season.astype(str) + "_" + df["HomeTeam"].astype(str) + "_" + df["AwayTeam"].astype(str)
    match_id = key.map(lambda k: hashlib.sha1(k.encode()).hexdigest()[:12])
    num = lambda c: pd.to_numeric(df[c], errors="coerce") if c in df else pd.Series(np.nan, index=df.index)
    m = pd.DataFrame({
        "match_id": match_id.values, "competition": comp.values, "season": season.values.astype(int), "date": kickoff.values,
        "kickoff_precision": np.where(has_t, "minute", "day"), "home": df["HomeTeam"].str.strip().values,
        "away": df["AwayTeam"].str.strip().values, "hg": num("FTHome").values, "ag": num("FTAway").values,
    })
    for src, dst in STATS.items():
        m[dst] = num(src).values
    m["referee"] = None
    m["snapshot"] = snapshot
    m = m[MATCH_COLUMNS]

    pre_at = (pd.to_datetime(m["date"]).dt.normalize() - pd.Timedelta(days=1) + pd.Timedelta(hours=15)).values
    rows = []

    def add(cols, bk, market, sels, line):
        for c, sel in zip(cols, sels):
            rows.append(pd.DataFrame({"match_id": m["match_id"].values, "bookmaker": bk, "market": market, "line": line,
                                      "selection": sel, "price": num(c).values, "is_closing": False, "observed_at": pre_at,
                                      "observed_precision": "afternoon"}))

    add(["OddHome", "OddDraw", "OddAway"], "B365", "1x2", ("home", "draw", "away"), np.nan)
    add(["MaxHome", "MaxDraw", "MaxAway"], "Max", "1x2", ("home", "draw", "away"), np.nan)
    add(["Over25", "Under25"], "B365", "ou", ("over", "under"), 2.5)
    add(["MaxOver25", "MaxUnder25"], "Max", "ou", ("over", "under"), 2.5)
    odds = pd.concat(rows, ignore_index=True)
    odds = odds[odds["price"].notna() & (odds["price"] >= 1.01) & (odds["price"] <= 1000)][ODDS_COLUMNS].reset_index(drop=True)
    return m, odds


def download(raw_dir: Path, fetch=None) -> Path:
    """Télécharge Matches.csv (~45 Mo) dans raw_dir/club-data-xgabora/<date>/ avec empreinte et provenance."""
    import datetime as dt

    import requests

    if fetch is None:
        def fetch(url):
            r = requests.get(url, timeout=300, headers={"User-Agent": "paris-sportifs-p0 (usage personnel)"})
            r.raise_for_status()
            return r.content
    raw = fetch(URL)
    out = raw_dir / SOURCE / dt.date.today().isoformat()
    out.mkdir(parents=True, exist_ok=True)
    p = out / "Matches.csv"
    p.write_bytes(raw)
    (out / "Matches.csv.sha256").write_text(hashlib.sha256(raw).hexdigest())
    (out / "Matches.csv.source").write_text(URL)
    return p


def load_latest(raw_dir: Path, divs: list[str]) -> tuple[pd.DataFrame, pd.DataFrame]:
    files = sorted((raw_dir / SOURCE).glob("*/Matches.csv"))
    if not files:
        raise FileNotFoundError("aucun Matches.csv : lancer `p0 import-club-data` d'abord")
    p = files[-1]
    df = pd.read_csv(io.BytesIO(p.read_bytes()), low_memory=False)
    return normalise(df, divs, snapshot=f"{SOURCE}/{p.parent.name}")
