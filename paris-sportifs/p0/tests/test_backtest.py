import numpy as np
import pandas as pd
import pytest

from p0.backtest import metrics as M
from p0.backtest.strategy import Strategy, select_bets, summarise_bets
from p0.backtest.walk_forward import WalkForwardConfig, evaluate_models, run
from p0.clock import Clock, LeakageError


def test_clock_blocks_future_rows():
    c = Clock(pd.Timestamp("2020-01-01"))
    df = pd.DataFrame({"available_at": pd.to_datetime(["2019-12-31", "2020-01-02"])})
    with pytest.raises(LeakageError):
        c.assert_clean(df, "available_at")


def test_metrics_basic():
    probs = np.array([[0.7, 0.2, 0.1], [0.2, 0.5, 0.3]])
    y = np.array([0, 1])
    assert abs(M.log_loss(probs, y) - (-(np.log(0.7) + np.log(0.5)) / 2)) < 1e-12
    assert M.brier(np.eye(3)[[0, 1]], y) == 0.0
    assert M.max_drawdown(np.array([1, -1, -1, 2])) == 2.0
    assert M.longest_losing_streak(np.array([1, -1, -1, 1, -1])) == 2
    lo, hi, pneg = M.bootstrap_ci(np.array([1.0, -1.0, 1.0, 1.0] * 50), np.ones(200))
    assert lo < hi and 0 <= pneg <= 1


@pytest.fixture(scope="module")
def wf(world):
    matches, odds, xg, _ = world
    cfg = WalkForwardConfig(test_seasons=[2020, 2021], train_seasons=4, refit_days=28, ensemble=True, ensemble_min_history=200)
    preds = run(matches, odds, xg, cfg)
    return matches, odds, preds


def test_walk_forward_produces_all_models_and_no_leak(wf):
    matches, odds, preds = wf
    assert {"elo", "dixon_coles", "dixon_coles_xg", "market_pre", "market_close", "ensemble"} <= set(preds["model"])
    dates = matches.set_index("match_id")["date"]
    late = preds[preds["predicted_at"] > preds["match_id"].map(dates)]
    assert late.empty, "prédiction postérieure au coup d'envoi"
    # l'ensemble n'existe que pour la seconde saison test (la première sert d'entraînement)
    ens_seasons = set(matches.set_index("match_id").loc[preds[preds["model"] == "ensemble"]["match_id"].unique(), "season"])
    assert ens_seasons == {2021}


def test_closing_market_is_best_on_synthetic_world(wf):
    """Dans le monde synthétique, la clôture est la vérité bruitée : aucun modèle ne doit la battre."""
    matches, odds, preds = wf
    ev = evaluate_models(preds, matches)
    tot = ev[(ev["market"] == "1x2") & (ev["season"] == 0)].set_index("model")["log_loss"]
    assert tot["market_close"] <= tot.drop("market_close").min() + 1e-9
    assert tot["dixon_coles"] < np.log(3)


def test_strategy_selection_and_clv(wf):
    matches, odds, preds = wf
    s = Strategy(id="t", model="dixon_coles", market="1x2", bookmaker="Max", ev_threshold=0.0)
    bets = select_bets(preds, odds, matches, s)
    assert not bets.empty
    assert bets["match_id"].is_unique
    assert set(bets.columns) >= {"price", "stake", "profit", "clv", "won"}
    summ = summarise_bets(bets)
    assert summ["n_bets"] == len(bets)
    # sur un monde où la clôture est (presque) vraie, une sélection par EV ne bat pas la clôture en moyenne de façon nette
    assert summ["clv_mean"] < 1.03
    frs = Strategy(id="fr", model="dixon_coles", market="1x2", bookmaker="FR_SIM", ev_threshold=0.0, fr_margin=0.12)
    fr_bets = select_bets(preds, odds, matches, frs)
    assert fr_bets["price"].mean() < bets["price"].mean()
