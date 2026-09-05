"""Interface commune des modèles P0.

Un modèle est ajusté sur l'historique visible à l'horloge T (matchs terminés avant T) puis
interrogé match par match. Il déclare les marchés qu'il sait produire.
"""
from __future__ import annotations

from typing import Protocol

import pandas as pd


class Model(Protocol):
    name: str
    markets: tuple[str, ...]

    def fit(self, history: pd.DataFrame, xg: pd.DataFrame | None) -> None: ...

    def predict_1x2(self, home: str, away: str) -> dict[str, float] | None: ...

    def predict_ou(self, home: str, away: str, line: float = 2.5) -> dict[str, float] | None: ...
