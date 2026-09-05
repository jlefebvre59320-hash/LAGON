import numpy as np
import pandas as pd

from p0.models.dixon_coles import DixonColes
from p0.models.elo import Elo
from p0.models.ensemble import MultinomialLogit, features_from_probs


def test_dixon_coles_recovers_structure(world):
    matches, odds, xg, truth = world
    hist = matches[matches["season"] <= 2020]
    dc = DixonColes(xi=0.001)
    dc.fit(hist, None, at=hist["date"].max() + pd.Timedelta(days=1))
    assert dc.params["converged"]
    # corrélation entre forces estimées et vraies (dernière saison de l'historique)
    est_att = np.array([dc.params["teams"][t][0] for t in truth["teams"]])
    assert np.corrcoef(est_att, truth["att"])[0, 1] > 0.7
    assert 0.1 < dc.params["home"] < 0.45
    p = dc.predict_1x2("Team00", "Team01")
    assert abs(sum(p.values()) - 1) < 1e-9
    ou = dc.predict_ou("Team00", "Team01")
    assert abs(ou["over"] + ou["under"] - 1) < 1e-9


def test_dixon_coles_xg_target(world):
    matches, odds, xg, truth = world
    hist = matches[matches["season"] <= 2020]
    dc = DixonColes(xi=0.001, target="xg")
    dc.fit(hist, xg, at=hist["date"].max() + pd.Timedelta(days=1))
    assert dc.params["rho"] == 0.0
    est_att = np.array([dc.params["teams"][t][0] for t in truth["teams"]])
    assert np.corrcoef(est_att, truth["att"])[0, 1] > 0.7


def test_dixon_coles_is_better_than_uniform_out_of_sample(world):
    matches, *_ = world
    hist = matches[matches["season"] <= 2020]
    test = matches[matches["season"] == 2021]
    dc = DixonColes(xi=0.002)
    dc.fit(hist, None, at=test["date"].min())
    ll = []
    for r in test.itertuples():
        p = dc.predict_1x2(r.home, r.away)
        y = "home" if r.hg > r.ag else ("draw" if r.hg == r.ag else "away")
        ll.append(-np.log(p[y]))
    assert np.mean(ll) < np.log(3) - 0.03


def test_elo_predicts_and_orders(world):
    matches, *_ = world
    elo = Elo()
    elo.fit(matches[matches["season"] <= 2020])
    p = elo.predict_1x2("Team00", "Team01")
    assert p is not None and abs(sum(p.values()) - 1) < 1e-9
    strong = max(elo.ratings, key=elo.ratings.get)
    weak = min(elo.ratings, key=elo.ratings.get)
    assert elo.predict_1x2(strong, weak)["home"] > elo.predict_1x2(weak, strong)["home"]
    assert elo.predict_ou("Team00", "Team01") is None


def test_multinomial_logit_learns_identity():
    rng = np.random.default_rng(0)
    p = rng.dirichlet([2, 2, 2], size=3000)
    y = np.array([rng.choice(3, p=pi) for pi in p])
    X = features_from_probs([p])
    clf = MultinomialLogit(3, l2=1e-4).fit(X, y)
    q = clf.predict_proba(X)
    assert np.mean(np.abs(q - p)) < 0.03
