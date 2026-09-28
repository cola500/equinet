#!/usr/bin/env bash
#
# deploy-production.sh --staging-verified-sha <sha> [--override-reason "<text>"] [--dry-run]
#
# Triggar en RIKTIG, gated produktionsdeploy via workflow_dispatch av
# .github/workflows/deploy-production.yml, för NUVARANDE, verifierade
# main-SHA -- aldrig en annan branch, aldrig en SHA som inte redan är grön
# i quality-gates.yml. Detta script anropar aldrig Vercel eller rör
# VERCEL_TOKEN direkt -- den riktiga deployen körs av GitHub Actions med
# sin egen lagrade secret. Detta script dispatchar och bevakar bara den
# körningen. Anropar (och anropas av) ALDRIG sync-vercel-token.sh -- de två
# är helt oberoende.
#
# --staging-verified-sha <sha> (OBLIGATORISKT för en riktig körning): den
#   SHA du personligen verifierade som god på staging. Måste matcha
#   nuvarande main-SHA, annars krävs --override-reason. Det finns idag
#   ingen maskinläsbar "senast staging-godkänd"-markering (se
#   docs/operations/staging-environment-setup.md) -- detta är en
#   attesterad, inte oberoende bevisad, kontroll.
#
# --override-reason "<text>": krävs bara om staging-SHA:n skiljer sig från
#   main-SHA:n. Ett uttryckligt, dokumenterat undantag.
#
# Skydd (i denna ordning, avbryter vid första felet):
#   1. git-repot är rent (inga okommitterade ändringar)
#   2. nuvarande lokala branch är exakt "main"
#   3. lokal main-SHA matchar origin/main-SHA (efter git fetch)
#   4. gh pekar på exakt cola500/equinet
#   5. --staging-verified-sha är angiven (eller matchar/har override-reason)
#   6. uttrycklig interaktiv bekräftelse (skriv SHA:ns första 7 tecken)
#
# Workflowet självt (deploy-production.yml) gör sina EGNA, oberoende
# kontroller (SHA på main, grön Quality Gate Passed, staging-match) --
# detta script kan inte kringgå dem, det bara sparar dig från att skriva
# `gh workflow run` för hand.
#
# --dry-run: kör alla lokala kontroller ovan och visar planen, men
#            dispatchar aldrig workflowet. Kräver ingen interaktiv
#            bekräftelse. Används av testsviten. (Skiljer sig från
#            workflowets EGNA `dry_run`-input, som körs verkligt i GitHub
#            Actions men hoppar över själva vercel deploy-steget -- detta
#            script skickar alltid dry_run=false när det dispatchar på
#            riktigt, eftersom du redan skrivit den fullständiga
#            bekräftelsefrasen vid det laget.)
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/deploy-guard-lib.sh
source "$DIR/lib/deploy-guard-lib.sh"

REPO="cola500/equinet"
WORKFLOW="deploy-production.yml"
DRY_RUN=0
STAGING_VERIFIED_SHA=""
OVERRIDE_REASON=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --staging-verified-sha)
      STAGING_VERIFIED_SHA="${2:-}"
      if [ -z "$STAGING_VERIFIED_SHA" ]; then
        echo "✖ --staging-verified-sha kräver ett värde." >&2
        exit 1
      fi
      shift 2
      ;;
    --override-reason)
      OVERRIDE_REASON="${2:-}"
      shift 2
      ;;
    -h|--help)
      echo "Användning: bash scripts/deploy-production.sh --staging-verified-sha <sha> [--override-reason \"<text>\"] [--dry-run]"
      exit 0
      ;;
    *)
      echo "✖ Okänd flagga: $1" >&2
      exit 1
      ;;
  esac
done

echo "=== Produktionsdeploy: $REPO ==="
echo ""

echo "1/7 Kontrollerar att arbetskatalogen är ren..."
dgl_require_clean_tree

echo "2/7 Kontrollerar branch..."
dgl_require_branch "main"
echo "  Branch: main"

echo "3/7 Hämtar senaste origin/main..."
git fetch origin main --quiet
LOCAL_SHA="$(dgl_local_sha main)"
REMOTE_SHA="$(dgl_remote_sha main)"
dgl_require_sha_match "$LOCAL_SHA" "$REMOTE_SHA"
TARGET_SHA="$LOCAL_SHA"
echo "  SHA: $TARGET_SHA"

echo "4/7 Kontrollerar målrepo..."
dgl_require_gh_auth
dgl_require_repo "$REPO"
echo "  Repo: $REPO"

echo "5/7 Kontrollerar staging-verifiering..."
if [ -z "$STAGING_VERIFIED_SHA" ]; then
  echo "✖ --staging-verified-sha saknas. Ange den SHA du personligen verifierade som god på staging." >&2
  echo "  Om nuvarande main-SHA ($TARGET_SHA) är den du verifierade: --staging-verified-sha $TARGET_SHA" >&2
  exit 1
fi
if [ "$STAGING_VERIFIED_SHA" = "$TARGET_SHA" ]; then
  echo "  ✓ staging-verified-sha matchar main-SHA:n"
elif [ -n "$OVERRIDE_REASON" ]; then
  echo "  ⚠ staging-verified-sha ($STAGING_VERIFIED_SHA) skiljer sig från main-SHA:n ($TARGET_SHA)."
  echo "    Dokumenterat undantag: $OVERRIDE_REASON"
else
  echo "✖ staging-verified-sha ($STAGING_VERIFIED_SHA) matchar inte main-SHA:n ($TARGET_SHA), och ingen --override-reason gavs." >&2
  exit 1
fi

echo "6/7 Kontrollerar att en tidigare identisk dispatch inte redan pågår..."
COMMIT_LINE="$(git log -1 --format='%h %s' "$TARGET_SHA")"

echo ""
echo "Plan:"
echo "  SHA:              $TARGET_SHA"
echo "  Commit:           $COMMIT_LINE"
echo "  Staging-verified: $STAGING_VERIFIED_SHA"
if [ -n "$OVERRIDE_REASON" ]; then
  echo "  Override-skäl:    $OVERRIDE_REASON"
fi
echo "  Åtgärd:           gh workflow run $WORKFLOW -f sha=$TARGET_SHA -f dry_run=false"

if [ "$DRY_RUN" -eq 1 ]; then
  echo ""
  echo "DRY-RUN: inget dispatchat."
  exit 0
fi

SHORT_SHA="${TARGET_SHA:0:7}"
echo ""
echo "Detta dispatchar en RIKTIG produktionsdeploy av SHA $TARGET_SHA via GitHub Actions workflow_dispatch."
read -rp "Skriv \"DEPLOY $SHORT_SHA\" för att bekräfta: " CONFIRM
if [ "$CONFIRM" != "DEPLOY $SHORT_SHA" ]; then
  echo "✖ Bekräftelse matchade inte -- avbryter. Inget dispatchat." >&2
  exit 1
fi

DISPATCH_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo ""
echo "7/7 Dispatchar $WORKFLOW..."
gh workflow run "$WORKFLOW" --repo "$REPO" \
  -f sha="$TARGET_SHA" \
  -f staging_verified_sha="$STAGING_VERIFIED_SHA" \
  -f override_reason="$OVERRIDE_REASON" \
  -f dry_run=false

echo ""
echo "Letar reda på den nya körningen..."
RUN_ID=""
for _ in 1 2 3 4 5 6 7 8 9 10; do
  RUN_ID="$(gh run list --repo "$REPO" --workflow "$WORKFLOW" \
    --json databaseId,createdAt -L 5 \
    | node -e "
      let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{
        const runs = JSON.parse(d)
        const match = runs.find(r => r.createdAt >= process.argv[1])
        process.stdout.write(match ? String(match.databaseId) : '')
      })" "$DISPATCH_TIME")"
  if [ -n "$RUN_ID" ]; then
    break
  fi
  sleep 3
done

if [ -z "$RUN_ID" ]; then
  echo "✖ Kunde inte hitta den dispatchade körningen. Kontrollera manuellt: https://github.com/$REPO/actions/workflows/$WORKFLOW" >&2
  exit 1
fi

echo "  Körning: https://github.com/$REPO/actions/runs/$RUN_ID"
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
echo "✓ Deploy av $TARGET_SHA klar."
