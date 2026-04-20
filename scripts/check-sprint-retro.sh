#!/usr/bin/env bash
# check-sprint-retro.sh
# Blockerar retro-commit direkt på main utan feature branch.
# Sprint-avslut ska granskas av tech lead innan merge (PR-flödet).
#
# Override: lägg [override: <motivering>] i commit-message subject-rad.

set -euo pipefail

# Guard: kör bara om vi är i ett git-repo
git rev-parse --git-dir > /dev/null 2>&1 || exit 0

# Kolla om någon retro-fil är staged
STAGED_RETRO=$(git diff --cached --name-only --diff-filter=d 2>/dev/null \
  | grep -E "^docs/retrospectives/.*sprint.*\.md$" || true)

if [[ -z "$STAGED_RETRO" ]]; then
  exit 0
fi

# Feature branch → OK (korrekt flöde)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

if [[ "$CURRENT_BRANCH" != "main" ]]; then
  exit 0
fi

# Kolla override i commit-message
GIT_DIR_PATH=$(git rev-parse --git-dir 2>/dev/null || echo ".git")
COMMIT_SUBJECT=""
if [[ -f "${GIT_DIR_PATH}/COMMIT_EDITMSG" ]]; then
  COMMIT_SUBJECT=$(head -1 "${GIT_DIR_PATH}/COMMIT_EDITMSG")
fi

# Kräver att motivering startar med bokstav/siffra (inte template-placeholder <...>)
if echo "$COMMIT_SUBJECT" | grep -qE '\[override:[[:space:]]*[a-zA-Z0-9åäöÅÄÖ]'; then
  OVERRIDE_TEXT=$(echo "$COMMIT_SUBJECT" | grep -oE '\[override:[^]]+\]' | head -1)
  echo "[OVERRIDE] Sprint-retro-gate kringgått: $OVERRIDE_TEXT"
  exit 0
fi

# BLOCKER
EXAMPLE_RETRO=$(echo "$STAGED_RETRO" | head -1)

echo ""
echo "[BLOCKER] Retro-commit direkt på main."
echo "  Staged: $EXAMPLE_RETRO"
echo "  Current branch: $CURRENT_BRANCH"
echo ""
echo "Sprint-avslut ska granskas av tech lead innan merge."
echo "Skapa feature branch: git checkout -b feature/s47-avslut"
echo "Eller: lägg [override: <motivering>] i commit-message."
echo ""
exit 1
