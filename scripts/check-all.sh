#!/bin/bash
# Kör alla quality gates sekventiellt med färgkodad output.
# Usage: npm run check:all

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
FAILED_CHECKS=""
TOTAL=4

print_result() {
  local name="$1"
  local exit_code="$2"
  local duration="$3"
  local extra="$4"

  if [ "$exit_code" -eq 0 ]; then
    echo -e "  ${GREEN}OK${NC}  ${BOLD}${name}${NC} (${duration}s)${extra:+ $extra}"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC}  ${BOLD}${name}${NC} (${duration}s)${extra:+ $extra}"
    FAIL=$((FAIL + 1))
    FAILED_CHECKS="${FAILED_CHECKS} ${name}"
  fi
}

echo ""
echo -e "${BOLD}Quality Gates${NC}"
echo "─────────────────────────────────────"

# 1. TypeScript
START=$(date +%s)
npm run typecheck --silent > /dev/null 2>&1 && TC_EXIT=0 || TC_EXIT=$?
END=$(date +%s)
print_result "typecheck" $TC_EXIT $((END - START)) ""

# 2. Tests
START=$(date +%s)
TEST_OUTPUT=$(npm run test:run --silent 2>&1) && TEST_EXIT=0 || TEST_EXIT=$?
END=$(date +%s)
TEST_COUNT=$(echo "$TEST_OUTPUT" | sed 's/\x1b\[[0-9;]*m//g' | grep 'Tests' | grep -oE '[0-9]+ passed' | head -1 || echo "")
print_result "test:run" $TEST_EXIT $((END - START)) "${TEST_COUNT:+($TEST_COUNT)}"

# 3. Lint
START=$(date +%s)
npm run lint --silent > /dev/null 2>&1 && LINT_EXIT=0 || LINT_EXIT=$?
END=$(date +%s)
print_result "lint" $LINT_EXIT $((END - START)) ""

# 4. Swedish characters
START=$(date +%s)
npm run check:swedish --silent > /dev/null 2>&1 && SW_EXIT=0 || SW_EXIT=$?
END=$(date +%s)
print_result "check:swedish" $SW_EXIT $((END - START)) ""

# Summary
echo "─────────────────────────────────────"
if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}${PASS}/${TOTAL} gröna${NC}"
else
  echo -e "  ${RED}${BOLD}${FAIL}/${TOTAL} FAIL:${FAILED_CHECKS}${NC}"
  exit 1
fi
echo ""
