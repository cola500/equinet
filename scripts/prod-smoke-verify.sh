#!/usr/bin/env bash
#
# prod-smoke-verify.sh — kör prod-smoke-workflowet och sammanfatta resultatet.
#
# 1. Triggar .github/workflows/prod-smoke.yml (workflow_dispatch).
# 2. Väntar på körningen och visar slutstatus per jobb (3/3-kontrollerna).
# 3. Negativ kontroll: request mot prod UTAN bypass-headern ska fortfarande
#    mötas av challenge/non-200 (bevisar att bypassen är smal).
#
# Exponerar inga secrets. Read-only mot prod (utöver själva workflow-triggern).
#
# Användning:
#   bash scripts/prod-smoke-verify.sh
#   URL=https://equinet.johanlindengard.com bash scripts/prod-smoke-verify.sh
#
set -euo pipefail

command -v gh >/dev/null || { echo "FEL: gh (GitHub CLI) krävs." >&2; exit 1; }
WF="prod-smoke.yml"
PROD_URL="${URL:-https://equinet.johanlindengard.com}"

echo "==> Triggar workflow $WF ..."
if [[ -n "${URL:-}" ]]; then gh workflow run "$WF" -f url="$URL"; else gh workflow run "$WF"; fi

echo "==> Väntar på att körningen startar ..."
sleep 8
RUN_ID=$(gh run list --workflow="$WF" --limit 1 --json databaseId --jq '.[0].databaseId')
[[ -n "$RUN_ID" ]] || { echo "FEL: hittade ingen körning." >&2; exit 1; }
echo "    run-id: $RUN_ID"

set +e
gh run watch "$RUN_ID" --exit-status
WATCH_RC=$?
set -e

echo
echo "==> Resultat:"
gh run view "$RUN_ID" --json status,conclusion,jobs \
  --jq '.conclusion as $c | "  slutstatus: \($c)\n" + ([.jobs[].steps[] | select(.name|test("smoke|Playwright|prod-smoke";"i")) | "  - \(.name): \(.conclusion)"] | join("\n"))' \
  2>/dev/null || gh run view "$RUN_ID" --json status,conclusion --jq '"  slutstatus: \(.conclusion)"'

echo
echo "==> Negativ kontroll (utan bypass-header — ska INTE vara 200):"
NEG=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/api/feature-flags" || echo "000")
echo "    /api/feature-flags utan header -> HTTP $NEG  $([[ "$NEG" == "200" ]] && echo '(VARNING: borde utmanats)' || echo '(OK: challenge/non-200)')"

exit "$WATCH_RC"
