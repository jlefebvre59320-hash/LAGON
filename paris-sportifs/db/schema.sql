-- ============================================================
-- Paris sportifs : analyse et simulation
-- Schéma PostgreSQL (Supabase, projet distinct de Ti Kanal)
-- Livrable 4. Version 0.1, 2026-09-05.
--
-- Conventions :
--   * identifiants et noms de colonnes en anglais, commentaires en français ;
--   * deux horloges partout où une information peut arriver après le fait :
--       published_at = quand l'information a existé dans le monde,
--       available_at = quand le moteur l'a eue ;
--   * les tables predictions et paper_bets sont immuables (append only) ;
--   * toute ligne de fait référence un snapshot de source (provenance).
-- ============================================================

create schema if not exists bet;
set search_path = bet, public;

-- ---------- Types ----------
create type source_kind as enum ('file', 'api', 'scrape', 'manual', 'llm');
create type pipeline_kind as enum ('historical', 'prospective');
create type market_kind as enum ('1x2', 'ou', 'ah');            -- 1N2, plus/moins, handicap asiatique
create type selection_kind as enum ('home', 'draw', 'away', 'over', 'under', 'home_ah', 'away_ah');
create type info_status as enum ('official', 'press', 'rumour');
create type verdict_kind as enum ('interesting', 'nothing', 'insufficient_data');
create type bet_status as enum ('open', 'won', 'lost', 'void', 'half_won', 'half_lost');

-- ---------- Provenance ----------
create table sources (
  id            text primary key,                 -- ex. 'football-data', 'understat', 'odds-api'
  name          text not null,
  operator      text,
  url           text,
  kind          source_kind not null,
  licence       text,                             -- texte ou référence de la licence
  terms_note    text,                             -- conditions relevées, date de lecture
  min_delay_s   numeric,                          -- délai minimal entre requêtes
  expected_lag  interval,                         -- délai de publication attendu
  active        boolean not null default true
);

create table source_snapshots (
  id            bigserial primary key,
  source_id     text not null references sources(id),
  pipeline      pipeline_kind not null,
  url           text,
  fetched_at    timestamptz not null default now(),
  sha256        text not null,
  byte_size     bigint,
  storage_path  text not null,                    -- chemin du brut conservé
  extractor_ver text not null,                    -- version du code d'extraction
  load_status   text not null default 'pending',  -- pending | loaded | rejected
  load_log      text
);
create index on source_snapshots (source_id, fetched_at desc);

-- ---------- Référentiels ----------
create table competitions (
  id            text primary key,                 -- 'ENG1', 'ESP1', 'GER1', 'ITA1', 'FRA1'
  name          text not null,
  country       text not null,
  tier          smallint not null default 1
);

create table competition_aliases (
  competition_id text not null references competitions(id),
  source_id      text not null references sources(id),
  alias          text not null,                   -- 'E0', 'EPL', 'PL'...
  primary key (source_id, alias)
);

create table seasons (
  id            text primary key,                 -- '2024-25'
  start_year    smallint not null,
  starts_on     date,
  ends_on       date
);

create table teams (
  id            bigserial primary key,
  canonical     text not null unique,
  country       text not null
);

create table team_aliases (
  id            bigserial primary key,
  team_id       bigint not null references teams(id),
  source_id     text not null references sources(id),
  alias         text not null,
  valid_from    text references seasons(id),
  valid_to      text references seasons(id),
  method        text not null,                    -- manual | exact | normalized | assisted
  confidence    numeric not null default 1.0,
  validated_by  text,                             -- obligatoire avant usage
  validated_at  timestamptz,
  unique (source_id, alias, valid_from)
);

create table venues (
  id            bigserial primary key,
  name          text not null,
  city          text,
  country       text,
  lat           double precision,
  lon           double precision,
  capacity      integer,
  osm_id        text,
  wikidata_id   text,
  attribution   text                              -- '© OpenStreetMap contributors' etc.
);

create table team_venues (
  team_id       bigint not null references teams(id),
  venue_id      bigint not null references venues(id),
  season_id     text not null references seasons(id),
  primary key (team_id, season_id)
);

create table referees (
  id            bigserial primary key,
  name          text not null unique
);

-- ---------- Matchs et faits ----------
create table matches (
  id              bigserial primary key,
  competition_id  text not null references competitions(id),
  season_id       text not null references seasons(id),
  matchday        smallint,
  kickoff_at      timestamptz not null,
  kickoff_precision text not null default 'minute', -- minute | day
  home_team_id    bigint not null references teams(id),
  away_team_id    bigint not null references teams(id),
  venue_id        bigint references venues(id),
  neutral_venue   boolean not null default false,
  referee_id      bigint references referees(id),
  status          text not null default 'scheduled', -- scheduled | played | postponed | cancelled
  home_goals      smallint,
  away_goals      smallint,
  home_goals_ht   smallint,
  away_goals_ht   smallint,
  snapshot_id     bigint references source_snapshots(id),
  unique (season_id, home_team_id, away_team_id),
  check (home_team_id <> away_team_id)
);
create index on matches (competition_id, season_id, kickoff_at);
create index on matches (kickoff_at) where status = 'scheduled';

create table match_stats (
  match_id      bigint primary key references matches(id),
  home_shots    smallint, away_shots smallint,
  home_sot      smallint, away_sot smallint,        -- tirs cadrés
  home_corners  smallint, away_corners smallint,
  home_fouls    smallint, away_fouls smallint,
  home_yellow   smallint, away_yellow smallint,
  home_red      smallint, away_red smallint,
  attendance    integer,
  snapshot_id   bigint references source_snapshots(id)
);

create table match_xg (
  match_id      bigint not null references matches(id),
  provider      text not null,                    -- 'understat' | 'statsbomb' | 'own_v1'
  home_xg       numeric(6,3) not null,
  away_xg       numeric(6,3) not null,
  home_npxg     numeric(6,3),
  away_npxg     numeric(6,3),
  home_xpts     numeric(6,3),
  away_xpts     numeric(6,3),
  observed_at   timestamptz not null default now(),   -- Understat corrige a posteriori : on garde chaque valeur
  snapshot_id   bigint references source_snapshots(id),
  primary key (match_id, provider, observed_at)
);

create table shots (
  id            bigserial primary key,
  match_id      bigint not null references matches(id),
  provider      text not null,
  team_id       bigint not null references teams(id),
  player_name   text,
  minute        smallint,
  x             numeric(6,4), y numeric(6,4),
  xg            numeric(6,4),
  result        text,                             -- Goal | SavedShot | MissedShots | BlockedShot | ...
  situation     text,                             -- OpenPlay | SetPiece | Penalty | ...
  shot_type     text,
  snapshot_id   bigint references source_snapshots(id)
);
create index on shots (match_id);

create table weather (
  match_id      bigint not null references matches(id),
  kind          text not null,                    -- 'forecast' | 'reanalysis'
  observed_at   timestamptz not null,             -- heure de la requête (available_at)
  temp_c        numeric(5,2),
  precip_mm_3h  numeric(6,2),
  wind_ms       numeric(5,2),
  gust_ms       numeric(5,2),
  humidity_pct  numeric(5,2),
  attribution   text not null default 'Weather data by Open-Meteo.com',
  snapshot_id   bigint references source_snapshots(id),
  primary key (match_id, kind, observed_at)
);

-- ---------- Cotes ----------
create table bookmakers (
  id            text primary key,                 -- 'pinnacle', 'bet365', 'winamax', 'market_max', 'market_avg'
  name          text not null,
  country_licence text,                           -- 'ANJ' si agréé en France
  is_reference  boolean not null default false,   -- Pinnacle : référence de marché
  is_aggregate  boolean not null default false    -- Max / Avg
);

create table odds_quotes (
  id            bigserial primary key,
  match_id      bigint not null references matches(id),
  bookmaker_id  text not null references bookmakers(id),
  market        market_kind not null,
  line          numeric(4,2),                     -- 2.5 pour O/U ; handicap pour AH ; null pour 1N2
  selection     selection_kind not null,
  price         numeric(8,3) not null check (price >= 1.01 and price <= 1000),
  observed_at   timestamptz not null,             -- heure de collecte ; pour Football-Data : approximation documentée
  observed_precision text not null default 'minute', -- minute | afternoon | closing
  is_closing    boolean not null default false,
  pipeline      pipeline_kind not null,
  snapshot_id   bigint references source_snapshots(id)
);
create index on odds_quotes (match_id, market, bookmaker_id, observed_at);

-- ---------- Effectif et informations textuelles ----------
create table players (
  id            bigserial primary key,
  canonical     text not null,
  birth_date    date,
  api_football_id integer unique
);

create table lineups (
  id            bigserial primary key,
  match_id      bigint not null references matches(id),
  team_id       bigint not null references teams(id),
  status        info_status not null,             -- official | press
  formation     text,
  players       jsonb not null,                   -- [{player_id, name, position, starter}]
  published_at  timestamptz,
  available_at  timestamptz not null,
  source_id     text not null references sources(id),
  snapshot_id   bigint references source_snapshots(id)
);
create index on lineups (match_id, team_id, available_at);

create table absences (
  id            bigserial primary key,
  team_id       bigint not null references teams(id),
  player_id     bigint references players(id),
  player_name   text not null,
  kind          text not null,                    -- injury | suspension | doubt | international
  status        info_status not null,
  published_at  timestamptz,
  available_at  timestamptz not null,
  expected_return date,
  source_id     text not null references sources(id),
  source_url    text,
  snapshot_id   bigint references source_snapshots(id)
);
create index on absences (team_id, available_at);

create table information_items (
  id            bigserial primary key,
  match_id      bigint references matches(id),
  team_id       bigint references teams(id),
  status        info_status not null,
  category      text not null,                    -- lineup | injury | suspension | coach | context | other
  summary       text not null,                    -- extrait structuré, jamais un chiffre de probabilité
  payload       jsonb,
  source_id     text not null references sources(id),
  source_url    text,
  author        text,
  published_at  timestamptz,
  available_at  timestamptz not null default now(),
  extracted_by  text,                             -- 'human' | 'claude:<model>:<prompt_version>'
  verified_by   text,                             -- seconde lecture éventuelle
  contradicts   bigint references information_items(id),
  superseded_by bigint references information_items(id)
);
create index on information_items (match_id, available_at);

-- ---------- Modèles et prédictions (immuables) ----------
create table model_versions (
  id            text primary key,                 -- 'dc_xg_v0.3'
  family        text not null,                    -- market_only | elo | dixon_coles | dixon_coles_xg | ensemble
  description   text,
  params        jsonb not null,
  code_ref      text not null,                    -- commit git
  feature_families text[] not null,               -- familles de variables utilisées (livrable 1 §5)
  created_at    timestamptz not null default now()
);

create table data_versions (
  id            text primary key,                 -- empreinte des snapshots utilisés
  snapshot_ids  bigint[] not null,
  created_at    timestamptz not null default now()
);

create table predictions (
  id              bigserial primary key,
  match_id        bigint not null references matches(id),
  model_version   text not null references model_versions(id),
  data_version    text not null references data_versions(id),
  market          market_kind not null,
  line            numeric(4,2),
  predicted_at    timestamptz not null default now(),   -- doit être < kickoff_at (contrainte par trigger)
  horizon         text not null,                  -- 'D-3' | 'D-1' | 'H-2' | 'backtest'
  probs           jsonb not null,                 -- {"home":0.42,"draw":0.27,"away":0.31}
  probs_low       jsonb,                          -- borne basse de l'incertitude
  probs_high      jsonb,
  fair_odds       jsonb not null,                 -- 1/p
  completeness    smallint not null,              -- score 0..100
  verdict         verdict_kind not null,
  factors         jsonb,                          -- [{name, contribution, source}]
  missing         text[],                         -- informations manquantes
  margin_method   text not null,                  -- 'shin' | 'multiplicative' | 'power'
  reference_quote bigint references odds_quotes(id),   -- cote utilisée pour l'espérance
  expected_value  jsonb                           -- par sélection et bookmaker
);
create index on predictions (match_id, market, predicted_at);

create or replace function bet.forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'table % est immuable : insérer une nouvelle ligne au lieu de modifier', tg_table_name;
end $$;
create trigger predictions_immutable before update or delete on predictions
  for each row execute function bet.forbid_mutation();

create or replace function bet.check_prediction_before_kickoff() returns trigger language plpgsql as $$
declare k timestamptz;
begin
  select kickoff_at into k from matches where id = new.match_id;
  if new.horizon <> 'backtest' and new.predicted_at >= k then
    raise exception 'prédiction % postérieure au coup d''envoi', new.id;
  end if;
  return new;
end $$;
create trigger predictions_before_kickoff before insert on predictions
  for each row execute function bet.check_prediction_before_kickoff();

-- ---------- Stratégies, backtests, portefeuille fictif ----------
create table strategies (
  id            text primary key,
  description   text not null,
  rules         jsonb not null,                   -- seuil EV, staking, plafonds, bookmakers
  registered_at timestamptz not null default now(),   -- pré-enregistrement avant test
  hypothesis    text not null                     -- ce que la stratégie est censée exploiter
);

create table backtest_runs (
  id            bigserial primary key,
  strategy_id   text not null references strategies(id),
  model_version text not null references model_versions(id),
  data_version  text not null references data_versions(id),
  train_from    text references seasons(id),
  test_seasons  text[] not null,
  run_at        timestamptz not null default now(),
  metrics       jsonb not null,                   -- log_loss, brier, clv, roi, drawdown, n_bets, ic...
  report_path   text
);

create table portfolios (
  id            bigserial primary key,
  name          text not null,
  bankroll_start numeric(12,2) not null,
  max_stake_pct  numeric(5,4) not null default 0.02,
  max_exposure_pct numeric(5,4) not null default 0.10,
  max_daily_stake_pct numeric(5,4) not null default 0.05,
  created_at    timestamptz not null default now()
);

create table paper_bets (
  id            bigserial primary key,
  portfolio_id  bigint not null references portfolios(id),
  prediction_id bigint not null references predictions(id),
  quote_id      bigint not null references odds_quotes(id),
  selection     selection_kind not null,
  stake         numeric(12,2) not null check (stake > 0),
  placed_at     timestamptz not null default now(),
  status        bet_status not null default 'open',
  settled_at    timestamptz,
  payout        numeric(12,2),
  closing_quote bigint references odds_quotes(id),  -- pour la CLV
  clv           numeric(8,4)
);
create trigger paper_bets_no_delete before delete on paper_bets
  for each row execute function bet.forbid_mutation();

-- ---------- Registre d'hypothèses et appels IA ----------
create table hypotheses (
  id            bigserial primary key,
  title         text not null,
  feature_family text not null,
  statement     text not null,
  registered_at timestamptz not null default now(),
  tested_in     bigint references backtest_runs(id),
  outcome       text                              -- kept | dropped | inconclusive
);

create table ai_calls (
  id            bigserial primary key,
  called_at     timestamptz not null default now(),
  provider      text not null,
  model         text not null,
  prompt_version text not null,
  purpose       text not null,                    -- extract | reconcile | explain | hypothesise | verify
  input_tokens  integer, output_tokens integer,
  cost_usd      numeric(10,6),
  status        text not null,
  error         text,
  produced_item bigint references information_items(id)
);

create table data_quality_flags (
  id            bigserial primary key,
  raised_at     timestamptz not null default now(),
  severity      text not null,                    -- info | warning | blocking
  check_name    text not null,
  entity        text,
  entity_id     bigint,
  detail        text,
  resolved_at   timestamptz
);
