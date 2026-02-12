#!/bin/bash
# Visa vilken databas som är aktiv
# Kollar .env.local först (högre prioritet i Next.js), sedan .env

DB_URL=""
SOURCE=""

if grep -q "^DATABASE_URL=" .env.local 2>/dev/null; then
  DB_URL=$(grep "^DATABASE_URL=" .env.local | head -1 | cut -d'"' -f2)
  SOURCE=".env.local"
elif grep -q "^DATABASE_URL=" .env 2>/dev/null; then
  DB_URL=$(grep "^DATABASE_URL=" .env | head -1 | cut -d'"' -f2)
  SOURCE=".env"
fi

echo ""
if [[ "$DB_URL" == *"localhost"* ]]; then
  echo "  Databas: Lokal PostgreSQL (Docker)"
  echo "  Källa:   $SOURCE"
  if docker ps 2>/dev/null | grep -q equinet-db; then
    echo "  Status:  Kör (equinet-db)"
  else
    echo "  Status:  Stoppad -- kör 'npm run db:up'"
  fi
elif [[ "$DB_URL" == *"supabase"* ]] || [[ "$DB_URL" == *"pooler"* ]]; then
  echo "  Databas: Supabase (hostad)"
  echo "  Källa:   $SOURCE"
  echo "  URL:     ${DB_URL:0:50}..."
else
  echo "  Databas: Okänd"
  echo "  URL:     ${DB_URL:0:50}..."
fi
echo ""
