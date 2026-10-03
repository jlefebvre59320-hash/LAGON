#!/usr/bin/env python3
"""Découpe une migration en morceaux courts, à coller un par un.

Certains éditeurs SQL tronquent un texte collé au-delà de quelques
kilo-octets. Ce script coupe un fichier de migration aux frontières des
instructions (jamais au milieu d'une fonction) en morceaux de 4 500
octets au plus, numérotés dans l'ordre d'exécution.

Usage : python3 supabase/tests/decouper.py supabase/migrations/0038_stats_visibles.sql
Sortie : supabase/a_coller/0038_stats_visibles/01.sql, 02.sql, …
"""
import re
import sys
from pathlib import Path

MAX = 4500

def blocs(sql: str):
    """Les instructions de premier niveau, en respectant les $$ … $$."""
    courant, dollar = [], False
    for ligne in sql.splitlines(keepends=True):
        courant.append(ligne)
        # Ouvre/ferme un bloc dollar-quoté ($$, $fn$…) : on compte les paires.
        for _ in re.findall(r"\$[A-Za-z_]*\$", ligne):
            dollar = not dollar
        if not dollar and ligne.rstrip().endswith(";"):
            yield "".join(courant)
            courant = []
    reste = "".join(courant).strip()
    if reste:
        yield reste + "\n"

def principal(chemin: str):
    src = Path(chemin)
    sql = src.read_text(encoding="utf-8")
    morceaux, en_cours = [], ""
    for b in blocs(sql):
        # Un bloc de commentaires seuls se colle au suivant.
        if len((en_cours + b).encode()) > MAX and en_cours.strip():
            morceaux.append(en_cours)
            en_cours = ""
        en_cours += b
    if en_cours.strip():
        morceaux.append(en_cours)
    dossier = Path("supabase/a_coller") / src.stem
    dossier.mkdir(parents=True, exist_ok=True)
    for ancien in dossier.glob("*.sql"):
        ancien.unlink()
    for i, m in enumerate(morceaux, 1):
        taille = len(m.encode())
        if taille > MAX:
            print(f"ATTENTION : le morceau {i} fait {taille} octets (> {MAX}) — une fonction trop longue.")
        (dossier / f"{i:02d}.sql").write_text(m, encoding="utf-8")
        print(f"{dossier / f'{i:02d}.sql'}  {taille} octets")

if __name__ == "__main__":
    for c in sys.argv[1:]:
        principal(c)
