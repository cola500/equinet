#!/bin/bash
# Applicerar pending Prisma-migrationer mot Supabase.
# Kör: npm run migrate:supabase
#
# Använder `prisma migrate deploy` -- Prismas officiella kommando
# för att applicera migrationer mot produktion. Det jämför
# _prisma_migrations-tabellen med lokala filer och applicerar
# saknade migrationer i ordning.

set -e

echo ""
echo "=== Migrera Supabase ==="
echo ""

# --- 1. Hämta DIRECT_DATABASE_URL (samma mönster som drift-check.sh) ---
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

# --- 2. Blockera om URL pekar på localhost ---
if [[ "$DIRECT_URL" == *"localhost"* ]] || [[ "$DIRECT_URL" == *"127.0.0.1"* ]]; then
  echo "FEL: DATABASE_URL pekar på localhost." >&2
  echo "  Detta kommando är för Supabase -- använd 'npx prisma migrate dev' lokalt." >&2
  exit 1
fi

# --- 3. Verifiera att Docker-containern kör (behövs för psql) ---
if ! docker ps 2>/dev/null | grep -q equinet-db; then
  echo "FEL: Docker-containern 'equinet-db' kör inte." >&2
  echo "  Starta med: npm run db:up" >&2
  exit 1
fi

# --- 4. Räkna lokala vs remote migrationer ---
LOCAL_COUNT=$(ls -1d prisma/migrations/[0-9]* 2>/dev/null | wc -l | tr -d ' ')

REMOTE_COUNT=$(docker exec equinet-db psql "$DIRECT_URL" -t -A -c \
  "SELECT COUNT(*) FROM _prisma_migrations" \
  2>/dev/null | tr -d ' ')

if [[ -z "$REMOTE_COUNT" ]] || ! [[ "$REMOTE_COUNT" =~ ^[0-9]+$ ]]; then
  echo "FEL: Kunde inte hämta migration-count från Supabase." >&2
  echo "  Kontrollera DIRECT_DATABASE_URL och nätverksåtkomst." >&2
  exit 1
fi

PENDING=$((LOCAL_COUNT - REMOTE_COUNT))

echo "  Lokalt:   $LOCAL_COUNT migrationer"
echo "  Supabase: $REMOTE_COUNT migrationer"
echo "  Pending:  $PENDING"
echo ""

# --- 5. Om 0 pending: klart ---
if [[ "$PENDING" -le 0 ]]; then
  echo "  Redan synkad!"
  echo ""
  exit 0
fi

# --- 6. Lista pending migrationer ---
echo "  Pending migrationer:"
ls -1d prisma/migrations/[0-9]* 2>/dev/null | sort | tail -"$PENDING" | while read dir; do
  echo "    $(basename "$dir")"
done
echo ""

# --- 7. Bekräfta ---
read -p "  Applicera $PENDING migration(er) på Supabase? (y/N) " CONFIRM
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

# --- 9. Verifiera ---
NEW_REMOTE=$(docker exec equinet-db psql "$DIRECT_URL" -t -A -c \
  "SELECT COUNT(*) FROM _prisma_migrations" \
  2>/dev/null | tr -d ' ')

echo "  Klar! Supabase har nu $NEW_REMOTE migrationer (lokalt: $LOCAL_COUNT)"
echo ""
