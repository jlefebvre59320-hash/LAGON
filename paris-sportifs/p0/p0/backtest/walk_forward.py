"""Backtest walk-forward.

Pour chaque saison test S, on avance date de refit par date de refit (tous les `refit_days`
jours) ; à chaque refit, les modèles sont ajustés sur les matchs terminés avant l'horloge T
(saisons S-`train_seasons` à S incluse, jusqu'à T), puis prédisent les matchs dont le coup d'envoi
tombe dans [T, T + refit_days). Aucune donnée postérieure à T n'entre : la Clock le vérifie.

Le modèle « marché » (cotes pré-clôture, marge retirée par Shin) est produit ici aussi, comme
référence ; le modèle « clôture » sert uniquement de vérité de marché pour la CLV et la log-loss
de référence.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from p0.clock import Clock
from p0.models.dixon_coles import DixonColes
from p0.models.elo import Elo
from p0.models.ensemble import MultinomialLogit, features_from_probs
from p0.models.market import implied

SEL_1X2 = ["home", "draw", "away"]
SEL_OU = ["over", "under"]


@dataclass
class WalkForwardConfig:
    test_seasons: list[int]
    train_seasons: int = 6
    refit_days: int = 7
    margin_method: str = "shin"
    xi: float = 0.0035
    elo_k: float = 20.0
    elo_home_adv: float = 60.0
    models: tuple[str, ...] = ("elo", "dixon_coles", "dixon_coles_xg")
    ensemble: bool = True
    ensemble_min_history: int = 600
    ensemble_l2: float = 1e-2
    verbose: bool = False
    extra: dict = field(default_factory=dict)


def _market_probs(odds: pd.DataFrame, match_ids: pd.Series, market: str, closing: bool, method: str) -> pd.DataFrame:
    sub = odds[(odds["market"] == market) & (odds["is_closing"] == closing) & odds["match_id"].isin(match_ids)]
    ref = sub[sub["bookmaker"] == "PS"]
    if ref.empty:
        ref = sub[sub["bookmaker"] == "Max"]
    rows = []
    for mid, g in ref.groupby("match_id"):
        g = g.drop_duplicates("selection").set_index("selection")
        sels = SEL_1X2 if market == "1x2" else SEL_OU
        if not all(s in g.index for s in sels):
            continue
        p = implied(g.loc[sels, "price"].to_numpy(), method)
        for s, pi in zip(sels, p):
            rows.append({"match_id": mid, "selection": s, "prob": float(pi)})
    return pd.DataFrame(rows, columns=["match_id", "selection", "prob"])


def _build_models(cfg: WalkForwardConfig, has_xg: bool) -> list:
    out = []
    if "elo" in cfg.models:
        out.append(Elo(k=cfg.elo_k, home_adv=cfg.elo_home_adv))
    if "dixon_coles" in cfg.models:
        out.append(DixonColes(xi=cfg.xi, target="goals"))
    if "dixon_coles_xg" in cfg.models and has_xg:
        out.append(DixonColes(xi=cfg.xi, target="xg"))
    return out


def run(matches: pd.DataFrame, odds: pd.DataFrame, xg: pd.DataFrame | None, cfg: WalkForwardConfig) -> pd.DataFrame:
    """Retourne les prédictions au format long : match_id, model, market, selection, prob, predicted_at."""
    matches = matches.copy()
    matches["date"] = pd.to_datetime(matches["date"])
    if xg is not None and not xg.empty:
        xg = xg.copy()
        xg["observed_at"] = pd.to_datetime(xg["observed_at"])
    out = []
    for season in cfg.test_seasons:
        test = matches[(matches["season"] == season) & matches["hg"].notna()].sort_values("date")
        if test.empty:
            continue
        pool = matches[(matches["season"] >= season - cfg.train_seasons) & (matches["season"] <= season)]
        t = test["date"].min().normalize()
        end = test["date"].max()
        while t <= end:
            clock = Clock(at=t)
            batch = test[(test["date"] >= t) & (test["date"] < t + pd.Timedelta(days=cfg.refit_days))]
            if batch.empty:
                t += pd.Timedelta(days=cfg.refit_days)
                continue
            history = clock.matches_before(pool)
            clock.assert_clean(history.assign(avail=history["date"] + pd.Timedelta(hours=3)), "avail")
            hist_xg = None
            if xg is not None and not xg.empty:
                hist_xg = xg[xg["match_id"].isin(history["match_id"]) & (xg["observed_at"] <= t)]
                clock.assert_clean(hist_xg, "observed_at")
            models = _build_models(cfg, has_xg=hist_xg is not None and len(hist_xg) > 100)
            for mdl in models:
                if isinstance(mdl, DixonColes):
                    mdl.fit(history, hist_xg, at=t)
                else:
                    mdl.fit(history, hist_xg)
            for row in batch.itertuples(index=False):
                for mdl in models:
                    p = mdl.predict_1x2(row.home, row.away)
                    if p:
                        out += [{"match_id": row.match_id, "model": mdl.name, "market": "1x2", "selection": s, "prob": p[s], "predicted_at": t} for s in SEL_1X2]
                    if "ou" in mdl.markets:
                        p = mdl.predict_ou(row.home, row.away, 2.5)
                        if p:
                            out += [{"match_id": row.match_id, "model": mdl.name, "market": "ou", "selection": s, "prob": p[s], "predicted_at": t} for s in SEL_OU]
            # référence marché : cotes pré-clôture disponibles à T (observed_at <= T ou J-1 15h du match)
            for market in ("1x2", "ou"):
                pre = _market_probs(odds, batch["match_id"], market, closing=False, method=cfg.margin_method)
                pre["model"], pre["market"], pre["predicted_at"] = "market_pre", market, t
                out += pre.to_dict("records")
                clo = _market_probs(odds, batch["match_id"], market, closing=True, method=cfg.margin_method)
                clo["model"], clo["market"], clo["predicted_at"] = "market_close", market, t
                out += clo.to_dict("records")
            if cfg.verbose:
                print(f"saison {season} : refit {t.date()} sur {len(history)} matchs, {len(batch)} prédits")
            t += pd.Timedelta(days=cfg.refit_days)
    preds = pd.DataFrame(out)
    if cfg.ensemble and not preds.empty:
        preds = pd.concat([preds, _ensemble(preds, matches, cfg)], ignore_index=True)
    return preds


def _pivot(preds: pd.DataFrame, model: str, market: str) -> pd.DataFrame:
    sels = SEL_1X2 if market == "1x2" else SEL_OU
    p = preds[(preds["model"] == model) & (preds["market"] == market)].pivot_table(index="match_id", columns="selection", values="prob")
    return p.reindex(columns=sels).dropna()


def _ensemble(preds: pd.DataFrame, matches: pd.DataFrame, cfg: WalkForwardConfig) -> pd.DataFrame:
    """Ensemble entraîné saison par saison sur les prédictions hors échantillon des saisons
    antérieures (jamais sur la saison prédite)."""
    base = [m for m in ("elo", "dixon_coles", "dixon_coles_xg", "market_pre") if m in set(preds["model"])]
    season_of = matches.set_index("match_id")["season"]
    res = matches.set_index("match_id")
    out = []
    for market in ("1x2", "ou"):
        sels = SEL_1X2 if market == "1x2" else SEL_OU
        blocks = {m: _pivot(preds, m, market) for m in base}
        blocks = {m: b for m, b in blocks.items() if not b.empty}
        if not blocks:
            continue
        common = None
        for b in blocks.values():
            common = b.index if common is None else common.intersection(b.index)
        common = common.sort_values()
        X = features_from_probs([blocks[m].loc[common].to_numpy() for m in blocks])
        if market == "1x2":
            y = np.where(res.loc[common, "hg"] > res.loc[common, "ag"], 0, np.where(res.loc[common, "hg"] == res.loc[common, "ag"], 1, 2))
        else:
            y = np.where(res.loc[common, "hg"] + res.loc[common, "ag"] > 2.5, 0, 1)
        seasons = season_of.loc[common].to_numpy()
        for s in sorted(set(seasons)):
            train = seasons < s
            test = seasons == s
            if train.sum() < cfg.ensemble_min_history or test.sum() == 0:
                continue
            clf = MultinomialLogit(n_classes=len(sels), l2=cfg.ensemble_l2).fit(X[train], y[train])
            P = clf.predict_proba(X[test])
            ids = common[test]
            pa = preds[(preds["model"] == base[0]) & (preds["market"] == market)].drop_duplicates("match_id").set_index("match_id")["predicted_at"]
            for i, mid in enumerate(ids):
                for j, sel in enumerate(sels):
                    out.append({"match_id": mid, "model": "ensemble", "market": market, "selection": sel, "prob": float(P[i, j]), "predicted_at": pa.get(mid)})
    return pd.DataFrame(out, columns=["match_id", "model", "market", "selection", "prob", "predicted_at"])


def evaluate_models(preds: pd.DataFrame, matches: pd.DataFrame) -> pd.DataFrame:
    """Log-loss, Brier et calibration de chaque modèle par marché et saison, sur les matchs
    communs à tous les modèles (comparaison équitable)."""
    from p0.backtest import metrics as M

    res = matches.set_index("match_id")
    rows = []
    for market in ("1x2", "ou"):
        sels = SEL_1X2 if market == "1x2" else SEL_OU
        piv = {m: _pivot(preds, m, market) for m in preds["model"].unique()}
        piv = {m: p for m, p in piv.items() if not p.empty}
        if not piv:
            continue
        common = None
        for p in piv.values():
            common = p.index if common is None else common.intersection(p.index)
        for m, p in piv.items():
            p = p.loc[common]
            hg, ag = res.loc[common, "hg"].to_numpy(), res.loc[common, "ag"].to_numpy()
            if market == "1x2":
                y = np.where(hg > ag, 0, np.where(hg == ag, 1, 2))
            else:
                y = np.where(hg + ag > 2.5, 0, 1)
            seasons = res.loc[common, "season"].to_numpy()
            for s in sorted(set(seasons)):
                k = seasons == s
                P = p.to_numpy()[k]
                rows.append({"market": market, "model": m, "season": int(s), "n": int(k.sum()),
                             "log_loss": M.log_loss(P, y[k]), "brier": M.brier(P, y[k]),
                             "ece_first_sel": M.expected_calibration_error(P[:, 0], (y[k] == 0).astype(float))})
            P = p.to_numpy()
            rows.append({"market": market, "model": m, "season": 0, "n": len(y), "log_loss": M.log_loss(P, y),
                         "brier": M.brier(P, y), "ece_first_sel": M.expected_calibration_error(P[:, 0], (y == 0).astype(float))})
    return pd.DataFrame(rows)
