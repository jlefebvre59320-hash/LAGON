"""Rapprochement des noms d'équipes entre sources.

Table d'alias : reconcile/aliases.csv (canonical, source, alias, method, validated).
Règle : aucun alias non validé n'est utilisé sans l'option explicite accept_unvalidated=True,
et le chargement échoue si une saison ne contient pas exactement 18 ou 20 équipes distinctes
après rapprochement (livrable 5 §4.1).
"""
from __future__ import annotations

import re
import unicodedata
from pathlib import Path

import pandas as pd

ALIASES_PATH = Path(__file__).with_name("aliases.csv")


class ReconciliationError(RuntimeError):
    pass


def normalise_name(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = s.lower()
    s = re.sub(r"\b(fc|cf|ac|sc|ssc|as|us|rc|sv|vfb|vfl|tsg|fsv|sd|cd|ud|rcd|afc|1\.|1913|2013|05|04|96)\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def load_aliases(path: Path = ALIASES_PATH) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str).fillna("")
    df["validated"] = df["validated"].str.lower().isin(("true", "1", "yes", "oui"))
    return df


class TeamResolver:
    def __init__(self, aliases: pd.DataFrame, accept_unvalidated: bool = False):
        usable = aliases if accept_unvalidated else aliases[aliases["validated"]]
        self.exact = {(r.source, r.alias): r.canonical for r in usable.itertuples()}
        self.norm = {(r.source, normalise_name(r.alias)): r.canonical for r in usable.itertuples()}
        self.canon_norm = {normalise_name(c): c for c in aliases["canonical"].unique()}
        self.log: list[dict] = []

    def resolve(self, source: str, name: str) -> str:
        if (source, name) in self.exact:
            return self.exact[(source, name)]
        n = normalise_name(name)
        if (source, n) in self.norm:
            self.log.append({"source": source, "alias": name, "method": "normalized"})
            return self.norm[(source, n)]
        if n in self.canon_norm:
            self.log.append({"source": source, "alias": name, "method": "canonical-normalized"})
            return self.canon_norm[n]
        raise ReconciliationError(f"alias inconnu pour la source {source!r} : {name!r}. "
                                  "Ajouter une ligne validée dans reconcile/aliases.csv.")

    def resolve_frame(self, df: pd.DataFrame, source: str, cols=("home", "away")) -> pd.DataFrame:
        out = df.copy()
        for c in cols:
            out[c] = out[c].map(lambda x: self.resolve(source, x))
        return out


def check_season_consistency(matches: pd.DataFrame) -> None:
    for (comp, season), g in matches.groupby(["competition", "season"]):
        teams = set(g["home"]) | set(g["away"])
        if len(teams) not in (18, 20):
            raise ReconciliationError(f"{comp} {season} : {len(teams)} équipes après rapprochement, attendu 18 ou 20 : {sorted(teams)}")
