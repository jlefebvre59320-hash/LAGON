"""Dixon-Coles (1997) avec pondération temporelle, sur buts ou sur xG.

Modèle : X ~ Poisson(λ = exp(att_h - def_a + home)), Y ~ Poisson(μ = exp(att_a - def_h)),
avec la correction τ(x, y; ρ) sur les scores 0-0, 1-0, 0-1, 1-1. Poids w = exp(-ξ · jours).
Contrainte d'identification : Σ att = 0.

Variante xG : la vraisemblance utilise les xG (réels) comme observations via la quasi-vraisemblance
de Poisson y·log(λ) − λ (le terme log y! disparaît) ; ρ est alors fixé à 0 car la correction n'a
de sens que sur des entiers. Les xG sont fournis par la table `xg` (fournisseur unique).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.stats import poisson


def tau(x: np.ndarray, y: np.ndarray, lam: np.ndarray, mu: np.ndarray, rho: float) -> np.ndarray:
    t = np.ones_like(lam, dtype=float)
    t = np.where((x == 0) & (y == 0), 1 - lam * mu * rho, t)
    t = np.where((x == 0) & (y == 1), 1 + lam * rho, t)
    t = np.where((x == 1) & (y == 0), 1 + mu * rho, t)
    t = np.where((x == 1) & (y == 1), 1 - rho, t)
    return t


class DixonColes:
    def __init__(self, xi: float = 0.0035, target: str = "goals", max_goals: int = 10, name: str | None = None):
        """xi en jours^-1 ; 0,0035 ≈ demi-vie de 200 jours."""
        self.xi, self.target, self.max_goals = xi, target, max_goals
        self.name = name or ("dixon_coles" if target == "goals" else "dixon_coles_xg")
        self.markets = ("1x2", "ou")
        self.params: dict | None = None

    def _design(self, history: pd.DataFrame, xg: pd.DataFrame | None, at: pd.Timestamp):
        h = history.copy()
        if self.target == "xg":
            if xg is None:
                raise ValueError("cible xg sans table xg")
            last = xg.sort_values("observed_at").groupby("match_id").tail(1)
            h = h.merge(last[["match_id", "home_xg", "away_xg"]], on="match_id", how="inner")
            x, y = h["home_xg"].to_numpy(float), h["away_xg"].to_numpy(float)
        else:
            x, y = h["hg"].to_numpy(float), h["ag"].to_numpy(float)
        teams = sorted(set(h["home"]) | set(h["away"]))
        idx = {t: i for i, t in enumerate(teams)}
        hi = h["home"].map(idx).to_numpy()
        ai = h["away"].map(idx).to_numpy()
        days = (at - h["date"]).dt.total_seconds().to_numpy() / 86400.0
        w = np.exp(-self.xi * np.clip(days, 0, None))
        return teams, hi, ai, x, y, w

    def fit(self, history: pd.DataFrame, xg: pd.DataFrame | None = None, at: pd.Timestamp | None = None) -> None:
        at = at or (history["date"].max() + pd.Timedelta(hours=3))
        teams, hi, ai, x, y, w = self._design(history, xg, at)
        n = len(teams)
        use_rho = self.target == "goals"

        def unpack(theta):
            att = theta[:n]
            dfn = theta[n:2 * n]
            home = theta[2 * n]
            rho = theta[2 * n + 1] if use_rho else 0.0
            return att, dfn, home, rho

        def nll(theta):
            att, dfn, home, rho = unpack(theta)
            lam = np.exp(att[hi] - dfn[ai] + home)
            mu = np.exp(att[ai] - dfn[hi])
            ll = x * np.log(lam) - lam + y * np.log(mu) - mu
            if use_rho:
                ll = ll + np.log(np.clip(tau(x, y, lam, mu, rho), 1e-9, None))
            pen = 1e-3 * (np.sum(att) ** 2)  # identification douce Σatt = 0
            return -np.sum(w * ll) + pen

        x0 = np.concatenate([np.zeros(n), np.zeros(n), [0.25], [-0.05] if use_rho else []])
        bounds = [(-3, 3)] * (2 * n) + [(-1, 1)] + ([(-0.5, 0.5)] if use_rho else [])
        res = minimize(nll, x0, method="L-BFGS-B", bounds=bounds)
        att, dfn, home, rho = unpack(res.x)
        att = att - att.mean()
        self.params = {"teams": {t: (float(att[i]), float(dfn[i])) for i, t in enumerate(teams)},
                       "home": float(home), "rho": float(rho), "converged": bool(res.success)}

    def intensities(self, home: str, away: str) -> tuple[float, float] | None:
        if self.params is None or home not in self.params["teams"] or away not in self.params["teams"]:
            return None
        ah, dh = self.params["teams"][home]
        aa, da = self.params["teams"][away]
        return float(np.exp(ah - da + self.params["home"])), float(np.exp(aa - dh))

    def score_matrix(self, home: str, away: str) -> np.ndarray | None:
        it = self.intensities(home, away)
        if it is None:
            return None
        lam, mu = it
        g = np.arange(self.max_goals + 1)
        px = poisson.pmf(g, lam)
        py = poisson.pmf(g, mu)
        m = np.outer(px, py)
        rho = self.params["rho"]
        if rho != 0.0:
            for x in (0, 1):
                for y in (0, 1):
                    m[x, y] *= tau(np.array([x]), np.array([y]), np.array([lam]), np.array([mu]), rho)[0]
        return m / m.sum()

    def predict_1x2(self, home: str, away: str) -> dict[str, float] | None:
        m = self.score_matrix(home, away)
        if m is None:
            return None
        return {"home": float(np.tril(m, -1).sum()), "draw": float(np.trace(m)), "away": float(np.triu(m, 1).sum())}

    def predict_ou(self, home: str, away: str, line: float = 2.5) -> dict[str, float] | None:
        m = self.score_matrix(home, away)
        if m is None:
            return None
        g = np.arange(self.max_goals + 1)
        total = g[:, None] + g[None, :]
        over = float(m[total > line].sum())
        return {"over": over, "under": 1.0 - over}
