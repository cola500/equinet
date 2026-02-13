#!/bin/bash
set -e

echo "=== Deploy Equinet ==="
echo ""

# 1. Visa miljö
bash scripts/env-status.sh

# 2. Git status
if [[ -n $(git status -s) ]]; then
  echo "Uncommittade ändringar:"
  git status -s
  echo ""
  echo "Committa först, sedan kör deploy igen."
  exit 1
fi
echo "Git: Clean"

# 3. Kvalitetscheckar
echo ""
echo "Kör kvalitetscheckar..."
npm run test:run || { echo "Tester failade!"; exit 1; }
npm run typecheck || { echo "TypeScript-fel!"; exit 1; }
npm run lint || { echo "Lint-fel!"; exit 1; }
echo ""
echo "Alla checkar OK"

# 4. Drift-check (blockerar vid drift)
bash scripts/drift-check.sh || {
  echo ""
  echo "Deploy avbruten -- fixa drift innan deploy."
  exit 1
}

# 5. Migrationscheck + auto-backup om pending migrationer
bash scripts/migrate-check.sh

# Räkna pending migrationer (lokal vs Supabase)
LOCAL_COUNT=$(ls -1d prisma/migrations/[0-9]* 2>/dev/null | wc -l | tr -d ' ')

DIRECT_URL=""
if grep -q "^DIRECT_DATABASE_URL=" .env.local 2>/dev/null; then
  DIRECT_URL=$(grep "^DIRECT_DATABASE_URL=" .env.local | head -1 | cut -d'"' -f2)
elif grep -q "^DIRECT_DATABASE_URL=" .env 2>/dev/null; then
  DIRECT_URL=$(grep "^DIRECT_DATABASE_URL=" .env | head -1 | cut -d'"' -f2)
fi

PENDING=0
if [[ -n "$DIRECT_URL" ]] && [[ "$DIRECT_URL" != *"localhost"* ]] && [[ "$DIRECT_URL" != *"127.0.0.1"* ]]; then
  if docker ps 2>/dev/null | grep -q equinet-db; then
    REMOTE_COUNT=$(docker exec equinet-db psql "$DIRECT_URL" -t -A -c \
      "SELECT COUNT(*) FROM _prisma_migrations" 2>/dev/null | tr -d ' ')
    if [[ -n "$REMOTE_COUNT" ]] && [[ "$REMOTE_COUNT" =~ ^[0-9]+$ ]]; then
      PENDING=$((LOCAL_COUNT - REMOTE_COUNT))
    fi
  fi
fi

if [[ "$PENDING" -gt 0 ]]; then
  echo ""
  echo "  $PENDING nya migration(er) -- skapar backup innan deploy..."
  bash scripts/db-backup.sh --quiet && echo "  Backup klar." || echo "  Backup kunde inte skapas (fortsätter ändå)."
fi

# 6. Push
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo ""
echo "Pushar till origin/$BRANCH..."
git push origin "$BRANCH"

# 7. Post-deploy
echo ""
echo "=== Push klar ==="
echo ""
echo "Vercel deployer automatiskt. Verifiera:"
echo "  1. Vercel Dashboard -- vänta på 'Ready'"
echo "  2. /api/health -- ska returnera 200"
if [[ "$PENDING" -gt 0 ]]; then
  echo "  3. Kör apply_migration på Supabase ($PENDING pending)"
  echo "     En backup skapades automatiskt i backups/"
else
  echo "  3. Inga nya migrationer"
fi
echo "  4. Sentry -- inga nya fel"
echo ""
