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


BROWSER_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) "
              "Version/17.4 Safari/605.1.15")
PLAIN_UA = "paris-sportifs-p0 (usage personnel)"


class SiteUnavailable(RuntimeError):
    """Plusieurs fichiers consécutifs en échec 5xx : le site ne répond pas, inutile de continuer."""


def check(url: str | None = None) -> list[dict]:
    """Diagnostic : interroge une URL avec deux User-Agent et rapporte statut, serveur, type et début du corps."""
    import requests

    url = url or url_for(2023, "E0")
    out = []
    for label, ua in (("UA simple", PLAIN_UA), ("UA navigateur", BROWSER_UA)):
        try:
            r = requests.get(url, timeout=30, headers={"User-Agent": ua})
            body = r.content[:300].decode("utf-8", "replace").replace("\n", " ")
            out.append({"ua": label, "status": r.status_code, "server": r.headers.get("Server"),
                        "content_type": r.headers.get("Content-Type"), "retry_after": r.headers.get("Retry-After"),
                        "bytes": len(r.content), "body_start": body})
        except Exception as e:
            out.append({"ua": label, "status": None, "error": f"{type(e).__name__}: {e}"})
    return out


def wait_until_available(max_minutes: float, probe=None, sleep=None, progress=print, url: str | None = None) -> bool:
    """Interroge le site jusqu'à obtenir 200 (True) ou dépasser max_minutes (False). Entre deux essais,
    attend le Retry-After annoncé (borné à 5 min) ou 3 minutes. `probe(url) -> (status, retry_after)`."""
    import time

    import requests

    sleep = sleep or time.sleep
    url = url or url_for(2023, "E0")
    if probe is None:
        def probe(u):
            r = requests.get(u, timeout=30, headers={"User-Agent": BROWSER_UA}, stream=True)
            ra = r.headers.get("Retry-After")
            r.close()
            return r.status_code, ra
    waited = 0.0
    while True:
        try:
            status, ra = probe(url)
        except Exception as e:
            status, ra = None, None
            progress(f"site injoignable ({type(e).__name__})")
        if status == 200:
            progress("site disponible")
            return True
        wait = min(int(ra), 300) if str(ra).isdigit() else 180
        if waited + wait / 60 > max_minutes:
            progress(f"toujours {status} après {waited:.0f} min d'attente : abandon")
            return False
        progress(f"réponse {status}, nouvel essai dans {wait // 60} min {wait % 60} s (attente cumulée {waited:.0f} min)")
        sleep(wait)
        waited += wait / 60


def download(start_years: list[int], divs: list[str], raw_dir: Path, fetch=None, retries: int = 5,
             delay_s: float = 1.0, sleep=None, skip_existing: bool = True, progress=print,
             max_consecutive_failures: int = 3, user_agent: str = BROWSER_UA) -> tuple[list[Path], list[tuple[str, str]]]:
    """Télécharge les CSV dans raw_dir/football-data/<date>/ et garde une empreinte.

    Tolérant : `retries` tentatives par fichier avec attente 2, 4, 8, 16 s sur erreur 5xx ou réseau ;
    `delay_s` entre deux fichiers ; un fichier déjà présent dans un snapshot antérieur est sauté
    (`skip_existing`) ; un fichier en échec n'interrompt pas les autres, sauf `max_consecutive_failures`
    échecs 5xx/réseau d'affilée (SiteUnavailable). `progress` reçoit une ligne par événement.
    Retourne (fichiers écrits, [(url, erreur)]). `fetch` et `sleep` sont injectables pour les tests.
    """
    import datetime as dt
    import time

    import requests

    sleep = sleep or time.sleep
    progress = progress or (lambda *_: None)
    if fetch is None:
        session = requests.Session()
        session.headers.update({"User-Agent": user_agent})

        def fetch(url: str) -> bytes:
            r = session.get(url, timeout=60)
            r.raise_for_status()
            return r.content
    base = raw_dir / "football-data"
    out_dir = base / dt.date.today().isoformat()
    out_dir.mkdir(parents=True, exist_ok=True)
    existing = {p.name for p in base.glob("*/*.csv")} if skip_existing else set()
    jobs = [(y, d) for y in start_years for d in divs]
    paths, failures = [], []
    consecutive = 0
    for i, (y, div) in enumerate(jobs, 1):
        name = f"{season_code(y)}_{div}.csv"
        if name in existing:
            progress(f"[{i}/{len(jobs)}] {name} déjà présent, sauté")
            continue
        url = url_for(y, div)
        raw, err, hard = None, None, False
        for attempt in range(retries):
            try:
                raw = fetch(url)
                break
            except Exception as e:  # HTTPError, ConnectionError, Timeout
                err = e
                status = getattr(getattr(e, "response", None), "status_code", None)
                if status is not None and 400 <= status < 500 and status != 429:
                    hard = True
                    break  # 404 : le fichier n'existe pas pour cette saison, inutile d'insister
                if attempt < retries - 1:
                    wait = 2 ** (attempt + 1)
                    ra = getattr(getattr(e, "response", None), "headers", {}) or {}
                    if str(ra.get("Retry-After", "")).isdigit():
                        wait = min(int(ra["Retry-After"]), 300)
                    progress(f"[{i}/{len(jobs)}] {name} : {status or type(e).__name__}, reprise {attempt + 1}/{retries - 1} dans {wait} s")
                    sleep(wait)
        if raw is None:
            failures.append((url, str(err)))
            progress(f"[{i}/{len(jobs)}] {name} : échec ({str(err).splitlines()[0][:80]})")
            if not hard:
                consecutive += 1
                if consecutive >= max_consecutive_failures:
                    raise SiteUnavailable(f"{consecutive} fichiers consécutifs en échec : le site ne répond pas. "
                                          "Lancer `p0 download --check` pour voir sa réponse, puis réessayer plus tard.")
        else:
            consecutive = 0
            p = out_dir / name
            p.write_bytes(raw)
            (out_dir / f"{p.name}.sha256").write_text(hashlib.sha256(raw).hexdigest())
            paths.append(p)
            progress(f"[{i}/{len(jobs)}] {name} ok ({len(raw) // 1024} Ko)")
        sleep(delay_s)
    return paths, failures


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
