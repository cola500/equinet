#!/usr/bin/env bash
# Varnar när en story är in_progress i status.md men plan-filen saknas eller ej committad.
# Körs som del av pre-commit hook. Blockerar inte (exit 0 alltid).

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
  # Bara lifecycle-docs (done-filer, retros, session-filer) — hoppa över
  exit 0
fi

# Hitta story-IDs med status 'in_progress' i status.md
# Matchar rader som: | S45-0 | ... | in_progress | ...
ACTIVE_STORIES=$(grep -E "^\| S[0-9]+-[0-9]+" "$STATUS_FILE" | grep "in_progress" | awk -F'|' '{print $2}' | grep -oE "S[0-9]+-[0-9]+" | sort -u || true)

if [[ -z "$ACTIVE_STORIES" ]]; then
  exit 0
fi

WARNINGS=0

for STORY in $ACTIVE_STORIES; do
  # Normalisera till lowercase för filnamn (S45-0 -> s45-0)
  STORY_LOWER=$(echo "$STORY" | tr '[:upper:]' '[:lower:]')
  PLAN_FILE="docs/plans/${STORY_LOWER}-plan.md"

  if [[ ! -f "$PLAN_FILE" ]]; then
    echo "[VARNING] Plan-commit-varning: $STORY är 'in_progress' men $PLAN_FILE saknas."
    echo "   Per team-workflow.md Station 1: committa planen FÖRE implementation."
    WARNINGS=$((WARNINGS + 1))
  elif ! git ls-files --error-unmatch "$PLAN_FILE" > /dev/null 2>&1; then
    echo "[VARNING] Plan-commit-varning: $STORY är 'in_progress' men $PLAN_FILE är inte committad."
    echo "   Kör: git add $PLAN_FILE && git commit -m 'docs: $STORY plan'"
    WARNINGS=$((WARNINGS + 1))
  fi
done

if [[ "$WARNINGS" -gt 0 ]]; then
  echo ""
  echo "   (Varning är informativ — blockar inte commiten)"
fi

exit 0
