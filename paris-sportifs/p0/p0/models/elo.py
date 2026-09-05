"""Elo avec avantage domicile et conversion en 1N2 par régression logistique ordonnée.

Hypothèses : force scalaire par équipe, mise à jour après chaque match avec un facteur K
(optionnellement modulé par l'écart de buts), avantage domicile constant. La probabilité de nul
est apprise par un modèle ordonné sur l'écart de classement (Hvattum & Arntzen 2010).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.special import expit


def _ordered_logit_fit(d: np.ndarray, y: np.ndarray) -> tuple[float, float, float]:
    """y ∈ {0: extérieur, 1: nul, 2: domicile}. Paramètres : pente b, seuils c1 < c2."""
    def nll(theta):
        b, c1, gap = theta
        c2 = c1 + np.exp(gap)
        p_away = expit(c1 - b * d)
        p_home = 1.0 - expit(c2 - b * d)
        p_draw = np.clip(1.0 - p_away - p_home, 1e-9, 1)
        p = np.where(y == 0, p_away, np.where(y == 1, p_draw, p_home))
        return -np.sum(np.log(np.clip(p, 1e-9, 1)))
    res = minimize(nll, x0=np.array([0.005, -0.5, np.log(1.0)]), method="L-BFGS-B")
    b, c1, gap = res.x
    return float(b), float(c1), float(c1 + np.exp(gap))


class Elo:
    name = "elo"
    markets = ("1x2",)

    def __init__(self, k: float = 20.0, home_adv: float = 60.0, mov_scale: bool = True, start: float = 1500.0):
        self.k, self.home_adv, self.mov_scale, self.start = k, home_adv, mov_scale, start
        self.ratings: dict[str, float] = {}
        self.map: tuple[float, float, float] | None = None

    def _expected(self, rh: float, ra: float) -> float:
        return 1.0 / (1.0 + 10 ** (-(rh + self.home_adv - ra) / 400.0))

    def fit(self, history: pd.DataFrame, xg: pd.DataFrame | None = None) -> None:
        self.ratings = {}
        h = history.sort_values("date")
        diffs, outcomes = [], []
        for row in h.itertuples(index=False):
            rh = self.ratings.get(row.home, self.start)
            ra = self.ratings.get(row.away, self.start)
            diffs.append(rh + self.home_adv - ra)
            outcomes.append(2 if row.hg > row.ag else (1 if row.hg == row.ag else 0))
            e = self._expected(rh, ra)
            s = 1.0 if row.hg > row.ag else (0.5 if row.hg == row.ag else 0.0)
            mult = np.log1p(abs(row.hg - row.ag)) + 1.0 if self.mov_scale else 1.0
            delta = self.k * mult * (s - e)
            self.ratings[row.home] = rh + delta
            self.ratings[row.away] = ra - delta
        if len(diffs) >= 200:
            self.map = _ordered_logit_fit(np.asarray(diffs, float), np.asarray(outcomes))
        else:
            self.map = None

    def predict_1x2(self, home: str, away: str) -> dict[str, float] | None:
        if self.map is None or home not in self.ratings or away not in self.ratings:
            return None
        b, c1, c2 = self.map
        d = self.ratings[home] + self.home_adv - self.ratings[away]
        p_away = float(expit(c1 - b * d))
        p_home = float(1.0 - expit(c2 - b * d))
        p_draw = max(1.0 - p_away - p_home, 1e-6)
        s = p_home + p_draw + p_away
        return {"home": p_home / s, "draw": p_draw / s, "away": p_away / s}

    def predict_ou(self, home: str, away: str, line: float = 2.5) -> None:
        return None
