#!/bin/bash
set -e

source "$(dirname "$0")/_lib.sh"

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

# Namnbaserad pending-beräkning
PENDING_NAMES=""
PENDING_COUNT=0
DIRECT_URL=$(get_direct_url)

if [[ -n "$DIRECT_URL" ]] && ! is_localhost_url "$DIRECT_URL"; then
  if docker ps 2>/dev/null | grep -q equinet-db; then
    LOCAL_NAMES=$(get_local_migration_names)
    REMOTE_NAMES=$(get_remote_migration_names "$DIRECT_URL")
    if [[ -n "$REMOTE_NAMES" ]]; then
      PENDING_NAMES=$(comm -23 <(echo "$LOCAL_NAMES") <(echo "$REMOTE_NAMES"))
      PENDING_COUNT=$(echo "$PENDING_NAMES" | grep -c . || true)
    fi
  fi
fi

if [[ "$PENDING_COUNT" -gt 0 ]]; then
  echo ""
  echo "  $PENDING_COUNT nya migration(er) -- skapar backup innan deploy..."
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
if [[ "$PENDING_COUNT" -gt 0 ]]; then
  echo "  3. Kör: npm run migrate:supabase ($PENDING_COUNT pending)"
  echo "$PENDING_NAMES" | while read -r name; do
    echo "     - $name"
  done
  echo "     En backup skapades automatiskt i backups/"
else
  echo "  3. Inga nya migrationer"
fi
echo "  4. Sentry -- inga nya fel"
echo ""
