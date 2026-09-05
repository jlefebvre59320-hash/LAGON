"""Régression logistique multinomiale sur les log-probabilités des modèles de base.

Entraînée uniquement sur des prédictions produites hors échantillon (walk-forward) des saisons
antérieures à la saison prédite : l'ensemble n'a jamais vu les résultats qu'il combine.
"""
from __future__ import annotations

import numpy as np
from scipy.optimize import minimize


class MultinomialLogit:
    def __init__(self, n_classes: int, l2: float = 1e-2):
        self.n_classes, self.l2 = n_classes, l2
        self.W: np.ndarray | None = None

    def _logits(self, X: np.ndarray, W: np.ndarray) -> np.ndarray:
        Xb = np.hstack([np.ones((X.shape[0], 1)), X])
        z = Xb @ W  # (n, K-1)
        return np.hstack([np.zeros((X.shape[0], 1)), z])

    def fit(self, X: np.ndarray, y: np.ndarray) -> "MultinomialLogit":
        n, k = X.shape
        K = self.n_classes
        shape = (k + 1, K - 1)

        def nll(w):
            W = w.reshape(shape)
            z = self._logits(X, W)
            z = z - z.max(axis=1, keepdims=True)
            logp = z - np.log(np.exp(z).sum(axis=1, keepdims=True))
            return -np.sum(logp[np.arange(n), y]) / n + self.l2 * np.sum(W[1:] ** 2)

        res = minimize(nll, np.zeros(shape).ravel(), method="L-BFGS-B")
        self.W = res.x.reshape(shape)
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        z = self._logits(X, self.W)
        z = z - z.max(axis=1, keepdims=True)
        e = np.exp(z)
        return e / e.sum(axis=1, keepdims=True)


def features_from_probs(prob_blocks: list[np.ndarray]) -> np.ndarray:
    """Concatène les log-probabilités (bornées) de plusieurs modèles, en retirant la dernière
    colonne de chaque bloc (redondante) pour éviter la colinéarité parfaite."""
    cols = []
    for p in prob_blocks:
        lp = np.log(np.clip(p, 1e-6, 1))
        cols.append(lp[:, :-1] - lp[:, -1:])
    return np.hstack(cols)
