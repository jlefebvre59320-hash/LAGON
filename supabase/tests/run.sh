#!/usr/bin/env bash
# Rejoue les migrations de modération, d'alertes et de mise en avant sur un
# Postgres local jetable, puis vérifie les règles (regles.sql).
#
# Prérequis : les binaires PostgreSQL 15+ (initdb, postgres, psql) et
# l'extension unaccent (paquet postgresql-contrib). Aucune connexion à
# Supabase : les tables des migrations antérieures sont réduites à un
# stub (stub.sql). C'est un test des règles, pas du schéma complet.
#
# Usage : npm run test:sql        (ou bash supabase/tests/run.sh)
set -euo pipefail

ICI="$(cd "$(dirname "$0")" && pwd)"
MIG="$ICI/../migrations"
BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls /usr/lib/postgresql/*/bin/initdb 2>/dev/null | tail -1)")}"
DIR="$(mktemp -d)"
PORT="${PG_TEST_PORT:-5499}"
trap '"$BIN/pg_ctl" -D "$DIR/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT

# initdb refuse root : on descend sur nobody si besoin.
run_as() { if [ "$(id -u)" = "0" ]; then chown -R nobody "$DIR"; su nobody -s /bin/sh -c "$*"; else sh -c "$*"; fi; }
run_as "'$BIN/initdb' -D '$DIR/data' -U postgres --auth=trust >/dev/null"
run_as "'$BIN/pg_ctl' -D '$DIR/data' -o '-p $PORT -k $DIR -c listen_addresses=' -l '$DIR/log' start >/dev/null"
PSQL="$BIN/psql -h $DIR -p $PORT -U postgres -q -v ON_ERROR_STOP=1"

$PSQL -c "create database t" >/dev/null
$PSQL -d t -f "$ICI/stub.sql" >/dev/null
for f in "$MIG"/0032_*.sql "$MIG"/0033_*.sql "$MIG"/0034_*.sql "$MIG"/0035_*.sql "$MIG"/0036_*.sql; do
  echo "→ $(basename "$f")"
  $PSQL -d t -f "$f" 2>&1 | grep -v "NOTICE:" || true
done
echo "→ regles.sql"
$PSQL -d t -f "$ICI/regles.sql"
