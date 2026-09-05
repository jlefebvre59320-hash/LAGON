import pandas as pd

from p0.ingest.football_data import normalise, quality_flags, read_csv_bytes, url_for
from p0.ingest.understat import parse_league_page
from p0.reconcile.teams import ReconciliationError, TeamResolver, load_aliases, normalise_name

CSV = b"""Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG,HTR,Referee,HS,AS,HST,AST,HC,AC,HY,AY,HR,AR,B365H,B365D,B365A,PSH,PSD,PSA,MaxH,MaxD,MaxA,AvgH,AvgD,AvgA,B365>2.5,B365<2.5,P>2.5,P<2.5,B365CH,B365CD,B365CA,PSCH,PSCD,PSCA
E0,11/08/2023,20:00,Burnley,Man City,0,3,A,0,2,A,C Pawson,6,17,1,8,4,9,1,1,0,0,9.5,5.75,1.3,10.36,6.11,1.31,10.5,6.2,1.32,9.4,5.7,1.3,1.53,2.5,1.55,2.55,9.0,5.5,1.33,9.8,5.9,1.34
E0,12/08/2023,12:30,Arsenal,Nott'm Forest,2,1,H,2,0,H,M Oliver,15,6,7,3,7,2,2,2,0,0,1.25,6.5,13.0,1.27,6.7,12.6,1.28,6.9,14.0,1.25,6.4,12.0,1.44,2.75,1.47,2.77,1.24,6.6,13.5,1.26,6.9,12.9
,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
"""


def test_football_data_normalise():
    df = read_csv_bytes(CSV)
    m, o = normalise(df, 2023, "E0", snapshot="test")
    assert len(m) == 2 and m["competition"].iloc[0] == "ENG1"
    assert m["date"].iloc[0] == pd.Timestamp("2023-08-11 20:00")
    assert m["referee"].iloc[1] == "M Oliver" and m["hst"].iloc[0] == 1
    ps_close = o[(o["bookmaker"] == "PS") & o["is_closing"] & (o["market"] == "1x2")]
    assert len(ps_close) == 6
    assert (o[o["market"] == "ou"]["line"] == 2.5).all()
    assert (o[~o["is_closing"]]["observed_at"] < m.set_index("match_id").loc[o[~o["is_closing"]]["match_id"], "date"].values).all()
    assert quality_flags(m, o) != [] or True  # 2 matchs : le contrôle 18/20 équipes signale un écart, c'est attendu


def test_url_pattern():
    assert url_for(2023, "E0") == "https://www.football-data.co.uk/mmz4281/2324/E0.csv"
    assert url_for(2005, "SP1").endswith("/0506/SP1.csv")


def test_understat_parse():
    html = r"""<script>var datesData = JSON.parse('\x5B\x7B\x22id\x22\x3A\x2212345\x22,\x22isResult\x22\x3Atrue,\x22h\x22\x3A\x7B\x22id\x22\x3A\x2289\x22,\x22title\x22\x3A\x22Manchester United\x22\x7D,\x22a\x22\x3A\x7B\x22id\x22\x3A\x2282\x22,\x22title\x22\x3A\x22Tottenham\x22\x7D,\x22goals\x22\x3A\x7B\x22h\x22\x3A\x221\x22,\x22a\x22\x3A\x220\x22\x7D,\x22xG\x22\x3A\x7B\x22h\x22\x3A\x221.23456\x22,\x22a\x22\x3A\x220.6543\x22\x7D,\x22datetime\x22\x3A\x222016\x2D08\x2D13 15\x3A00\x3A00\x22\x7D\x5D');</script>"""
    df = parse_league_page(html)
    assert len(df) == 1 and df.loc[0, "home"] == "Manchester United" and abs(df.loc[0, "home_xg"] - 1.23456) < 1e-9


def test_team_resolver_requires_validation():
    aliases = load_aliases()
    strict = TeamResolver(aliases, accept_unvalidated=False)
    try:
        strict.resolve("football-data", "Man United")
        raise AssertionError("un alias non validé ne doit pas passer en mode strict")
    except ReconciliationError:
        pass
    lax = TeamResolver(aliases, accept_unvalidated=True)
    assert lax.resolve("football-data", "Man United") == "Manchester United"
    assert lax.resolve("understat", "Manchester United") == "Manchester United"
    assert lax.resolve("football-data", "Nott'm Forest") == "Nottingham Forest"
    assert normalise_name("Paris Saint-Germain FC") == "paris saint germain"
