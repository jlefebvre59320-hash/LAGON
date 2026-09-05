import numpy as np
import pytest

from p0.models.market import implied, implied_multiplicative, implied_power, implied_shin, overround


@pytest.mark.parametrize("prices", [[2.10, 3.40, 3.60], [1.25, 6.0, 12.0], [1.90, 1.95]])
def test_all_methods_sum_to_one(prices):
    for m in ("multiplicative", "power", "shin"):
        p = implied(prices, m)
        assert abs(p.sum() - 1.0) < 1e-9
        assert (p > 0).all()


def test_no_margin_is_identity():
    p = np.array([0.5, 0.3, 0.2])
    prices = 1 / p
    for f in (implied_multiplicative, implied_power, implied_shin):
        assert np.allclose(f(prices), p, atol=1e-6)


def test_shin_and_power_favour_favourites_less_than_multiplicative():
    """Shin et power attribuent moins de marge aux favoris qu'aux outsiders : la probabilité du
    favori est plus haute qu'avec la normalisation, celle de l'outsider plus basse."""
    prices = [1.30, 5.5, 11.0]
    mult, shin, power = implied_multiplicative(prices), implied_shin(prices), implied_power(prices)
    assert shin[0] > mult[0] and shin[2] < mult[2]
    assert power[0] > mult[0] and power[2] < mult[2]


def test_overround():
    assert abs(overround([2.0, 2.0]) - 0.0) < 1e-12
    assert abs(overround([1.9, 1.9]) - (2 / 1.9 - 1)) < 1e-12
