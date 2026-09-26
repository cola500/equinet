#!/usr/bin/env bash
#
# deploy-production.sh [--dry-run]
#
# Triggar den gated deploy-production-körningen i GitHub Actions för
# NUVARANDE, verifierade main-SHA -- aldrig en annan branch, aldrig en SHA
# som inte redan är grön i quality-gates.yml.
#
# Rör aldrig VERCEL_TOKEN eller någon annan hemlighet: den riktiga deployen
# körs av GitHub Actions med sin egen lagrade secret. Detta script triggar
# och bevakar bara den körningen. Anropar (och anropas av) ALDRIG
# sync-vercel-token.sh -- de två är helt oberoende.
#
# Skydd (i denna ordning, avbryter vid första felet):
#   1. git-repot är rent (inga okommitterade ändringar)
#   2. nuvarande lokala branch är exakt "main"
#   3. lokal main-SHA matchar origin/main-SHA (efter git fetch)
#   4. gh pekar på exakt cola500/equinet
#   5. en avslutad quality-gates-körning finns för denna SHA
#   6. uttrycklig interaktiv bekräftelse (skriv SHA:ns första 7 tecken)
#
# --dry-run: kör alla kontroller ovan och visar planen, men triggar aldrig
#            en körning. Kräver ingen interaktiv bekräftelse. Används av
#            testsviten.
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/deploy-guard-lib.sh
source "$DIR/lib/deploy-guard-lib.sh"

REPO="cola500/equinet"
WORKFLOW="quality-gates.yml"
PROD_HEALTH_URL="https://equinet.johanlindengard.com/api/health"
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      echo "Användning: bash scripts/deploy-production.sh [--dry-run]"
      exit 0
      ;;
    *)
      echo "✖ Okänd flagga: $arg" >&2
      exit 1
      ;;
  esac
done

echo "=== Produktionsdeploy: $REPO ==="
echo ""

echo "1/6 Kontrollerar att arbetskatalogen är ren..."
dgl_require_clean_tree

echo "2/6 Kontrollerar branch..."
dgl_require_branch "main"
echo "  Branch: main"

echo "3/6 Hämtar senaste origin/main..."
git fetch origin main --quiet
LOCAL_SHA="$(dgl_local_sha main)"
REMOTE_SHA="$(dgl_remote_sha main)"
dgl_require_sha_match "$LOCAL_SHA" "$REMOTE_SHA"
TARGET_SHA="$LOCAL_SHA"
echo "  SHA: $TARGET_SHA"

echo "4/6 Kontrollerar målrepo..."
dgl_require_gh_auth
dgl_require_repo "$REPO"
echo "  Repo: $REPO"

echo "5/6 Letar efter quality-gates-körning för denna SHA..."
RUN_JSON="$(gh run list --repo "$REPO" --workflow "$WORKFLOW" --branch main \
  --json databaseId,headSha,status,conclusion,url,createdAt -L 30)"
RUN_ID="$(printf '%s' "$RUN_JSON" | node -e "
  let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
    const runs = JSON.parse(d)
    const match = runs.find(r => r.headSha === process.argv[1])
    process.stdout.write(match ? String(match.databaseId) : '')
  })" "$TARGET_SHA")"

if [ -z "$RUN_ID" ]; then
  echo "✖ Ingen quality-gates-körning hittad för $TARGET_SHA ännu." >&2
  echo "  Vänta en stund efter push/merge och försök igen." >&2
  exit 1
fi

RUN_STATUS="$(printf '%s' "$RUN_JSON" | node -e "
  let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
    const runs = JSON.parse(d)
    const match = runs.find(r => String(r.databaseId) === process.argv[1])
    process.stdout.write(match ? match.status : '')
  })" "$RUN_ID")"

if [ "$RUN_STATUS" != "completed" ]; then
  echo "✖ Körning $RUN_ID för $TARGET_SHA är inte klar ännu (status: $RUN_STATUS)." >&2
  echo "  Vänta tills den är klar innan du triggar en deploy." >&2
  exit 1
fi

DEPLOY_JOB_CONCLUSION="$(gh run view "$RUN_ID" --repo "$REPO" --json jobs \
  | node -e "
    let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
      const jobs = JSON.parse(d).jobs
      const job = jobs.find(j => j.name === 'Deploy to Production')
      process.stdout.write(job ? job.conclusion : 'missing')
    })")"

if [ "$DEPLOY_JOB_CONCLUSION" = "success" ]; then
  echo ""
  echo "✓ $TARGET_SHA är redan deployad till produktion (körning $RUN_ID). Inget att göra."
  exit 0
fi

echo "  Körning $RUN_ID hittad ('Deploy to Production': $DEPLOY_JOB_CONCLUSION)"
COMMIT_LINE="$(git log -1 --format='%h %s' "$TARGET_SHA")"

echo ""
echo "Plan:"
echo "  SHA:      $TARGET_SHA"
echo "  Commit:   $COMMIT_LINE"
echo "  Körning:  $RUN_ID"
echo "  Åtgärd:   gh run rerun $RUN_ID --failed (kör om 'Deploy to Production')"

if [ "$DRY_RUN" -eq 1 ]; then
  echo ""
  echo "DRY-RUN: inget triggat."
  exit 0
fi

SHORT_SHA="${TARGET_SHA:0:7}"
echo ""
echo "Detta triggar en RIKTIG produktionsdeploy av SHA $TARGET_SHA."
read -rp "Skriv \"DEPLOY $SHORT_SHA\" för att bekräfta: " CONFIRM
if [ "$CONFIRM" != "DEPLOY $SHORT_SHA" ]; then
  echo "✖ Bekräftelse matchade inte -- avbryter. Inget triggat." >&2
  exit 1
fi

echo ""
echo "6/6 Triggar om 'Deploy to Production'..."
gh run rerun "$RUN_ID" --repo "$REPO" --failed

echo ""
echo "Bevakar körningen (detta kan ta någon minut)..."
if ! gh run watch "$RUN_ID" --repo "$REPO" --exit-status; then
  echo "" >&2
  echo "✖ Körningen misslyckades. Se: https://github.com/$REPO/actions/runs/$RUN_ID" >&2
  exit 1
fi

echo ""
echo "✓ Körning $RUN_ID klar."
echo "  https://github.com/$REPO/actions/runs/$RUN_ID"
echo ""
echo "Verifierar $PROD_HEALTH_URL..."
if HEALTH="$(curl -fsS --max-time 15 "$PROD_HEALTH_URL" 2>/dev/null)"; then
  echo "  $HEALTH"
else
  echo "  ✖ Kunde inte nå $PROD_HEALTH_URL -- verifiera manuellt." >&2
fi

echo ""
echo "✓ Deploy av $TARGET_SHA klar."
