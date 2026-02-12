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

# 4. Migrationscheck
bash scripts/migrate-check.sh

# 5. Push
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Pushar till origin/$BRANCH..."
git push origin "$BRANCH"

# 6. Post-deploy
echo ""
echo "=== Push klar ==="
echo ""
echo "Vercel deployer automatiskt. Verifiera:"
echo "  1. Vercel Dashboard -- vänta på 'Ready'"
echo "  2. /api/health -- ska returnera 200"
echo "  3. Om nya migrationer: kör apply_migration på Supabase"
echo "  4. Sentry -- inga nya fel"
echo ""
