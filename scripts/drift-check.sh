#!/bin/bash
# Jämför lokala Prisma-migrationer med Supabase för att detektera drift.
# Kör: npm run db:drift-check
#
# Exit codes:
#   0 = synkade eller lokal har fler (normalt vid deploy)
#   1 = drift (Supabase har migrationer som inte finns lokalt)

set -e

# --- 1. Räkna lokala migrationer ---
LOCAL_COUNT=$(ls -1d prisma/migrations/[0-9]* 2>/dev/null | wc -l | tr -d ' ')

# --- 2. Hämta DIRECT_DATABASE_URL (behövs för att fråga Supabase) ---
DIRECT_URL=""
if grep -q "^DIRECT_DATABASE_URL=" .env.local 2>/dev/null; then
  DIRECT_URL=$(grep "^DIRECT_DATABASE_URL=" .env.local | head -1 | cut -d'"' -f2)
elif grep -q "^DIRECT_DATABASE_URL=" .env 2>/dev/null; then
  DIRECT_URL=$(grep "^DIRECT_DATABASE_URL=" .env | head -1 | cut -d'"' -f2)
fi

# Fallback: prova DATABASE_URL om DIRECT inte finns
if [[ -z "$DIRECT_URL" ]]; then
  if grep -q "^DATABASE_URL=" .env.local 2>/dev/null; then
    DIRECT_URL=$(grep "^DATABASE_URL=" .env.local | head -1 | cut -d'"' -f2)
  elif grep -q "^DATABASE_URL=" .env 2>/dev/null; then
    DIRECT_URL=$(grep "^DATABASE_URL=" .env | head -1 | cut -d'"' -f2)
  fi
fi

if [[ -z "$DIRECT_URL" ]]; then
  echo "FEL: Ingen DATABASE_URL hittad i .env / .env.local" >&2
  exit 1
fi

# Skippa drift-check mot localhost (ingen mening)
if [[ "$DIRECT_URL" == *"localhost"* ]] || [[ "$DIRECT_URL" == *"127.0.0.1"* ]]; then
  echo ""
  echo "  Drift-check: Lokal databas -- skippas"
  echo ""
  exit 0
fi

# --- 3. Verifiera att Docker-containern kör (behövs för psql) ---
if ! docker ps 2>/dev/null | grep -q equinet-db; then
  echo "FEL: Docker-containern 'equinet-db' kör inte." >&2
  echo "  Starta med: npm run db:up" >&2
  exit 1
fi

# --- 4. Hämta migration-count från Supabase ---
REMOTE_COUNT=$(docker exec equinet-db psql "$DIRECT_URL" -t -A -c \
  "SELECT COUNT(*) FROM _prisma_migrations" \
  2>/dev/null | tr -d ' ')

if [[ -z "$REMOTE_COUNT" ]] || ! [[ "$REMOTE_COUNT" =~ ^[0-9]+$ ]]; then
  echo "FEL: Kunde inte hämta migration-count från Supabase." >&2
  echo "  Kontrollera DIRECT_DATABASE_URL och nätverksåtkomst." >&2
  exit 1
fi

# --- 5. Jämför ---
echo ""
echo "  Drift-check:"
echo "    Lokalt:   $LOCAL_COUNT migrationer"
echo "    Supabase: $REMOTE_COUNT migrationer"

if [[ "$LOCAL_COUNT" -eq "$REMOTE_COUNT" ]]; then
  echo "    Status:   Synkade ($LOCAL_COUNT/$REMOTE_COUNT)"
  echo ""
  exit 0
elif [[ "$LOCAL_COUNT" -gt "$REMOTE_COUNT" ]]; then
  PENDING=$((LOCAL_COUNT - REMOTE_COUNT))
  echo "    Status:   $PENDING pending migration(er) (normalt vid deploy)"
  echo ""
  exit 0
else
  DRIFT=$((REMOTE_COUNT - LOCAL_COUNT))
  echo ""
  echo "  DRIFT DETECTED: Supabase har $DRIFT migration(er) som inte finns lokalt!"
  echo "  Detta tyder på att migrationer körts direkt på Supabase utan lokal fil."
  echo ""
  echo "  Åtgärd:"
  echo "    1. Kör: npx prisma migrate dev (synkar lokalt)"
  echo "    2. Eller: Skapa saknad migrationsfil lokalt + prisma migrate resolve"
  echo ""
  exit 1
fi
