"""Générateur de saisons synthétiques pour tester le moteur sans accès réseau.

Monde simulé : forces d'attaque et de défense par équipe (log-normales), avantage domicile,
scores Poisson indépendants (ρ = 0), xG = intensité vraie + bruit. Un bookmaker « PS » cote la
probabilité vraie avec une marge de 2,5 % et un bruit faible ; un bookmaker « B365 » avec 5 % et
un bruit plus fort ; « Max » prend le meilleur des deux ; la clôture est la vraie probabilité
avec marge 2,5 % et bruit minimal. La clôture n'est donc pas exactement la vérité : un bon modèle
peut la battre de quelques dixièmes de pour cent en log-loss ; un modèle qui la bat nettement (> 1 %)
a très probablement une fuite.
"""
from __future__ import annotations

import hashlib

import numpy as np
import pandas as pd

from p0.schema import MATCH_COLUMNS, ODDS_COLUMNS, XG_COLUMNS


def _price_from_probs(p: np.ndarray, margin: float, noise: float, rng) -> np.ndarray:
    q = p * np.exp(rng.normal(0, noise, size=p.shape))
    q = q / q.sum() * (1.0 + margin)
    return np.round(1.0 / q, 2)


def make_world(n_teams: int = 20, seasons: tuple[int, ...] = (2018, 2019, 2020, 2021, 2022), competition: str = "SYN1",
               seed: int = 0, drift: float = 0.05):
    rng = np.random.default_rng(seed)
    teams = [f"Team{i:02d}" for i in range(n_teams)]
    att = rng.normal(0, 0.25, n_teams)
    dfn = rng.normal(0, 0.2, n_teams)
    home_adv = 0.25
    m_rows, o_rows, x_rows = [], [], []
    for season in seasons:
        att = att + rng.normal(0, drift, n_teams)
        dfn = dfn + rng.normal(0, drift, n_teams)
        fixtures = [(i, j) for i in range(n_teams) for j in range(n_teams) if i != j]
        rng.shuffle(fixtures)
        start = pd.Timestamp(f"{season}-08-10 15:00")
        per_round = n_teams // 2
        for k, (i, j) in enumerate(fixtures):
            date = start + pd.Timedelta(days=7 * (k // per_round))
            lam = float(np.exp(att[i] - dfn[j] + home_adv))
            mu = float(np.exp(att[j] - dfn[i]))
            hg, ag = rng.poisson(lam), rng.poisson(mu)
            mid = hashlib.sha1(f"{competition}_{season}_{teams[i]}_{teams[j]}".encode()).hexdigest()[:12]
            m_rows.append({"match_id": mid, "competition": competition, "season": season, "date": date,
                           "kickoff_precision": "minute", "home": teams[i], "away": teams[j], "hg": hg, "ag": ag,
                           "hg_ht": np.nan, "ag_ht": np.nan, "hs": np.nan, "as_": np.nan, "hst": np.nan, "ast": np.nan,
                           "hc": np.nan, "ac": np.nan, "hy": np.nan, "ay": np.nan, "hr": np.nan, "ar": np.nan,
                           "referee": None, "snapshot": "synthetic"})
            x_rows.append({"match_id": mid, "provider": "synthetic", "home_xg": max(0.05, lam + rng.normal(0, 0.25)),
                           "away_xg": max(0.05, mu + rng.normal(0, 0.25)), "observed_at": date + pd.Timedelta(hours=4)})
            # probabilités vraies
            g = np.arange(11)
            from scipy.stats import poisson
            M = np.outer(poisson.pmf(g, lam), poisson.pmf(g, mu))
            p1x2 = np.array([np.tril(M, -1).sum(), np.trace(M), np.triu(M, 1).sum()])
            tot = g[:, None] + g[None, :]
            pou = np.array([M[tot > 2.5].sum(), M[tot <= 2.5].sum()])
            pre_at = date.normalize() - pd.Timedelta(days=1) + pd.Timedelta(hours=15)
            clo_at = date - pd.Timedelta(minutes=1)
            for market, probs, sels in (("1x2", p1x2, ("home", "draw", "away")), ("ou", pou, ("over", "under"))):
                ps = _price_from_probs(probs, 0.025, 0.03, rng)
                b365 = _price_from_probs(probs, 0.05, 0.06, rng)
                mx = np.maximum(ps, b365)
                close = _price_from_probs(probs, 0.025, 0.01, rng)
                line = 2.5 if market == "ou" else np.nan
                for bk, arr, closing, at, prec in (("PS", ps, False, pre_at, "afternoon"), ("B365", b365, False, pre_at, "afternoon"),
                                                   ("Max", mx, False, pre_at, "afternoon"), ("PS", close, True, clo_at, "closing"),
                                                   ("Max", close, True, clo_at, "closing")):
                    for sel, price in zip(sels, arr):
                        o_rows.append({"match_id": mid, "bookmaker": bk, "market": market, "line": line, "selection": sel,
                                       "price": float(price), "is_closing": closing, "observed_at": at, "observed_precision": prec})
    matches = pd.DataFrame(m_rows)[MATCH_COLUMNS]
    odds = pd.DataFrame(o_rows)[ODDS_COLUMNS]
    xg = pd.DataFrame(x_rows)[XG_COLUMNS]
    truth = {"att": att, "dfn": dfn, "home_adv": home_adv, "teams": teams}
    return matches, odds, xg, truth
