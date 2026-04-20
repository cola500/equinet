#!/usr/bin/env bash
# Blockerar commit när en story är in_progress men plan-filen saknas eller ej committad.
# Override: lägg till [override: <motivering>] i commit-meddelandet.
# Körs som del av pre-commit hook.

set -euo pipefail

STATUS_FILE="docs/sprints/status.md"

if [[ ! -f "$STATUS_FILE" ]]; then
  exit 0
fi

# Hoppa över om bara lifecycle-docs är staged (ingen kod eller scripts)
STAGED=$(git diff --cached --name-only --diff-filter=d 2>/dev/null || true)
HAS_CODE=$(echo "$STAGED" | grep -E '\.(ts|tsx|js|jsx|swift|sh|sql)$' || true)
HAS_SRC=$(echo "$STAGED" | grep -E '^(src|e2e|scripts|prisma|ios)/' || true)

if [[ -z "$HAS_CODE" && -z "$HAS_SRC" ]]; then
  exit 0
fi

# Hitta story-IDs med status 'in_progress' i status.md
ACTIVE_STORIES=$(awk -F'|' '/^\| S[0-9]+-[0-9]+/ && $4 ~ /[[:space:]]in_progress[[:space:]]/ {print $2}' "$STATUS_FILE" \
  | grep -oE "S[0-9]+-[0-9]+" | sort -u || true)

if [[ -z "$ACTIVE_STORIES" ]]; then
  exit 0
fi

# Läs commit-meddelande för override
COMMIT_MSG_FILE="${GIT_DIR:-.git}/COMMIT_EDITMSG"
COMMIT_SUBJECT=""
if [[ -f "$COMMIT_MSG_FILE" ]]; then
  COMMIT_SUBJECT=$(head -1 "$COMMIT_MSG_FILE")
fi

BLOCKERS=0

for STORY in $ACTIVE_STORIES; do
  STORY_LOWER=$(echo "$STORY" | tr '[:upper:]' '[:lower:]')
  PLAN_FILE="docs/plans/${STORY_LOWER}-plan.md"

  if [[ ! -f "$PLAN_FILE" ]]; then
    # Kolla override innan vi blockerar
    if echo "$COMMIT_SUBJECT" | grep -qE '\[override:[[:space:]]*[a-zA-Z0-9åäöÅÄÖ]'; then
      OVERRIDE_TEXT=$(echo "$COMMIT_SUBJECT" | grep -oE '\[override:[^]]+\]' | head -1)
      echo "[OVERRIDE] Plan-commit-gate kringgått ($STORY): $OVERRIDE_TEXT"
      continue
    fi
    echo "[BLOCKER] Plan-commit: $STORY är 'in_progress' men $PLAN_FILE saknas."
    echo "   Per team-workflow.md Station 1: committa planen FÖRE implementation."
    echo "   Eller lägg till [override: <motivering>] i commit-meddelandet."
    BLOCKERS=$((BLOCKERS + 1))
  elif ! git ls-files --error-unmatch "$PLAN_FILE" > /dev/null 2>&1; then
    if echo "$COMMIT_SUBJECT" | grep -qE '\[override:[[:space:]]*[a-zA-Z0-9åäöÅÄÖ]'; then
      OVERRIDE_TEXT=$(echo "$COMMIT_SUBJECT" | grep -oE '\[override:[^]]+\]' | head -1)
      echo "[OVERRIDE] Plan-commit-gate kringgått ($STORY, plan ej committad): $OVERRIDE_TEXT"
      continue
    fi
    echo "[BLOCKER] Plan-commit: $STORY är 'in_progress' men $PLAN_FILE är inte committad."
    echo "   Kör: git add $PLAN_FILE && git commit -m 'docs: $STORY plan'"
    echo "   Eller lägg till [override: <motivering>] i commit-meddelandet."
    BLOCKERS=$((BLOCKERS + 1))
  fi
done

if [[ "$BLOCKERS" -gt 0 ]]; then
  exit 1
fi

exit 0
