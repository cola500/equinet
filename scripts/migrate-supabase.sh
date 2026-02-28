#!/bin/bash
# Applicerar pending Prisma-migrationer mot Supabase.
# Kör: npm run migrate:supabase
#
# Använder `prisma migrate deploy` -- Prismas officiella kommando
# för att applicera migrationer mot produktion. Det jämför
# _prisma_migrations-tabellen med lokala filer och applicerar
# saknade migrationer i ordning.

set -e

source "$(dirname "$0")/_lib.sh"

echo ""
echo "=== Migrera Supabase ==="
echo ""

# --- 1. Hämta URL ---
DIRECT_URL=$(get_direct_url)

if [[ -z "$DIRECT_URL" ]]; then
  echo "FEL: Ingen DATABASE_URL hittad i .env / .env.local" >&2
  exit 1
fi

# --- 2. Blockera om URL pekar på localhost ---
if is_localhost_url "$DIRECT_URL"; then
  echo "FEL: DATABASE_URL pekar på localhost." >&2
  echo "  Detta kommando är för Supabase -- använd 'npx prisma migrate dev' lokalt." >&2
  exit 1
fi

# --- 3. Docker krävs ---
require_docker || exit 1

# --- 4. Namnbaserad jämförelse ---
LOCAL_NAMES=$(get_local_migration_names)
REMOTE_NAMES=$(get_remote_migration_names "$DIRECT_URL")

if [[ -z "$REMOTE_NAMES" ]]; then
  echo "FEL: Kunde inte hämta migrationer från Supabase." >&2
  echo "  Kontrollera DIRECT_DATABASE_URL och nätverksåtkomst." >&2
  exit 1
fi

PENDING=$(comm -23 <(echo "$LOCAL_NAMES") <(echo "$REMOTE_NAMES"))
PENDING_COUNT=$(echo "$PENDING" | grep -c . || true)

LOCAL_COUNT=$(echo "$LOCAL_NAMES" | grep -c . || true)
REMOTE_COUNT=$(echo "$REMOTE_NAMES" | grep -c . || true)

echo "  Lokalt:   $LOCAL_COUNT migrationer"
echo "  Supabase: $REMOTE_COUNT migrationer"
echo "  Pending:  $PENDING_COUNT"
echo ""

# --- 5. Om 0 pending: klart ---
if [[ "$PENDING_COUNT" -eq 0 ]]; then
  echo "  Redan synkad!"
  echo ""
  exit 0
fi

# --- 6. Lista pending migrationer ---
echo "  Pending migrationer:"
echo "$PENDING" | while read -r name; do
  echo "    $name"
done
echo ""

# --- 7. Bekräfta ---
read -p "  Applicera $PENDING_COUNT migration(er) på Supabase? (y/N) " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "  Avbrutet."
  exit 0
fi

echo ""

# --- 8. Kör prisma migrate deploy ---
echo "  Kör prisma migrate deploy..."
echo ""
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy

echo ""

# --- 9. Verifiera med namnbaserad jämförelse ---
NEW_REMOTE_NAMES=$(get_remote_migration_names "$DIRECT_URL")
NEW_REMOTE_COUNT=$(echo "$NEW_REMOTE_NAMES" | grep -c . || true)
STILL_PENDING=$(comm -23 <(echo "$LOCAL_NAMES") <(echo "$NEW_REMOTE_NAMES"))
STILL_PENDING_COUNT=$(echo "$STILL_PENDING" | grep -c . || true)

if [[ "$STILL_PENDING_COUNT" -eq 0 ]]; then
  echo "  Klar! Alla migrationer synkade ($NEW_REMOTE_COUNT st)."
else
  echo "  Varning: $STILL_PENDING_COUNT migration(er) kvar efter deploy:"
  echo "$STILL_PENDING" | while read -r name; do
    echo "    $name"
  done
fi
echo ""
