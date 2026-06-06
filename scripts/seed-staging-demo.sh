#!/usr/bin/env bash
#
# seed-staging-demo.sh — safe helper to reset the demo-provider data on STAGING.
#
# What it does:
#   1. Prompts for the staging DATABASE_URL (read -rsp — never echoed).
#   2. Validates it targets the staging Supabase project (refuses prod / localhost / unknown).
#   3. Pulls the non-secret Supabase env (NEXT_PUBLIC_SUPABASE_URL + SERVICE_ROLE_KEY)
#      from Vercel into a gitignored temp file, then deletes it.
#   4. Runs `seed-demo-provider.ts --reset` against staging with env passed INLINE
#      (never written to .env.local / .env). The TS guard in the seed re-checks the target.
#
# Usage:
#   bash scripts/seed-staging-demo.sh             # full run (asks for confirmation)
#   bash scripts/seed-staging-demo.sh --dry-run   # validate only, NO seed, NO DB writes
#
# Secrets are never printed. The DB URL is never persisted to disk.

set -euo pipefail

STAGING_REF="zzdamokfeenencuggjjp"
PROD_REF="xybyzflfxnqqyxnvjklv"

DRY_RUN=0
CUSTOMER_LOGIN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --customer-login) CUSTOMER_LOGIN=1 ;;  # also make the demo customer (Lisa) loginable
  esac
done

TMP_ENV=""
cleanup() { [[ -n "$TMP_ENV" && -f "$TMP_ENV" ]] && rm -f "$TMP_ENV"; }
trap cleanup EXIT

# --- 1. Prompt for the staging DATABASE_URL (no echo) ---------------------------
read -rsp "Staging DATABASE_URL (direct, port 5432): " DB_URL
echo
if [[ -z "$DB_URL" ]]; then
  echo "FEL: ingen URL angiven." >&2
  exit 1
fi

# --- 2. Bash-level guard (first line of defense) --------------------------------
HOST=$(printf '%s' "$DB_URL" | sed -E 's#.*@([^:/]+).*#\1#')
if printf '%s' "$DB_URL" | grep -qiE 'localhost|127\.0\.0\.1'; then
  echo "FEL: URL pekar på localhost — staging krävs." >&2
  exit 1
fi
if printf '%s' "$DB_URL" | grep -qi "$PROD_REF"; then
  echo "FEL: URL pekar på PRODUKTION ($PROD_REF). Avbryter." >&2
  exit 1
fi
if ! printf '%s' "$DB_URL" | grep -qi "$STAGING_REF"; then
  echo "FEL: URL matchar inte staging-projektet ($STAGING_REF). Host: $HOST" >&2
  exit 1
fi
echo "✓ URL pekar på staging ($STAGING_REF), host: $HOST"

# --- 3. Pull non-secret Supabase env from Vercel --------------------------------
TMP_ENV=".env.staging.pull.tmp"
if ! vercel env pull --environment=preview --git-branch=staging "$TMP_ENV" >/dev/null 2>&1; then
  echo "FEL: 'vercel env pull' misslyckades (är CLI inloggad och projektet länkat?)." >&2
  exit 1
fi
SB_URL=$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "$TMP_ENV" | head -1 | cut -d= -f2- | tr -d '"')
SRK=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' "$TMP_ENV" | head -1 | cut -d= -f2- | tr -d '"')
rm -f "$TMP_ENV"; TMP_ENV=""

if [[ -z "$SB_URL" || -z "$SRK" ]]; then
  echo "FEL: kunde inte hämta NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY från Vercel." >&2
  exit 1
fi
if ! printf '%s' "$SB_URL" | grep -qi "$STAGING_REF"; then
  echo "FEL: Vercel NEXT_PUBLIC_SUPABASE_URL matchar inte staging ($STAGING_REF). Avbryter." >&2
  exit 1
fi
echo "✓ Hämtade Supabase-env för staging (service-role-nyckel: ${#SRK} tecken, aldrig utskriven)"

# --- 4. Run seed (or check-only on dry-run) -------------------------------------
# Env passed INLINE → seed-demo-provider's dotenv won't override it (.env.local stays untouched).
run_seed() {
  local mode="$1" # --check-only | --reset
  local extra=""
  [[ "$CUSTOMER_LOGIN" == "1" && "$mode" == "--reset" ]] && extra="--customer-login"
  DATABASE_URL="$DB_URL" \
  DIRECT_DATABASE_URL="$DB_URL" \
  NEXT_PUBLIC_SUPABASE_URL="$SB_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$SRK" \
  SEED_TARGET=staging \
    npx tsx scripts/seed-demo-provider.ts "$mode" $extra
}

if [[ "$DRY_RUN" == "1" ]]; then
  run_seed --check-only
  echo "DRY-RUN klar: validering OK, ingen seed körd, ingen DB-skrivning."
  exit 0
fi

[[ "$CUSTOMER_LOGIN" == "1" ]] && echo "  + skapar inloggningsbar demokund (Lisa Andersson)"
read -rp "Kör db:seed:demo-provider:reset mot STAGING ($STAGING_REF)? Detta RADERAR demo-data. (y/N): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Avbrutet — ingen seed körd."
  exit 0
fi

run_seed --reset
echo "✓ Klart — staging-demodata återställd."
