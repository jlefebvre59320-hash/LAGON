"""Rapport Markdown d'un backtest : qualité des modèles, stratégies, verdict selon les seuils
pré-enregistrés (livrable 1 §6.2)."""
from __future__ import annotations

import pandas as pd


THRESHOLDS = {"clv_min": 1.00, "min_bets_per_season": 300, "logloss_gap_corriger": 0.01, "logloss_gap_abandon": 0.03}


def verdict(model_eval: pd.DataFrame, strat_summaries: dict[str, dict], n_seasons: int) -> tuple[str, list[str]]:
    reasons = []
    ref = model_eval[(model_eval["market"] == "1x2") & (model_eval["season"] == 0)].set_index("model")["log_loss"]
    if "market_close" not in ref.index:
        return "indéterminé", ["pas de cotes de clôture : impossible d'évaluer contre le marché"]
    close = ref["market_close"]
    best_model = ref.drop([m for m in ("market_close", "market_pre") if m in ref.index]).idxmin()
    gap = (ref[best_model] - close) / close
    reasons.append(f"meilleur modèle hors marché : {best_model}, log-loss {ref[best_model]:.4f} contre {close:.4f} pour la clôture (écart relatif {gap:+.2%})")
    good = [k for k, s in strat_summaries.items() if s.get("n_bets", 0) >= THRESHOLDS["min_bets_per_season"] * n_seasons
            and s.get("clv_ci95", (0, 0))[0] > THRESHOLDS["clv_min"] and s.get("roi_ci95", (-1, 0))[0] > -1e-9]
    if good:
        reasons.append("stratégies satisfaisant les seuils : " + ", ".join(good))
        return "poursuivre", reasons
    if gap <= THRESHOLDS["logloss_gap_corriger"]:
        reasons.append("modèle calibré au niveau du marché mais sans CLV démontrée : ajouter une famille de variables (ordre du livrable 1 §5) et réitérer une fois")
        return "corriger", reasons
    if gap > THRESHOLDS["logloss_gap_abandon"]:
        reasons.append("écart de log-loss à la clôture supérieur à 3 % : la voie « données gratuites » avec ces familles ne suffit pas")
        return "abandonner (cette voie)", reasons
    reasons.append("écart entre 1 % et 3 % : poursuivre l'ablation des familles avant de conclure")
    return "corriger", reasons


def render(model_eval: pd.DataFrame, strat_summaries: dict[str, dict], calib: dict[str, pd.DataFrame], meta: dict) -> str:
    L = []
    L.append(f"# Rapport de backtest P0\n\nGénéré le {meta.get('generated_at')}. Données : {meta.get('data')}. "
             f"Saisons test : {meta.get('test_seasons')}. Refit tous les {meta.get('refit_days')} jours. "
             f"Marge retirée par : {meta.get('margin_method')}.\n")
    L.append("Aucun chiffre de ce rapport n'est une promesse de gain. Les cotes « afternoon » sont des approximations "
             "de cotes J-1 (collecte Football-Data le vendredi ou le mardi) ; les cotes FR_SIM sont simulées.\n")
    L.append("## 1. Qualité des probabilités (matchs communs à tous les modèles)\n")
    for market in ("1x2", "ou"):
        sub = model_eval[(model_eval["market"] == market) & (model_eval["season"] == 0)].sort_values("log_loss")
        if sub.empty:
            continue
        L.append(f"### Marché {market}\n\n| Modèle | n | Log-loss | Brier | ECE (1re sélection) |\n|---|---|---|---|---|")
        for r in sub.itertuples():
            L.append(f"| {r.model} | {r.n} | {r.log_loss:.4f} | {r.brier:.4f} | {r.ece_first_sel:.4f} |")
        L.append("")
        per = model_eval[(model_eval["market"] == market) & (model_eval["season"] != 0)].pivot_table(index="season", columns="model", values="log_loss")
        if not per.empty:
            L.append("Log-loss par saison :\n")
            L.append("| Saison | " + " | ".join(per.columns) + " |\n|---|" + "---|" * len(per.columns))
            for s, row in per.iterrows():
                L.append(f"| {s} | " + " | ".join(f"{v:.4f}" for v in row.values) + " |")
            L.append("")
    L.append("## 2. Stratégies (paris simples, exposition égale)\n")
    L.append("| Stratégie | Paris | ROI | IC 95 % ROI | P(ROI<0) | CLV moy. | IC 95 % CLV | % CLV>1 | Drawdown max (unités) | Série perdante | P(perte à 500 paris) | Cote moy. | Taux de réussite |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for k, s in strat_summaries.items():
        if s.get("n_bets", 0) == 0:
            L.append(f"| {k} | 0 | | | | | | | | | | | |")
            continue
        L.append(f"| {k} | {s['n_bets']} | {s['roi']:+.2%} | [{s['roi_ci95'][0]:+.2%} ; {s['roi_ci95'][1]:+.2%}] | {s['p_roi_negative']:.2f} | "
                 f"{s['clv_mean']:.4f} | [{s['clv_ci95'][0]:.4f} ; {s['clv_ci95'][1]:.4f}] | {s['share_clv_positive']:.0%} | {s['max_drawdown_units']:.1f} | "
                 f"{s['longest_losing_streak']} | {s['p_loss_at_500']:.2f} | {s['avg_price']:.2f} | {s['hit_rate']:.1%} |")
    L.append("")
    if calib:
        L.append("## 3. Calibration (déciles de probabilité prédite, première sélection)\n")
        for name, t in calib.items():
            L.append(f"### {name}\n\n| Décile | n | p moyenne | Fréquence | Écart |\n|---|---|---|---|---|")
            for r in t.itertuples():
                L.append(f"| {r.bin} | {r.n} | {r.p_mean:.3f} | {r.freq:.3f} | {r.gap:+.3f} |")
            L.append("")
    v, reasons = verdict(model_eval, strat_summaries, len(meta.get("test_seasons", [])) or 1)
    L.append(f"## 4. Verdict selon les seuils pré-enregistrés : **{v}**\n")
    for r in reasons:
        L.append(f"- {r}")
    L.append("\nSeuils : CLV moyenne > 1,00 avec IC 95 % excluant 1 sur au moins 300 paris par saison et ROI à mise fixe "
             "non significativement négatif → poursuivre ; log-loss à moins de 1 % de la clôture sans CLV → corriger ; "
             "écart > 3 % après ablation → abandonner cette voie.")
    return "\n".join(L)
