#!/bin/bash
# Namnbaserad migrationsjämförelse mellan lokalt och Supabase.
# Kör: npm run migrate:status
#
# Exit codes:
#   0 = synkade (eller localhost -- inget att jämföra)
#   1 = drift (migrationer saknas lokalt eller i Supabase)
#   2 = misslyckade migrationer i Supabase

source "$(dirname "$0")/_lib.sh"

echo ""
echo "=== Migrationsstatus ==="
echo ""

# --- 1. Hämta URL ---
DIRECT_URL=$(get_direct_url)

if [[ -z "$DIRECT_URL" ]]; then
  echo "FEL: Ingen DATABASE_URL hittad i .env / .env.local" >&2
  exit 1
fi

# --- 2. Localhost? Visa bara lokal info ---
if is_localhost_url "$DIRECT_URL"; then
  LOCAL_COUNT=$(get_local_migration_names | wc -l | tr -d ' ')
  echo "  Databas: Lokal (localhost)"
  echo "  Lokala migrationer: $LOCAL_COUNT"
  echo ""
  echo "  Tips: Byt till Supabase-URL för att jämföra med produktion."
  echo ""
  exit 0
fi

# --- 3. Docker krävs för psql mot Supabase ---
require_docker || exit 1

# --- 4. Hämta namnlistor ---
LOCAL_NAMES=$(get_local_migration_names)
REMOTE_NAMES=$(get_remote_migration_names "$DIRECT_URL")

if [[ -z "$REMOTE_NAMES" ]]; then
  echo "FEL: Kunde inte hämta migrationer från Supabase." >&2
  echo "  Kontrollera DIRECT_DATABASE_URL och nätverksåtkomst." >&2
  exit 1
fi

LOCAL_COUNT=$(echo "$LOCAL_NAMES" | grep -c . || true)
REMOTE_COUNT=$(echo "$REMOTE_NAMES" | grep -c . || true)

# --- 5. Jämför med comm ---
ONLY_LOCAL=$(comm -23 <(echo "$LOCAL_NAMES") <(echo "$REMOTE_NAMES"))
ONLY_REMOTE=$(comm -13 <(echo "$LOCAL_NAMES") <(echo "$REMOTE_NAMES"))
SYNCED=$(comm -12 <(echo "$LOCAL_NAMES") <(echo "$REMOTE_NAMES"))

ONLY_LOCAL_COUNT=$(echo "$ONLY_LOCAL" | grep -c . || true)
ONLY_REMOTE_COUNT=$(echo "$ONLY_REMOTE" | grep -c . || true)
SYNCED_COUNT=$(echo "$SYNCED" | grep -c . || true)

echo "  Lokalt:   $LOCAL_COUNT migrationer"
echo "  Supabase: $REMOTE_COUNT migrationer"
echo "  Synkade:  $SYNCED_COUNT"
echo ""

EXIT_CODE=0

# --- 6. Pending (finns lokalt men inte i Supabase) ---
if [[ "$ONLY_LOCAL_COUNT" -gt 0 ]]; then
  echo "  Pending ($ONLY_LOCAL_COUNT st -- finns lokalt men inte i Supabase):"
  echo "$ONLY_LOCAL" | while read -r name; do
    echo "    $name"
  done
  echo ""
  echo "  Atgard: Kor 'npm run migrate:supabase' for att applicera."
  echo ""
fi

# --- 7. Drift (finns i Supabase men inte lokalt) ---
if [[ "$ONLY_REMOTE_COUNT" -gt 0 ]]; then
  echo "  DRIFT ($ONLY_REMOTE_COUNT st -- finns i Supabase men INTE lokalt):"
  echo "$ONLY_REMOTE" | while read -r name; do
    echo "    $name"
  done
  echo ""
  echo "  Atgard: Skapa saknade migrationsfiler lokalt + 'prisma migrate resolve --applied'"
  echo ""
  EXIT_CODE=1
fi

# --- 8. Misslyckade migrationer ---
FAILED=$(query_supabase "$DIRECT_URL" \
  "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL" \
  2>/dev/null)

if [[ -n "$FAILED" ]]; then
  FAILED_COUNT=$(echo "$FAILED" | grep -c . || true)
  echo "  MISSLYCKADE ($FAILED_COUNT st -- finns i _prisma_migrations utan finished_at):"
  echo "$FAILED" | while read -r name; do
    echo "    $name"
  done
  echo ""
  echo "  Atgard: Ta bort raderna med:"
  echo "    DELETE FROM _prisma_migrations WHERE finished_at IS NULL;"
  echo ""
  EXIT_CODE=2
fi

# --- 9. Allt OK ---
if [[ "$ONLY_LOCAL_COUNT" -eq 0 ]] && [[ "$ONLY_REMOTE_COUNT" -eq 0 ]] && [[ -z "$FAILED" ]]; then
  echo "  Status: Synkade"
fi

echo ""
exit "$EXIT_CODE"
