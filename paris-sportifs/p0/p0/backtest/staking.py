"""Plans de mise. Aucune martingale : la mise ne dépend jamais des pertes passées."""
from __future__ import annotations

import numpy as np


def flat(n: int, unit: float = 1.0) -> np.ndarray:
    return np.full(n, unit)


def kelly_fraction(prob: np.ndarray, price: np.ndarray, fraction: float = 0.125, cap: float = 0.02, bankroll: float = 100.0) -> np.ndarray:
    """Kelly fractionnaire sur bankroll fixe (pas de capitalisation en backtest, pour comparer à
    exposition égale), plafonné à `cap` de la bankroll."""
    b = price - 1.0
    f = (prob * b - (1.0 - prob)) / b
    f = np.clip(f, 0, None) * fraction
    return np.minimum(f, cap) * bankroll
