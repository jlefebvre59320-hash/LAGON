"""Probabilités implicites : retrait de la marge du bookmaker.

Trois méthodes (livrable 1 §1.3), toutes vectorisées sur un jeu de cotes d'un même marché :
  - multiplicative : p_i = r_i / Σ r_j, avec r_i = 1/cote_i ;
  - power (« logarithmique » chez Buchdahl) : p_i = r_i^k, k tel que Σ p_i = 1 ;
  - shin (Shin 1992/1993 ; Štrumbelj 2014) : part z de parieurs informés,
        p_i = ( sqrt(z² + 4(1-z) r_i²/Σr) - z ) / (2(1-z)),  z tel que Σ p_i = 1.
"""
from __future__ import annotations

import numpy as np
from scipy.optimize import brentq

METHODS = ("multiplicative", "power", "shin")


def overround(prices: np.ndarray) -> float:
    return float(np.sum(1.0 / np.asarray(prices, dtype=float)) - 1.0)


def implied_multiplicative(prices) -> np.ndarray:
    r = 1.0 / np.asarray(prices, dtype=float)
    return r / r.sum()


def implied_power(prices) -> np.ndarray:
    r = 1.0 / np.asarray(prices, dtype=float)
    if abs(r.sum() - 1.0) < 1e-12:
        return r
    f = lambda k: np.sum(r ** k) - 1.0
    k = brentq(f, 0.5, 3.0)
    return r ** k


def implied_shin(prices) -> np.ndarray:
    r = 1.0 / np.asarray(prices, dtype=float)
    s = r.sum()
    if s <= 1.0 + 1e-12:
        return r / s

    def probs(z):
        return (np.sqrt(z * z + 4.0 * (1.0 - z) * r * r / s) - z) / (2.0 * (1.0 - z))

    f = lambda z: probs(z).sum() - 1.0
    z = brentq(f, 0.0, 0.5)
    return probs(z)


def implied(prices, method: str = "shin") -> np.ndarray:
    if method == "multiplicative":
        return implied_multiplicative(prices)
    if method == "power":
        return implied_power(prices)
    if method == "shin":
        return implied_shin(prices)
    raise ValueError(f"méthode inconnue : {method}")


def fair_odds(probs) -> np.ndarray:
    return 1.0 / np.asarray(probs, dtype=float)


def expected_value(prob: float, price: float) -> float:
    """Espérance par unité misée : p × cote − 1."""
    return prob * price - 1.0
