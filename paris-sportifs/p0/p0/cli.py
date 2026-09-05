"""Ligne de commande P0.

  p0 download --seasons 2014 2025 --divs E0 SP1 D1 I1 F1      télécharge les CSV Football-Data
  p0 build [--accept-unvalidated]                              normalise, rapproche, contrôle, écrit data/processed/*.parquet
  p0 xg --seasons 2014 2025                                    récupère les xG Understat (cache, délai 6 s)
  p0 backtest --test-seasons 2019 2024 [--refit-days 7]        walk-forward + stratégies + rapport
  p0 synthetic --out data/synthetic                            génère un monde synthétique pour tester la chaîne
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def cmd_download(a):
    from p0.ingest.football_data import download
    years = list(range(a.seasons[0], a.seasons[1] + 1))
    paths = download(years, a.divs, DATA / "raw")
    print(f"{len(paths)} fichiers téléchargés dans {DATA / 'raw' / 'football-data'}")


def cmd_build(a):
    from p0.ingest.football_data import load_raw_dir, quality_flags
    from p0.reconcile.teams import TeamResolver, check_season_consistency, load_aliases
    matches, odds = load_raw_dir(DATA / "raw")
    resolver = TeamResolver(load_aliases(), accept_unvalidated=a.accept_unvalidated)
    matches = resolver.resolve_frame(matches, "football-data")
    check_season_consistency(matches)
    flags = quality_flags(matches, odds)
    for f in flags:
        print("QUALITÉ :", f)
    out = DATA / "processed"
    out.mkdir(parents=True, exist_ok=True)
    matches.to_parquet(out / "matches.parquet", index=False)
    odds.to_parquet(out / "odds.parquet", index=False)
    (out / "reconcile_log.json").write_text(json.dumps(resolver.log, ensure_ascii=False, indent=1))
    print(f"{len(matches)} matchs, {len(odds)} relevés de cotes écrits dans {out}")


def cmd_xg(a):
    from p0.ingest.understat import LEAGUES, UnderstatClient, to_xg_table
    from p0.reconcile.teams import TeamResolver, load_aliases
    matches = pd.read_parquet(DATA / "processed" / "matches.parquet")
    client = UnderstatClient(DATA / "raw" / "understat")
    resolver = TeamResolver(load_aliases(), accept_unvalidated=a.accept_unvalidated)
    frames = []
    for comp in LEAGUES:
        for season in range(a.seasons[0], a.seasons[1] + 1):
            try:
                u = client.league_season(comp, season)
            except PermissionError as e:
                print(e)
                return
            u = resolver.resolve_frame(u, "understat")
            key = matches[(matches["competition"] == comp) & (matches["season"] == season)][["match_id", "home", "away"]]
            merged = u.merge(key, on=["home", "away"], how="left")
            missing = merged["match_id"].isna().sum()
            if missing:
                print(f"{comp} {season} : {missing} matchs Understat non rapprochés")
            merged = merged[merged["match_id"].notna()]
            frames.append(to_xg_table(merged, merged["match_id"], pd.Timestamp.now()))
            print(f"{comp} {season} : {len(merged)} xG")
    xg = pd.concat(frames, ignore_index=True)
    xg.to_parquet(DATA / "processed" / "xg.parquet", index=False)


def _load(data_dir: Path):
    matches = pd.read_parquet(data_dir / "matches.parquet")
    odds = pd.read_parquet(data_dir / "odds.parquet")
    xgp = data_dir / "xg.parquet"
    xg = pd.read_parquet(xgp) if xgp.exists() else None
    return matches, odds, xg


def cmd_backtest(a):
    from p0.backtest import metrics as M
    from p0.backtest.strategy import Strategy, select_bets, summarise_bets
    from p0.backtest.walk_forward import WalkForwardConfig, evaluate_models, run
    from p0.report import render
    data_dir = Path(a.data) if a.data else DATA / "processed"
    matches, odds, xg = _load(data_dir)
    seasons = list(range(a.test_seasons[0], a.test_seasons[1] + 1))
    cfg = WalkForwardConfig(test_seasons=seasons, refit_days=a.refit_days, verbose=a.verbose,
                            models=tuple(a.models) if a.models else ("elo", "dixon_coles", "dixon_coles_xg"))
    preds = run(matches, odds, xg, cfg)
    ev = evaluate_models(preds, matches)
    strategies = [Strategy(**{k: v for k, v in s.items()}) for s in yaml.safe_load((ROOT / "p0" / "registry" / "strategies.yaml").read_text())]
    summaries, calib = {}, {}
    for s in strategies:
        bets = select_bets(preds, odds, matches, s)
        summaries[s.id] = summarise_bets(bets)
        if not bets.empty:
            calib[s.id] = M.calibration_table(bets["prob"].to_numpy(), bets["won"].to_numpy().astype(float))
    meta = {"generated_at": dt.datetime.now().isoformat(timespec="minutes"), "data": str(data_dir), "test_seasons": seasons,
            "refit_days": a.refit_days, "margin_method": cfg.margin_method}
    report = render(ev, summaries, calib, meta)
    out = ROOT / "reports"
    out.mkdir(exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M")
    (out / f"backtest_{stamp}.md").write_text(report, encoding="utf-8")
    preds.to_parquet(out / f"predictions_{stamp}.parquet", index=False)
    ev.to_csv(out / f"model_eval_{stamp}.csv", index=False)
    print(report)


def cmd_synthetic(a):
    from p0.synthetic import make_world
    matches, odds, xg, _ = make_world(seasons=tuple(range(a.seasons[0], a.seasons[1] + 1)), seed=a.seed)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    matches.to_parquet(out / "matches.parquet", index=False)
    odds.to_parquet(out / "odds.parquet", index=False)
    xg.to_parquet(out / "xg.parquet", index=False)
    print(f"monde synthétique : {len(matches)} matchs écrits dans {out}")


def main(argv=None):
    p = argparse.ArgumentParser(prog="p0", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("download"); d.add_argument("--seasons", nargs=2, type=int, default=[2014, 2025]); d.add_argument("--divs", nargs="+", default=["E0", "SP1", "D1", "I1", "F1"]); d.set_defaults(fn=cmd_download)
    b = sub.add_parser("build"); b.add_argument("--accept-unvalidated", action="store_true"); b.set_defaults(fn=cmd_build)
    x = sub.add_parser("xg"); x.add_argument("--seasons", nargs=2, type=int, default=[2014, 2025]); x.add_argument("--accept-unvalidated", action="store_true"); x.set_defaults(fn=cmd_xg)
    t = sub.add_parser("backtest"); t.add_argument("--test-seasons", nargs=2, type=int, required=True); t.add_argument("--refit-days", type=int, default=7)
    t.add_argument("--data", default=None); t.add_argument("--models", nargs="*", default=None); t.add_argument("--verbose", action="store_true"); t.set_defaults(fn=cmd_backtest)
    s = sub.add_parser("synthetic"); s.add_argument("--out", default=str(DATA / "synthetic")); s.add_argument("--seasons", nargs=2, type=int, default=[2016, 2022]); s.add_argument("--seed", type=int, default=0); s.set_defaults(fn=cmd_synthetic)
    a = p.parse_args(argv)
    a.fn(a)


if __name__ == "__main__":
    main()
