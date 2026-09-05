"""Sélection des paris à partir des prédictions et des cotes disponibles à l'heure de décision."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from p0.backtest import metrics as M
from p0.backtest.staking import flat, kelly_fraction
from p0.models.market import implied


@dataclass
class Strategy:
    id: str
    model: str
    market: str                 # '1x2' | 'ou'
    bookmaker: str              # cote jouée : 'B365', 'Max', 'PS', 'Avg', 'FR_SIM'
    ev_threshold: float = 0.02  # espérance minimale par unité
    staking: str = "flat"       # 'flat' | 'kelly'
    kelly_fraction: float = 0.125
    max_price: float = 10.0     # au-delà, on ne joue pas (queues mal calibrées)
    min_price: float = 1.2
    fr_margin: float = 0.12     # marge simulée « opérateur français » si bookmaker == 'FR_SIM'


def _closing_fair(odds: pd.DataFrame, market: str, method: str = "shin") -> pd.DataFrame:
    """Probabilités équitables de clôture Pinnacle (PS), sinon Max, par match et sélection."""
    close = odds[(odds["market"] == market) & odds["is_closing"]]
    ref = close[close["bookmaker"] == "PS"]
    if ref.empty:
        ref = close[close["bookmaker"] == "Max"]
    rows = []
    for mid, g in ref.groupby("match_id"):
        g = g.drop_duplicates("selection")
        p = implied(g["price"].to_numpy(), method)
        for sel, pi in zip(g["selection"], p):
            rows.append({"match_id": mid, "selection": sel, "fair_close_prob": pi})
    return pd.DataFrame(rows, columns=["match_id", "selection", "fair_close_prob"])


def _played_prices(odds: pd.DataFrame, strategy: Strategy, closing_fair: pd.DataFrame) -> pd.DataFrame:
    if strategy.bookmaker == "FR_SIM":
        # cote simulée d'un opérateur à marge fr_margin appliquée multiplicativement sur la clôture équitable
        df = closing_fair.copy()
        df["price"] = 1.0 / (df["fair_close_prob"] * (1.0 + strategy.fr_margin))
        return df[["match_id", "selection", "price"]]
    pre = odds[(odds["market"] == strategy.market) & (~odds["is_closing"]) & (odds["bookmaker"] == strategy.bookmaker)]
    return pre.drop_duplicates(["match_id", "selection"])[["match_id", "selection", "price"]]


def select_bets(predictions: pd.DataFrame, odds: pd.DataFrame, matches: pd.DataFrame, strategy: Strategy) -> pd.DataFrame:
    """predictions : match_id, model, market, selection, prob (format long). Retourne un pari par
    ligne avec cote jouée, mise, profit, CLV."""
    pred = predictions[(predictions["model"] == strategy.model) & (predictions["market"] == strategy.market)]
    fair = _closing_fair(odds, strategy.market)
    prices = _played_prices(odds, strategy, fair)
    df = pred.merge(prices, on=["match_id", "selection"], how="inner").merge(fair, on=["match_id", "selection"], how="left")
    df["ev"] = df["prob"] * df["price"] - 1.0
    df = df[(df["ev"] >= strategy.ev_threshold) & (df["price"] <= strategy.max_price) & (df["price"] >= strategy.min_price)]
    # un seul pari par match et marché : la meilleure espérance
    df = df.sort_values("ev", ascending=False).drop_duplicates(["match_id"]).copy()
    res = matches.set_index("match_id")[["hg", "ag", "date", "season", "competition"]]
    df = df.join(res, on="match_id")
    df = df[df["hg"].notna()]
    if strategy.market == "1x2":
        outcome = np.where(df["hg"] > df["ag"], "home", np.where(df["hg"] == df["ag"], "draw", "away"))
    else:
        outcome = np.where(df["hg"] + df["ag"] > 2.5, "over", "under")
    df["won"] = df["selection"].to_numpy() == outcome
    if strategy.staking == "kelly":
        df["stake"] = kelly_fraction(df["prob"].to_numpy(), df["price"].to_numpy(), strategy.kelly_fraction)
    else:
        df["stake"] = flat(len(df))
    df["profit"] = np.where(df["won"], df["stake"] * (df["price"] - 1.0), -df["stake"])
    df["clv"] = M.clv(df["price"].to_numpy(), df["fair_close_prob"].to_numpy())
    return df.reset_index(drop=True)


def summarise_bets(bets: pd.DataFrame) -> dict:
    if bets.empty:
        return {"n_bets": 0}
    profit, stake = bets["profit"].to_numpy(), bets["stake"].to_numpy()
    lo, hi, p_neg = M.bootstrap_ci(profit, stake)
    clv = bets["clv"].dropna()
    return {
        "n_bets": int(len(bets)),
        "roi": M.roi(profit, stake),
        "roi_ci95": (lo, hi),
        "p_roi_negative": p_neg,
        "clv_mean": float(clv.mean()) if len(clv) else float("nan"),
        "clv_ci95": tuple(np.quantile(np.random.default_rng(1).choice(clv, (2000, len(clv))).mean(axis=1), [0.025, 0.975])) if len(clv) > 1 else (float("nan"),) * 2,
        "share_clv_positive": float((clv > 1.0).mean()) if len(clv) else float("nan"),
        "max_drawdown_units": M.max_drawdown(profit),
        "longest_losing_streak": M.longest_losing_streak(profit),
        "p_loss_at_500": M.prob_loss_at_horizon(profit, 500),
        "avg_price": float(bets["price"].mean()),
        "hit_rate": float(bets["won"].mean()),
    }
