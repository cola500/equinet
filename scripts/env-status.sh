#!/bin/bash
# Visa vilken databas som är aktiv
# Kollar .env.local först (högre prioritet i Next.js), sedan .env
# Se även: npm run status (utökad version med Supabase + dev-server)

DB_URL=""
SOURCE=""

if grep -q "^DATABASE_URL=" .env.local 2>/dev/null; then
  DB_URL=$(grep "^DATABASE_URL=" .env.local | head -1 | cut -d= -f2- | tr -d "\"'")
  SOURCE=".env.local"
elif grep -q "^DATABASE_URL=" .env 2>/dev/null; then
  DB_URL=$(grep "^DATABASE_URL=" .env | head -1 | cut -d= -f2- | tr -d "\"'")
  SOURCE=".env"
fi

echo ""
if [[ "$DB_URL" == *"127.0.0.1"* ]] || [[ "$DB_URL" == *"localhost"* ]]; then
  echo "  Databas: Lokal Supabase CLI"
  echo "  Källa:   $SOURCE"
  if supabase status 2>/dev/null | grep -q "API URL"; then
    echo "  Status:  Kör"
  else
    echo "  Status:  Stoppad -- kör 'npm run db:up'"
  fi
elif [[ "$DB_URL" == *"supabase"* ]] || [[ "$DB_URL" == *"pooler"* ]]; then
  echo "  Databas: Supabase (hostad/remote)"
  echo "  Källa:   $SOURCE"
  echo "  URL:     ${DB_URL:0:50}..."
  echo ""
  echo "  VARNING: Du kör mot remote Supabase från lokal dev!"
else
  echo "  Databas: Okänd"
  echo "  URL:     ${DB_URL:0:50}..."
fi
echo ""
