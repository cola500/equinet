#!/usr/bin/env bash
# Blockerar commit när alla stories i aktiv sprint är done men retro-fil saknas.
# Override: lägg till [override: <motivering>] i commit-meddelandet.
# Triggar vid ALLA commits (inkl. done-filer).

set -euo pipefail

STATUS_FILE="docs/sprints/status.md"

if [[ ! -f "$STATUS_FILE" ]]; then
  exit 0
fi

# Extrahera aktiv sprint-nummer från "**Sprint N:" på Aktiv sprint-raden
ACTIVE_SPRINT_NUM=$(grep -m1 "^\*\*Sprint [0-9]" "$STATUS_FILE" | grep -oE "[0-9]+" | head -1 || true)

if [[ -z "$ACTIVE_SPRINT_NUM" ]]; then
  exit 0
fi

# Räkna totalt antal stories + done-stories för aktiv sprint
TOTAL=$(grep -cE "^\| S${ACTIVE_SPRINT_NUM}-" "$STATUS_FILE" || true)
ALL_DONE=$(grep -E "^\| S${ACTIVE_SPRINT_NUM}-" "$STATUS_FILE" | grep -c "done" || true)

if [[ "$TOTAL" -eq 0 ]]; then
  exit 0
fi

if [[ "$ALL_DONE" -eq "$TOTAL" ]]; then
  if ! ls docs/retrospectives/*sprint-${ACTIVE_SPRINT_NUM}*.md > /dev/null 2>&1; then
    # Läs commit-meddelande för override
    COMMIT_MSG_FILE="$(git rev-parse --git-dir)/COMMIT_EDITMSG"
    COMMIT_SUBJECT=""
    if [[ -f "$COMMIT_MSG_FILE" ]]; then
      COMMIT_SUBJECT=$(head -1 "$COMMIT_MSG_FILE")
    fi

    if echo "$COMMIT_SUBJECT" | grep -qE '\[override:[[:space:]]*[a-zA-Z0-9åäöÅÄÖ]'; then
      OVERRIDE_TEXT=$(echo "$COMMIT_SUBJECT" | grep -oE '\[override:[^]]+\]' | head -1)
      echo "[OVERRIDE] Sprint-avslut-gate kringgått: $OVERRIDE_TEXT"
      exit 0
    fi

    echo "[BLOCKER] Sprint-avslut: Sprint $ACTIVE_SPRINT_NUM har alla stories done men retro-fil saknas."
    echo "   Saknar: docs/retrospectives/<datum>-sprint-${ACTIVE_SPRINT_NUM}.md"
    echo "   Per autonomous-sprint.md: kör sprint-avslut innan ny sprint startas."
    echo "   Eller lägg till [override: <motivering>] i commit-meddelandet."
    exit 1
  fi
fi

exit 0
