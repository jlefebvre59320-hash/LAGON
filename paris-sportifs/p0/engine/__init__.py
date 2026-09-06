"""Prototype P0 : moteur probabiliste football et backtest walk-forward.

Règle centrale : toute fonction qui produit une probabilité reçoit un tableau
de matchs déjà filtré par l'horloge de décision (available_at <= T). Les modèles
ne lisent jamais de fichier ni de base eux-mêmes.
"""
__version__ = "0.1.0"
