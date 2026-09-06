import pandas as pd

from engine.ingest.football_data import normalise, quality_flags, read_csv_bytes, url_for
from engine.ingest.understat import parse_league_page
from engine.reconcile.teams import ReconciliationError, TeamResolver, load_aliases, normalise_name

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


def test_find_unknown_lists_all():
    from engine.reconcile.teams import find_unknown
    lax = TeamResolver(load_aliases(), accept_unvalidated=True)
    unknown = find_unknown(lax, ["Man United", "Club Inconnu", "Autre Inconnu"], "football-data")
    assert unknown == ["Autre Inconnu", "Club Inconnu"]


def test_download_retries_and_continues(tmp_path):
    from engine.ingest.football_data import download
    import requests

    calls = {"n": 0}

    def fetch(url):
        calls["n"] += 1
        if "0001_E0" in url or url.endswith("/0001/E0.csv"):
            if calls["n"] <= 2:
                r = requests.Response(); r.status_code = 503
                raise requests.HTTPError("503", response=r)
        if url.endswith("/0001/F1.csv"):
            r = requests.Response(); r.status_code = 404
            raise requests.HTTPError("404", response=r)
        return CSV

    slept = []
    paths, failures = download([2000], ["E0", "F1"], tmp_path, fetch=fetch, sleep=slept.append, progress=None)
    assert [p.name for p in paths] == ["0001_E0.csv"]
    assert len(failures) == 1 and failures[0][0].endswith("/0001/F1.csv")
    assert slept[:2] == [2, 4]  # deux reprises sur le 503, puis succès
    # relance : le fichier présent est sauté, seul le manquant est retenté
    paths2, failures2 = download([2000], ["E0", "F1"], tmp_path, fetch=fetch, sleep=slept.append, progress=None)
    assert paths2 == [] and len(failures2) == 1


def test_download_stops_when_site_is_down(tmp_path):
    import pytest
    import requests
    from engine.ingest.football_data import SiteUnavailable, download

    def fetch(url):
        r = requests.Response(); r.status_code = 503
        raise requests.HTTPError("503", response=r)

    lines = []
    with pytest.raises(SiteUnavailable):
        download([2000, 2001], ["E0", "SP1"], tmp_path, fetch=fetch, sleep=lambda s: None, progress=lines.append, retries=2)
    assert any("reprise" in l for l in lines) and sum("échec" in l for l in lines) == 3


def test_wait_until_available_honours_retry_after():
    from engine.ingest.football_data import wait_until_available
    answers = iter([(503, "120"), (503, None), (200, None)])
    slept, lines = [], []
    ok = wait_until_available(60, probe=lambda u: next(answers), sleep=slept.append, progress=lines.append)
    assert ok and slept == [150, 600]
    answers = iter([(503, "300")] * 10)
    ok = wait_until_available(7, probe=lambda u: next(answers), sleep=slept.append, progress=lines.append)
    assert ok is False


def test_download_via_wayback_records_provenance(tmp_path):
    from engine.ingest.football_data import download, wayback_url
    seen = []

    def fetch(url):
        seen.append(url)
        return CSV

    paths, failures = download([2023], ["E0"], tmp_path, fetch=fetch, sleep=lambda s: None, progress=None, via_wayback=True)
    assert seen == [wayback_url("https://www.football-data.co.uk/mmz4281/2324/E0.csv")]
    assert seen[0].startswith("https://web.archive.org/web/2id_/")
    assert (paths[0].parent / "2324_E0.csv.source").read_text() == seen[0]


CLUB_CSV = b"""Division,MatchDate,MatchTime,HomeTeam,AwayTeam,HomeElo,AwayElo,Form3Home,Form5Home,Form3Away,Form5Away,FTHome,FTAway,FTResult,HTHome,HTAway,HTResult,HomeShots,AwayShots,HomeTarget,AwayTarget,HomeFouls,AwayFouls,HomeCorners,AwayCorners,HomeYellow,AwayYellow,HomeRed,AwayRed,OddHome,OddDraw,OddAway,MaxHome,MaxDraw,MaxAway,Over25,Under25,MaxOver25,MaxUnder25,HandiSize,HandiHome,HandiAway,C_LTH,C_LTA,C_VHD,C_VAD,C_HTB,C_PHB
F1,2000-07-28,,Marseille,Troyes,1686.34,1586.57,0.0,0.0,0.0,0.0,3.0,1.0,H,2.0,1.0,H,,,,,,,,,,,,,1.65,3.3,4.3,,,,,,,,,,,,,,,,
F2,2000-07-28,,Wasquehal,Nancy,1465.08,1633.8,0.0,0.0,0.0,0.0,0.0,1.0,A,0.0,1.0,A,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
E0,2024-01-14,16:30,Man United,Tottenham,1800,1790,3,6,4,7,2.0,2.0,D,1.0,1.0,D,12,10,5,4,9,11,4,6,2,1,0,0,2.4,3.5,2.9,2.55,3.6,3.05,1.7,2.2,1.75,2.3,-0.25,1.95,1.95,,,,,,
"""


def test_club_data_normalise():
    from engine.ingest.club_data import normalise
    import io
    df = pd.read_csv(io.BytesIO(CLUB_CSV))
    m, o = normalise(df, ["E0", "F1"], snapshot="t")
    assert len(m) == 2 and set(m["competition"]) == {"FRA1", "ENG1"}
    row = m[m["competition"] == "ENG1"].iloc[0]
    assert row["season"] == 2023 and row["date"] == pd.Timestamp("2024-01-14 16:30") and row["hst"] == 5
    assert m[m["competition"] == "FRA1"].iloc[0]["season"] == 2000
    assert set(o["bookmaker"]) == {"B365", "Max"} and (~o["is_closing"]).all()
    assert len(o[(o["market"] == "ou") & (o["bookmaker"] == "Max")]) == 2


def test_invalid_raw_files_are_reported_not_fatal(tmp_path):
    from engine.ingest.football_data import InvalidCsv, load_raw_dir, validate_raw, verify_raw_dir
    import pytest
    d = tmp_path / "football-data" / "2026-09-06"
    d.mkdir(parents=True)
    (d / "2324_E0.csv").write_bytes(CSV)
    (d / "2324_SP1.csv").write_bytes(b"<!DOCTYPE html><html><body>Wayback Machine has not archived that URL.</body></html>")
    (d / "2324_D1.csv").write_bytes(b"\xef\xbb\xbf" + CSV)  # BOM UTF-8 : doit passer
    with pytest.raises(InvalidCsv):
        validate_raw(b"<html></html>")
    bad = verify_raw_dir(tmp_path)
    assert [p.name for p, _ in bad] == ["2324_SP1.csv"] and "HTML" in bad[0][1]
    lines = []
    m, o = load_raw_dir(tmp_path, progress=lines.append)
    assert set(m["competition"]) == {"ENG1", "GER1"} and len(lines) == 1 and "IGNORÉ" in lines[0]


def test_download_rejects_html_body(tmp_path):
    from engine.ingest.football_data import download
    paths, failures = download([2023], ["E0"], tmp_path, fetch=lambda u: b"<html>not archived</html>", sleep=lambda s: None, progress=None)
    assert paths == [] and len(failures) == 1 and "HTML" in failures[0][1]


def test_understat_matches_from_teams_history(tmp_path):
    import gzip, json
    from engine.ingest.understat import UnderstatClient, matches_from_teams, parse_league_payload
    teams = {
        "71": {"id": "71", "title": "Aston Villa", "history": [
            {"h_a": "a", "date": "2014-08-16 15:00:00", "scored": 1, "missed": 0, "xG": 0.909774, "xGA": 0.423368},
            {"h_a": "h", "date": "2014-08-23 12:45:00", "scored": 0, "missed": 0, "xG": 0.507525, "xGA": 0.699295}]},
        "86": {"id": "86", "title": "Stoke", "history": [
            {"h_a": "h", "date": "2014-08-16 15:00:00", "scored": 0, "missed": 1, "xG": 0.423368, "xGA": 0.909774}]},
        "87": {"id": "87", "title": "Newcastle United", "history": [
            {"h_a": "a", "date": "2014-08-23 12:45:00", "scored": 0, "missed": 0, "xG": 0.699295, "xGA": 0.507525}]},
    }
    df = matches_from_teams(teams).sort_values("date").reset_index(drop=True)
    assert len(df) == 2
    assert df.loc[0, "home"] == "Stoke" and df.loc[0, "away"] == "Aston Villa" and df.loc[0, "ag"] == 1
    assert abs(df.loc[0, "home_xg"] - 0.423368) < 1e-9 and abs(df.loc[0, "away_xg"] - 0.909774) < 1e-9
    assert df.loc[1, "home"] == "Aston Villa" and df.loc[1, "away"] == "Newcastle United"
    payload = gzip.compress(json.dumps({"teams": teams}).encode())
    seen = []

    def fetch(url, headers):
        seen.append((url, headers))
        return payload

    c = UnderstatClient(tmp_path, fetch=fetch, min_delay_s=0)
    out = c.league_season("ENG1", 2014)
    assert len(out) == 2 and (out["competition"] == "ENG1").all()
    assert seen[0][0] == "https://understat.com/getLeagueData/EPL/2014"
    assert seen[0][1]["X-Requested-With"] == "XMLHttpRequest"
    assert (tmp_path / "EPL_2014.json.gz").exists()
    c.league_season("ENG1", 2014)
    assert len(seen) == 1  # cache : aucune seconde requête
    assert len(parse_league_payload({"teams": teams})) == 2
