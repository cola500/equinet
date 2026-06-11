#!/usr/bin/env bash
#
# verify-db-urls.sh <prod|staging>
#
# Verifierar DATABASE_URL- och DIRECT_DATABASE_URL-format för vald miljö, maskerat.
# - DATABASE_URL  ska vara pooler (port 6543) med ?pgbouncer=true&connection_limit=1.
# - DIRECT_DATABASE_URL ska vara direct (port 5432) UTAN pgbouncer.
#
# Read-only. Inga secrets skrivs ut (lösenord maskeras). CLI-auth, ingen VERCEL_TOKEN.
#
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/vercel-env-lib.sh
source "$DIR/lib/vercel-env-lib.sh"

SEL="${1:-}"
PROJ="$(venv_project_name "$SEL")" || { echo "Användning: bash scripts/verify-db-urls.sh <prod|staging>"; exit 1; }

F="$(mktemp)"; trap 'rm -f "$F"' EXIT
echo "Hämtar $SEL ($PROJ) production env..."
venv_pull "$PROJ" "$F" || { echo "✖ Kunde inte pulla $SEL env. Kör 'vercel login' (CLI-auth krävs)."; exit 1; }

DU="$(venv_getval "$F" DATABASE_URL)"
DI="$(venv_getval "$F" DIRECT_DATABASE_URL)"
ok=1
chk() { if eval "$2"; then echo "  ✓ $1"; else echo "  ✗ $1"; ok=0; fi; }

echo
echo "── DATABASE_URL (pooler / runtime) ──"
echo "  maskerat: $(venv_mask "$DU")"
chk "icke-tom"                         '[ -n "$DU" ]'
chk "pooler-host (.pooler.supabase.com)" 'printf "%s" "$DU" | grep -q "pooler\.supabase\.com"'
chk "port 6543"                        'printf "%s" "$DU" | grep -q ":6543/"'
chk "?pgbouncer=true"                  'printf "%s" "$DU" | grep -q "?pgbouncer=true"'
chk "connection_limit=1"               'printf "%s" "$DU" | grep -q "connection_limit=1"'
chk "rent databasnamn (/postgres?)"    'printf "%s" "$DU" | grep -qE "/postgres\?"'

echo
echo "── DIRECT_DATABASE_URL (direct / migrations) ──"
echo "  maskerat: $(venv_mask "$DI")"
chk "icke-tom"            '[ -n "$DI" ]'
chk "port 5432 (ej 6543)" 'printf "%s" "$DI" | grep -q ":5432/" && ! printf "%s" "$DI" | grep -q ":6543/"'
chk "INTE pgbouncer"      '! printf "%s" "$DI" | grep -q "pgbouncer"'
# Host-typ är informativ, inte pass/fail: både true-direct (db.<ref>.supabase.co)
# och session-pooler (pooler...:5432) fungerar för migrationer (prepared statements).
if printf "%s" "$DI" | grep -q "pooler\.supabase\.com"; then
  echo "  ℹ host = session pooler (:5432) — OK för migrationer; kanonisk direkt är db.<ref>.supabase.co"
else
  echo "  ✓ direkt-host (db.<ref>.supabase.co)"
fi

echo
if [ "$ok" = 1 ]; then
  echo "✓ Alla format-checkar gröna ($SEL)"
else
  echo "✗ Format-avvikelser i $SEL — se ✗ ovan. Fixa med: bash scripts/set-vercel-env.sh --project $SEL --key DATABASE_URL --normalize-db-url --go"
  exit 2
fi
