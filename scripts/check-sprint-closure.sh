#!/usr/bin/env bash
# Varnar när alla stories i aktiv sprint är done men retro-fil saknas.
# Triggar vid ALLA commits (inkl. done-filer) eftersom det är vid commit av
# sista done-filen som varningen är som mest relevant.
# Blockerar inte (exit 0 alltid).

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
  # Alla stories klara — kolla om retro finns
  RETRO_GLOB="docs/retrospectives/*sprint-${ACTIVE_SPRINT_NUM}*.md"
  if ! ls $RETRO_GLOB > /dev/null 2>&1; then
    echo "[VARNING] Sprint-avslut: Sprint $ACTIVE_SPRINT_NUM har alla stories done men retro-fil saknas."
    echo "   Saknar: docs/retrospectives/<datum>-sprint-${ACTIVE_SPRINT_NUM}.md"
    echo "   Per autonomous-sprint.md: kör sprint-avslut innan ny sprint startas."
    echo ""
    echo "   (Varning är informativ — blockar inte commiten)"
  fi
fi

exit 0
