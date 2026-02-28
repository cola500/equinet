#!/bin/bash
# Jämför lokala Prisma-migrationer med Supabase för att detektera drift.
# Kör: npm run db:drift-check
#
# Exit codes:
#   0 = synkade eller lokal har fler (normalt vid deploy)
#   1 = drift (Supabase har migrationer som inte finns lokalt)

set -e

source "$(dirname "$0")/_lib.sh"

# --- 1. Hämta URL ---
DIRECT_URL=$(get_direct_url)

if [[ -z "$DIRECT_URL" ]]; then
  echo "FEL: Ingen DATABASE_URL hittad i .env / .env.local" >&2
  exit 1
fi

# Skippa drift-check mot localhost (ingen mening)
if is_localhost_url "$DIRECT_URL"; then
  echo ""
  echo "  Drift-check: Lokal databas -- skippas"
  echo ""
  exit 0
fi

# --- 2. Docker krävs ---
require_docker || exit 1

# --- 3. Hämta namnlistor ---
LOCAL_NAMES=$(get_local_migration_names)
REMOTE_NAMES=$(get_remote_migration_names "$DIRECT_URL")

if [[ -z "$REMOTE_NAMES" ]]; then
  echo "FEL: Kunde inte hämta migrationer från Supabase." >&2
  echo "  Kontrollera DIRECT_DATABASE_URL och nätverksåtkomst." >&2
  exit 1
fi

# --- 4. Namnbaserad jämförelse ---
ONLY_LOCAL=$(comm -23 <(echo "$LOCAL_NAMES") <(echo "$REMOTE_NAMES"))
ONLY_REMOTE=$(comm -13 <(echo "$LOCAL_NAMES") <(echo "$REMOTE_NAMES"))

ONLY_LOCAL_COUNT=$(echo "$ONLY_LOCAL" | grep -c . || true)
ONLY_REMOTE_COUNT=$(echo "$ONLY_REMOTE" | grep -c . || true)

LOCAL_COUNT=$(echo "$LOCAL_NAMES" | grep -c . || true)
REMOTE_COUNT=$(echo "$REMOTE_NAMES" | grep -c . || true)

echo ""
echo "  Drift-check:"
echo "    Lokalt:   $LOCAL_COUNT migrationer"
echo "    Supabase: $REMOTE_COUNT migrationer"

if [[ "$ONLY_REMOTE_COUNT" -gt 0 ]]; then
  echo ""
  echo "  DRIFT DETECTED: $ONLY_REMOTE_COUNT migration(er) finns i Supabase men INTE lokalt!"
  echo "$ONLY_REMOTE" | while read -r name; do
    echo "    $name"
  done
  echo ""
  echo "  Atgard:"
  echo "    1. Kor: npx prisma migrate dev (synkar lokalt)"
  echo "    2. Eller: Skapa saknad migrationsfil lokalt + prisma migrate resolve"
  echo ""
  exit 1
elif [[ "$ONLY_LOCAL_COUNT" -gt 0 ]]; then
  echo "    Status:   $ONLY_LOCAL_COUNT pending migration(er) (normalt vid deploy)"
  echo "$ONLY_LOCAL" | while read -r name; do
    echo "      $name"
  done
  echo ""
  exit 0
else
  echo "    Status:   Synkade ($LOCAL_COUNT/$REMOTE_COUNT)"
  echo ""
  exit 0
fi
