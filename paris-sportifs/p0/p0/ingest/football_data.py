"""Ingestion des CSV de Football-Data.co.uk.

URL des fichiers (convention publique du site) :
    https://www.football-data.co.uk/mmz4281/{SS}/{DIV}.csv   avec SS = '2324' pour 2023/24.

Les cotes « pré-clôture » sont collectées par le site le vendredi ou le mardi après-midi
(notes.txt). On les horodate donc à J-1 15:00 par rapport au match, avec
observed_precision='afternoon'. Les cotes de clôture (suffixe C) sont horodatées au coup
d'envoi moins une minute, observed_precision='closing'. Ces approximations sont documentées
et propagées jusqu'aux rapports.
"""
from __future__ import annotations

import hashlib
import io
import re
from pathlib import Path

import numpy as np
import pandas as pd

from p0.schema import MATCH_COLUMNS, ODDS_COLUMNS

BASE_URL = "https://www.football-data.co.uk/mmz4281/{ss}/{div}.csv"

DIV_TO_COMPETITION = {"E0": "ENG1", "SP1": "ESP1", "D1": "GER1", "I1": "ITA1", "F1": "FRA1",
                      "E1": "ENG2", "SP2": "ESP2", "D2": "GER2", "I2": "ITA2", "F2": "FRA2"}

# Colonnes de cotes 1N2 : préfixe bookmaker -> (H, D, A). Les agrégats Betbrain (BbMx/BbAv)
# sont renommés Max/Avg pour la continuité des séries.
BOOKMAKERS_1X2 = ["B365", "PS", "P", "BW", "IW", "WH", "VC", "LB", "GB", "SB", "SJ", "SY", "SO", "BS",
                  "1XB", "BF", "BFD", "BMGM", "BV", "CL", "PP", "SK", "Max", "Avg", "BbMx", "BbAv", "BFE"]
BOOKMAKERS_OU = ["B365", "P", "GB", "Max", "Avg", "BbMx", "BbAv", "1XB", "BF", "BV", "PP", "SK", "WH"]

STATS_MAP = {"HS": "hs", "AS": "as_", "HST": "hst", "AST": "ast", "HC": "hc", "AC": "ac",
             "HY": "hy", "AY": "ay", "HR": "hr", "AR": "ar", "HTHG": "hg_ht", "HTAG": "ag_ht"}


def season_code(start_year: int) -> str:
    return f"{start_year % 100:02d}{(start_year + 1) % 100:02d}"


def url_for(start_year: int, div: str) -> str:
    return BASE_URL.format(ss=season_code(start_year), div=div)


def read_csv_bytes(raw: bytes) -> pd.DataFrame:
    """Lit un CSV Football-Data en tolérant l'encodage et les lignes vides de fin."""
    for enc in ("utf-8", "latin-1"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError("encodage inconnu")
    df = pd.read_csv(io.StringIO(text), skip_blank_lines=True, on_bad_lines="skip")
    df = df.dropna(how="all")
    df = df[df.get("HomeTeam", pd.Series(dtype=str)).notna()] if "HomeTeam" in df else df
    df.columns = [c.strip() for c in df.columns]
    return df


def _parse_dates(df: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    """Dates dd/mm/yy ou dd/mm/yyyy ; heure si la colonne Time existe. Retourne (date, précision)."""
    d = pd.to_datetime(df["Date"], dayfirst=True, format="mixed", errors="coerce")
    if "Time" in df.columns and df["Time"].notna().any():
        t = pd.to_datetime(df["Time"], format="%H:%M", errors="coerce")
        has_t = t.notna()
        d = d.where(~has_t, d + pd.to_timedelta(t.dt.hour.fillna(0), unit="h")
                    + pd.to_timedelta(t.dt.minute.fillna(0), unit="m"))
        precision = np.where(has_t, "minute", "day")
        d = d.where(has_t, d + pd.Timedelta(hours=15))
    else:
        precision = np.full(len(df), "day")
        d = d + pd.Timedelta(hours=15)
    return d, pd.Series(precision, index=df.index)


def _num(s: pd.Series) -> pd.Series:
    return pd.to_numeric(s, errors="coerce")


def normalise(df: pd.DataFrame, start_year: int, div: str, snapshot: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Transforme un CSV brut en (matches, odds) au schéma P0. Les noms d'équipes restent ceux
    de la source ; le rapprochement est fait ensuite (reconcile.teams)."""
    comp = DIV_TO_COMPETITION.get(div, div)
    date, precision = _parse_dates(df)
    ok = date.notna() & df["HomeTeam"].notna() & df["AwayTeam"].notna()
    df, date, precision = df[ok].copy(), date[ok], precision[ok]
    key = (comp + "_" + str(start_year) + "_" + df["HomeTeam"].astype(str) + "_" + df["AwayTeam"].astype(str))
    match_id = key.map(lambda k: hashlib.sha1(k.encode()).hexdigest()[:12])
    m = pd.DataFrame({
        "match_id": match_id.values, "competition": comp, "season": start_year, "date": date.values,
        "kickoff_precision": precision.values, "home": df["HomeTeam"].astype(str).str.strip().values,
        "away": df["AwayTeam"].astype(str).str.strip().values,
        "hg": _num(df["FTHG"]).values, "ag": _num(df["FTAG"]).values,
    })
    for src, dst in STATS_MAP.items():
        m[dst] = _num(df[src]).values if src in df.columns else np.nan
    m["referee"] = df["Referee"].values if "Referee" in df.columns else None
    m["snapshot"] = snapshot
    m = m[MATCH_COLUMNS]

    odds_rows = []
    pre_close_at = (pd.to_datetime(m["date"]).dt.normalize() - pd.Timedelta(days=1) + pd.Timedelta(hours=15)).values
    closing_at = (pd.to_datetime(m["date"]) - pd.Timedelta(minutes=1)).values
    for bk in BOOKMAKERS_1X2:
        for closing in (False, True):
            suffix = "C" if closing else ""
            cols = [f"{bk}{suffix}H", f"{bk}{suffix}D", f"{bk}{suffix}A"]
            if not all(c in df.columns for c in cols):
                continue
            name = {"BbMx": "Max", "BbAv": "Avg", "P": "PS", "BFE": "BFEx"}.get(bk, bk)
            for col, sel in zip(cols, ("home", "draw", "away")):
                price = _num(df[col]).values
                odds_rows.append(pd.DataFrame({
                    "match_id": m["match_id"].values, "bookmaker": name, "market": "1x2", "line": np.nan,
                    "selection": sel, "price": price, "is_closing": closing,
                    "observed_at": closing_at if closing else pre_close_at,
                    "observed_precision": "closing" if closing else "afternoon",
                }))
    for bk in BOOKMAKERS_OU:
        for closing in (False, True):
            suffix = "C" if closing else ""
            over, under = f"{bk}{suffix}>2.5", f"{bk}{suffix}<2.5"
            if over not in df.columns or under not in df.columns:
                continue
            name = {"BbMx": "Max", "BbAv": "Avg", "P": "PS"}.get(bk, bk)
            for col, sel in ((over, "over"), (under, "under")):
                odds_rows.append(pd.DataFrame({
                    "match_id": m["match_id"].values, "bookmaker": name, "market": "ou", "line": 2.5,
                    "selection": sel, "price": _num(df[col]).values, "is_closing": closing,
                    "observed_at": closing_at if closing else pre_close_at,
                    "observed_precision": "closing" if closing else "afternoon",
                }))
    odds = pd.concat(odds_rows, ignore_index=True) if odds_rows else pd.DataFrame(columns=ODDS_COLUMNS)
    odds = odds[odds["price"].notna() & (odds["price"] >= 1.01) & (odds["price"] <= 1000)]
    odds = odds[ODDS_COLUMNS].reset_index(drop=True)
    return m, odds


def quality_flags(matches: pd.DataFrame, odds: pd.DataFrame) -> list[str]:
    """Contrôles de qualité du livrable 5 §5, version P0."""
    flags = []
    for (comp, season), g in matches.groupby(["competition", "season"]):
        n_teams = len(set(g["home"]) | set(g["away"]))
        expected = {18: 306, 20: 380}.get(n_teams)
        if expected is None:
            flags.append(f"{comp} {season} : {n_teams} équipes, attendu 18 ou 20")
        elif len(g) > expected:
            flags.append(f"{comp} {season} : {len(g)} matchs > {expected}")
        dup = g.duplicated(["home", "away"]).sum()
        if dup:
            flags.append(f"{comp} {season} : {dup} doublon(s) domicile/extérieur")
    inv = odds[odds["market"] == "1x2"].assign(inv=lambda d: 1 / d["price"])
    s = inv.groupby(["match_id", "bookmaker", "is_closing"])["inv"].sum()
    bad = s[(s < 1.0) | (s > 1.25)]
    if len(bad):
        flags.append(f"{len(bad)} jeu(x) de cotes 1N2 avec somme des inverses hors [1,00 ; 1,25]")
    return flags


def download(start_years: list[int], divs: list[str], raw_dir: Path, fetch=None) -> list[Path]:
    """Télécharge les CSV dans raw_dir/football-data/<date>/ et garde une empreinte. `fetch` est
    injectable pour les tests (bytes = fetch(url))."""
    import datetime as dt
    import requests

    if fetch is None:
        def fetch(url: str) -> bytes:
            r = requests.get(url, timeout=60, headers={"User-Agent": "paris-sportifs-p0 (usage personnel)"})
            r.raise_for_status()
            return r.content
    out_dir = raw_dir / "football-data" / dt.date.today().isoformat()
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for y in start_years:
        for div in divs:
            raw = fetch(url_for(y, div))
            p = out_dir / f"{season_code(y)}_{div}.csv"
            p.write_bytes(raw)
            (out_dir / f"{p.name}.sha256").write_text(hashlib.sha256(raw).hexdigest())
            paths.append(p)
    return paths


def load_raw_dir(raw_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Charge tous les CSV bruts (dernier snapshot par fichier) et les normalise."""
    files: dict[str, Path] = {}
    for p in sorted((raw_dir / "football-data").glob("*/*.csv")):
        files[p.name] = p  # le tri par date fait gagner le plus récent
    ms, os_ = [], []
    for name, p in files.items():
        mobj = re.match(r"(\d{2})(\d{2})_(\w+)\.csv", name)
        if not mobj:
            continue
        yy = int(mobj.group(1))
        start_year = 2000 + yy if yy < 90 else 1900 + yy
        div = mobj.group(3)
        m, o = normalise(read_csv_bytes(p.read_bytes()), start_year, div, snapshot=str(p.parent.name))
        ms.append(m)
        os_.append(o)
    if not ms:
        return pd.DataFrame(columns=MATCH_COLUMNS), pd.DataFrame(columns=ODDS_COLUMNS)
    return pd.concat(ms, ignore_index=True), pd.concat(os_, ignore_index=True)
