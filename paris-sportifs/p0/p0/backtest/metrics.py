"""Métriques de qualité de prédiction et de rendement (livrable 7)."""
from __future__ import annotations

import numpy as np
import pandas as pd


def log_loss(probs: np.ndarray, outcome_idx: np.ndarray) -> float:
    p = np.clip(probs[np.arange(len(outcome_idx)), outcome_idx], 1e-12, 1)
    return float(-np.mean(np.log(p)))


def brier(probs: np.ndarray, outcome_idx: np.ndarray) -> float:
    onehot = np.zeros_like(probs)
    onehot[np.arange(len(outcome_idx)), outcome_idx] = 1.0
    return float(np.mean(np.sum((probs - onehot) ** 2, axis=1)))


def calibration_table(prob: np.ndarray, hit: np.ndarray, bins: int = 10) -> pd.DataFrame:
    """Par décile de probabilité prédite : probabilité moyenne, fréquence observée, effectif."""
    q = np.clip((prob * bins).astype(int), 0, bins - 1)
    df = pd.DataFrame({"bin": q, "p": prob, "hit": hit})
    out = df.groupby("bin").agg(n=("hit", "size"), p_mean=("p", "mean"), freq=("hit", "mean")).reset_index()
    out["gap"] = out["freq"] - out["p_mean"]
    return out


def expected_calibration_error(prob: np.ndarray, hit: np.ndarray, bins: int = 10) -> float:
    t = calibration_table(prob, hit, bins)
    return float(np.sum(t["n"] / t["n"].sum() * np.abs(t["gap"])))


def roi(profit: np.ndarray, stake: np.ndarray) -> float:
    s = float(np.sum(stake))
    return float(np.sum(profit) / s) if s > 0 else float("nan")


def max_drawdown(profit: np.ndarray) -> float:
    """Perte maximale depuis un sommet du capital cumulé (en unités de mise)."""
    if len(profit) == 0:
        return 0.0
    c = np.cumsum(profit)
    peak = np.maximum.accumulate(np.concatenate([[0.0], c]))[1:]
    return float(np.max(peak - c))


def longest_losing_streak(profit: np.ndarray) -> int:
    best = cur = 0
    for p in profit:
        cur = cur + 1 if p < 0 else 0
        best = max(best, cur)
    return int(best)


def bootstrap_ci(profit: np.ndarray, stake: np.ndarray, n_boot: int = 2000, alpha: float = 0.05, seed: int = 0) -> tuple[float, float, float]:
    """IC bootstrap du ROI et probabilité que le ROI réel soit négatif."""
    if len(profit) == 0:
        return float("nan"), float("nan"), float("nan")
    rng = np.random.default_rng(seed)
    n = len(profit)
    rois = np.empty(n_boot)
    for b in range(n_boot):
        i = rng.integers(0, n, n)
        rois[b] = profit[i].sum() / stake[i].sum()
    return float(np.quantile(rois, alpha / 2)), float(np.quantile(rois, 1 - alpha / 2)), float(np.mean(rois < 0))


def prob_loss_at_horizon(profit: np.ndarray, horizon: int = 500, n_sim: int = 5000, seed: int = 0) -> float:
    """Probabilité d'être en perte après `horizon` paris tirés avec remise dans l'historique."""
    if len(profit) == 0:
        return float("nan")
    rng = np.random.default_rng(seed)
    sims = rng.choice(profit, size=(n_sim, horizon), replace=True).sum(axis=1)
    return float(np.mean(sims < 0))


def clv(price_taken: np.ndarray, fair_closing_prob: np.ndarray) -> np.ndarray:
    """Closing line value : cote obtenue × probabilité équitable de clôture. > 1 : on a battu la clôture."""
    return price_taken * fair_closing_prob
