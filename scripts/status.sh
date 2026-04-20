#!/usr/bin/env bash
# Visar status för lokal utvecklingsmiljö: aktiv miljö + Supabase + dev-server.
# Kör: npm run status

set -uo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

# --- Aktiv miljö ---

# Läs DATABASE_URL från .env.local (trumfar) sedan .env
DB_URL=""
if [ -f ".env.local" ]; then
  DB_URL=$(grep -E "^DATABASE_URL=" .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d "\"'")
fi
if [ -z "$DB_URL" ] && [ -f ".env" ]; then
  DB_URL=$(grep -E "^DATABASE_URL=" .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d "\"'")
fi

echo "=== Aktiv miljö ==="
if [ -z "$DB_URL" ]; then
  echo "  Miljö:    okänd (DATABASE_URL saknas)"
elif echo "$DB_URL" | grep -q "127.0.0.1\|localhost"; then
  echo -e "  Miljö:    ${GREEN}lokal${NC} (Supabase CLI)"
  echo "  DB:       $DB_URL"
elif echo "$DB_URL" | grep -q "supabase.com\|pooler.supabase"; then
  PROJECT_REF=$(echo "$DB_URL" | grep -oE 'postgres\.[a-z0-9]+' | cut -d. -f2 || echo "okänd")
  echo -e "  Miljö:    ${YELLOW}supabase-remote${NC} (projekt: $PROJECT_REF)"
  echo "  DB:       (remote Supabase)"
  echo ""
  echo -e "  ${RED}VARNING: Du kör mot remote Supabase från lokal dev!${NC}"
  echo "  Kommentera bort DATABASE_URL i .env.local för att använda lokal DB."
else
  echo "  Miljö:    okänd"
  echo "  DB:       $DB_URL"
fi

echo ""
echo "=== Supabase (lokal) ==="
if supabase status 2>/dev/null | grep -q "API URL"; then
  supabase status 2>/dev/null | grep -E "API URL|DB URL|Studio URL" | sed 's/^/  /'
else
  echo "  Inte igång — starta med: npm run db:up"
fi

echo ""
echo "=== Dev-server (Next.js) ==="
if lsof -i :3000 -sTCP:LISTEN >/dev/null 2>&1; then
  PID=$(lsof -i :3000 -sTCP:LISTEN -t | head -1)
  echo "  Kör på http://localhost:3000 (PID $PID)"
else
  echo "  Inte igång — starta med: npm run dev"
fi

echo ""
echo "=== PWA-server (offline-build, port 3001) ==="
if lsof -i :3001 -sTCP:LISTEN >/dev/null 2>&1; then
  PID=$(lsof -i :3001 -sTCP:LISTEN -t | head -1)
  echo "  Kör på http://localhost:3001 (PID $PID)"
else
  echo "  Inte igång (valfri — npm run start:pwa för offline-tester)"
fi
