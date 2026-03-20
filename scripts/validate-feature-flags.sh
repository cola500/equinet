#!/bin/bash
# Validerar att varje feature flag har server-gate och klient-gate.
# Usage: npm run flags:validate

set -uo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

DEFINITIONS_FILE="src/lib/feature-flag-definitions.ts"

if [ ! -f "$DEFINITIONS_FILE" ]; then
  echo -e "${RED}Kunde inte hitta $DEFINITIONS_FILE${NC}"
  exit 1
fi

# Extrahera alla flaggnycklar från FEATURE_FLAGS-objektet
FLAGS=$(grep -oE 'key: "[a-z_]+"' "$DEFINITIONS_FILE" | sed 's/key: "//;s/"//')

TOTAL=0
MISSING_SERVER=0
MISSING_CLIENT=0
ISSUES=""

echo ""
echo -e "${BOLD}Feature Flag Gating Validator${NC}"
echo "─────────────────────────────────────────────────────────"
printf "  %-25s %-12s %-12s\n" "Flagga" "Server" "Klient"
echo "─────────────────────────────────────────────────────────"

for FLAG in $FLAGS; do
  TOTAL=$((TOTAL + 1))

  # Sök server-gate: isFeatureEnabled("flag")
  SERVER_HITS=$(grep -rl "isFeatureEnabled(\"$FLAG\")" src/app/api/ 2>/dev/null | wc -l | tr -d ' ')

  # Sök klient-gate: useFeatureFlag("flag")
  CLIENT_HITS=$(grep -rl "useFeatureFlag(\"$FLAG\")" src/ 2>/dev/null | wc -l | tr -d ' ')

  # Formatera status
  if [ "$SERVER_HITS" -gt 0 ]; then
    SERVER_STATUS="${GREEN}OK ($SERVER_HITS)${NC}"
  else
    SERVER_STATUS="${YELLOW}SAKNAS${NC}"
    MISSING_SERVER=$((MISSING_SERVER + 1))
    ISSUES="${ISSUES}  - ${FLAG}: saknar server-gate (isFeatureEnabled)\n"
  fi

  if [ "$CLIENT_HITS" -gt 0 ]; then
    CLIENT_STATUS="${GREEN}OK ($CLIENT_HITS)${NC}"
  else
    CLIENT_STATUS="${YELLOW}SAKNAS${NC}"
    MISSING_CLIENT=$((MISSING_CLIENT + 1))
    ISSUES="${ISSUES}  - ${FLAG}: saknar klient-gate (useFeatureFlag)\n"
  fi

  printf "  %-25s %-22b %-22b\n" "$FLAG" "$SERVER_STATUS" "$CLIENT_STATUS"
done

echo "─────────────────────────────────────────────────────────"
echo -e "  ${BOLD}Totalt${NC}: $TOTAL flaggor"

if [ -n "$ISSUES" ]; then
  echo ""
  echo -e "${YELLOW}Saknade gates:${NC}"
  echo -e "$ISSUES"
  echo -e "  ${YELLOW}OBS: Vissa flaggor kan medvetet sakna gate${NC}"
  echo -e "  ${YELLOW}(t.ex. offline_mode som bara gatas i SWRProvider)${NC}"
fi
echo ""
