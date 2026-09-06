"""Horloge de décision : l'unique mécanisme de filtrage anti-fuite."""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


class LeakageError(RuntimeError):
    """Une ligne postérieure à l'heure de décision a atteint un modèle."""


@dataclass(frozen=True)
class Clock:
    """Heure de décision T. Tout ce qui entre dans un modèle doit être disponible avant T."""

    at: pd.Timestamp

    def matches_before(self, matches: pd.DataFrame) -> pd.DataFrame:
        """Matchs terminés dont le coup d'envoi (plus 3 h) précède T : résultats connus."""
        done = matches[(matches["date"] + pd.Timedelta(hours=3) <= self.at) & matches["hg"].notna()]
        return done

    def assert_clean(self, frame: pd.DataFrame, column: str) -> None:
        """Vérifie qu'aucune ligne n'a `column` > T. Lève LeakageError sinon."""
        if frame.empty:
            return
        late = frame[frame[column] > self.at]
        if not late.empty:
            raise LeakageError(
                f"{len(late)} ligne(s) avec {column} > {self.at.isoformat()} "
                f"(première : {late.iloc[0].to_dict()})"
            )
