#!/usr/bin/env bash
# Blockerar push från feature branch om < 2 commits (inget stationsflöde synligt).
# Override: [override: <motivering>] i senaste commit-meddelande.
# Körs som del av pre-push hook.

set -euo pipefail

CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")

if [[ ! "$CURRENT_BRANCH" =~ ^feature/ ]]; then
  exit 0
fi

COMMITS_AHEAD=$(git rev-list --count main..HEAD 2>/dev/null || echo "0")

if [[ "$COMMITS_AHEAD" -ge 2 ]]; then
  exit 0
fi

# Kolla override i senaste commit-meddelande
LAST_COMMIT_MSG=$(git log -1 --pretty=%B HEAD 2>/dev/null || true)
if echo "$LAST_COMMIT_MSG" | grep -qE '\[override:[[:space:]]*[a-zA-Z0-9åäöÅÄÖ]'; then
  OVERRIDE_TEXT=$(echo "$LAST_COMMIT_MSG" | grep -oE '\[override:[^]]+\]' | head -1)
  echo "[OVERRIDE] Multi-commit-gate kringgått: $OVERRIDE_TEXT"
  exit 0
fi

echo "[BLOCKER] Multi-commit: $CURRENT_BRANCH har bara $COMMITS_AHEAD commit(s) över main."
echo "   Per team-workflow.md ska varje station committas separat (PLAN -> RED -> GREEN -> ...)."
echo "   Eller lägg till [override: <motivering>] i senaste commit-meddelandet."
exit 1
