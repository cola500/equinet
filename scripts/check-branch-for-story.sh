#!/usr/bin/env bash
# check-branch-for-story.sh
# Blockerar commit på main när en story är in_progress och non-lifecycle-filer staged.
# Förhindrar direkta kod-commits på main medan en feature branch borde användas.
#
# Override: lägg [override: <motivering>] i commit-message subject-rad.

set -euo pipefail

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# Bara relevant om vi är på main
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  exit 0
fi

STATUS_FILE="docs/sprints/status.md"
if [[ ! -f "$STATUS_FILE" ]]; then
  exit 0
fi

# Kolla om det finns aktiva stories in_progress
# Kolumnfiltrering: $4 = statuskolumnen — undviker false positive om "in_progress" förekommer i story-titeln
ACTIVE_STORIES=$(awk -F'|' '/^\| S[0-9]+-[0-9]+/ && $4 ~ /[[:space:]]in_progress[[:space:]]/ {print $2}' "$STATUS_FILE" \
  | grep -oE "S[0-9]+-[0-9]+" | sort -u || true)

if [[ -z "$ACTIVE_STORIES" ]]; then
  exit 0
fi

# Kolla om staged filer innehåller non-lifecycle-docs
STAGED=$(git diff --cached --name-only --diff-filter=d 2>/dev/null || true)

if [[ -z "$STAGED" ]]; then
  exit 0
fi

# Lifecycle-docs-mönster (OK att committa direkt på main)
LIFECYCLE_PATTERN="^docs/(sprints|done|retrospectives|plans|metrics)/"

NON_LIFECYCLE=$(echo "$STAGED" | grep -vE "$LIFECYCLE_PATTERN" | grep -v "^$" || true)

if [[ -z "$NON_LIFECYCLE" ]]; then
  exit 0
fi

# Override via commit-message subject-rad
# OBS: Fungerar enbart med git commit -m "... [override: ...]"
# Interaktiv commit (utan -m) läser föregående commit-meddelande (COMMIT_EDITMSG skrivs före editorn öppnas).
GIT_DIR_PATH=$(git rev-parse --git-dir 2>/dev/null || echo ".git")
COMMIT_SUBJECT=""
if [[ -f "${GIT_DIR_PATH}/COMMIT_EDITMSG" ]]; then
  COMMIT_SUBJECT=$(head -1 "${GIT_DIR_PATH}/COMMIT_EDITMSG")
fi
# Kräver att motivering startar med bokstav/siffra (inte template-placeholder <...>)
if echo "$COMMIT_SUBJECT" | grep -qE '\[override:[[:space:]]*[a-zA-Z0-9åäöÅÄÖ]'; then
  OVERRIDE_TEXT=$(echo "$COMMIT_SUBJECT" | grep -oE '\[override:[^]]+\]' | head -1)
  echo "[OVERRIDE] Branch-check kringgått: $OVERRIDE_TEXT"
  exit 0
fi

# BLOCKER
ACTIVE_LIST=$(echo "$ACTIVE_STORIES" | tr '\n' ' ' | sed 's/[[:space:]]*$//')
EXAMPLE_NON_LIFECYCLE=$(echo "$NON_LIFECYCLE" | head -3)

echo ""
echo "[BLOCKER] Commit på main när story är in_progress."
echo "  Aktiva stories: $ACTIVE_LIST"
echo "  Current branch: $CURRENT_BRANCH"
echo "  Ändrade filer (ej lifecycle-docs):"
while IFS= read -r F; do
  [[ -z "$F" ]] && continue
  echo "    $F"
done <<< "$EXAMPLE_NON_LIFECYCLE"
echo ""
echo "Byt till feature branch: git checkout feature/<story-id>-<namn>"
echo "Eller: lägg [override: <motivering>] i commit-message."
echo ""
exit 1
