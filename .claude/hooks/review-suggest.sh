#!/bin/bash
# Hook: Föreslå subagenter baserat på diff vid review
# Triggers on git diff/log commands (Lead's review tools)

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

# Match git diff or git log with diff
if echo "$COMMAND" | grep -qE '^git (diff|log.*--stat)'; then
  # Get changed files from the diff command context
  BRANCH=$(git branch --show-current 2>/dev/null)
  if [ "$BRANCH" = "main" ]; then
    # On main, check last merge
    CHANGED=$(git diff --name-only HEAD~1..HEAD 2>/dev/null)
  else
    CHANGED=$(git diff --name-only main..HEAD 2>/dev/null)
  fi

  [ -z "$CHANGED" ] && exit 0

  SUGGEST=""

  # iOS Swift files
  SWIFT_COUNT=$(echo "$CHANGED" | grep -c '\.swift$' || true)
  if [ "$SWIFT_COUNT" -gt 0 ]; then
    SUGGEST="${SUGGEST}\n- ${SWIFT_COUNT} Swift-filer -> SwiftUI Pro + ios-expert"
  fi

  # API routes
  API_COUNT=$(echo "$CHANGED" | grep -c 'src/app/api/.*route\.ts$' || true)
  if [ "$API_COUNT" -gt 0 ]; then
    SUGGEST="${SUGGEST}\n- ${API_COUNT} API routes -> security-reviewer"
  fi

  # New API routes (native endpoints)
  NATIVE_COUNT=$(echo "$CHANGED" | grep -c 'api/native/' || true)
  if [ "$NATIVE_COUNT" -gt 0 ]; then
    SUGGEST="${SUGGEST}\n- ${NATIVE_COUNT} native API filer -> tech-architect"
  fi

  # UI components
  UI_COUNT=$(echo "$CHANGED" | grep -c 'src/components/.*\.tsx$' || true)
  PAGE_COUNT=$(echo "$CHANGED" | grep -c 'src/app/.*/page\.tsx$' || true)
  TOTAL_UI=$((UI_COUNT + PAGE_COUNT))
  if [ "$TOTAL_UI" -gt 0 ]; then
    SUGGEST="${SUGGEST}\n- ${TOTAL_UI} UI-filer -> cx-ux-reviewer"
  fi

  # Domain services
  DOMAIN_COUNT=$(echo "$CHANGED" | grep -c 'src/domain/' || true)
  if [ "$DOMAIN_COUNT" -gt 0 ]; then
    SUGGEST="${SUGGEST}\n- ${DOMAIN_COUNT} domain-filer -> tech-architect"
  fi

  # Prisma schema
  if echo "$CHANGED" | grep -q 'prisma/schema'; then
    SUGGEST="${SUGGEST}\n- Prisma schema andrad -> tech-architect + security-reviewer"
  fi

  # Architecture files
  if echo "$CHANGED" | grep -q 'middleware\|auth\.\|proxy\.ts'; then
    SUGGEST="${SUGGEST}\n- Auth/middleware andrad -> security-reviewer"
  fi

  if [ -n "$SUGGEST" ]; then
    echo "REVIEW-FORSLAG (baserat pa andrade filer):"
    echo -e "$SUGGEST"
    echo ""
    echo "Lead: kor relevanta subagenter vid review."
  fi
fi
