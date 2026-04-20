#!/usr/bin/env bash
# check-reviews-done.sh
# Blockerar done-fil-commit om obligatoriska reviews saknas.
# Körs som del av pre-commit hook via .husky/pre-commit.
#
# Override: lägg [override: <motivering>] i commit-message.
# Trivial-gating: om done-filen har "- [ ] code-reviewer — ej tillämplig (trivial story:" skippas checken.

set -euo pipefail

# Bara kör om en done-fil är staged
STAGED_DONE_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep "^docs/done/s[0-9]" || true)

if [ -z "$STAGED_DONE_FILES" ]; then
  exit 0
fi

# Override via commit-message
# git commit -m "msg [override: anledning]" skriver COMMIT_EDITMSG före pre-commit körs
GIT_DIR_PATH=$(git rev-parse --git-dir 2>/dev/null || echo ".git")
COMMIT_MSG=""
if [[ -f "${GIT_DIR_PATH}/COMMIT_EDITMSG" ]]; then
  COMMIT_MSG=$(cat "${GIT_DIR_PATH}/COMMIT_EDITMSG")
fi
# Kräver att motivering startar med bokstav/siffra (inte template-placeholder <...>)
if echo "$COMMIT_MSG" | grep -qE '\[override:[[:space:]]*[a-zA-Z0-9åäöÅÄÖ]'; then
  OVERRIDE_TEXT=$(echo "$COMMIT_MSG" | grep -oE '\[override:[^]]+\]' | head -1)
  echo "[OVERRIDE] Review-gate kringgått: $OVERRIDE_TEXT"
  exit 0
fi

# Hämta alla filer som ändrats på denna branch (story-kontext)
BRANCH_FILES=$(git diff main..HEAD --name-only 2>/dev/null || true)
STAGED_ALL=$(git diff --cached --name-only 2>/dev/null || true)
# Union av branch-diff och staged
ALL_FILES=$(printf '%s\n%s\n' "$BRANCH_FILES" "$STAGED_ALL" | sort -u | grep -v "^$" || true)

# Exkludera lifecycle-docs (done, sprints, retrospectives, plans)
LIFECYCLE_PATTERN="^docs/(done|sprints|retrospectives|plans)/"
CODE_FILES=$(echo "$ALL_FILES" | grep -vE "$LIFECYCLE_PATTERN" || true)

EXIT_CODE=0

for DONE_FILE in $STAGED_DONE_FILES; do
  # Extrahera story-id (t.ex. s47-1-done.md -> S47-1)
  STORY_ID=$(basename "$DONE_FILE" | grep -oiE "s[0-9]+-[0-9]+" | head -1 | tr '[:lower:]' '[:upper:]')

  [[ -z "$STORY_ID" ]] && continue
  [[ ! -f "$DONE_FILE" ]] && continue

  # Trivial-gating: code-reviewer explicit markerad ej tillämplig (trivial story:)
  if grep -qiE "^\s*-\s*\[\s*\]\s*code-reviewer.*trivial story" "$DONE_FILE" 2>/dev/null; then
    continue
  fi

  # Docs-only: om inga filer utanför docs/ ändrades -> inga reviews krävs
  NON_DOCS_FILES=$(echo "$CODE_FILES" | grep -vE "^docs/" || true)

  if [ -z "$NON_DOCS_FILES" ]; then
    continue
  fi

  # Bygg required_set via union av matchade filmönster
  REQUIRED=""

  while IFS= read -r FILE; do
    [[ -z "$FILE" ]] && continue

    # api-route: src/app/api/**/route.ts
    if echo "$FILE" | grep -qE "^src/app/api/.*route\.ts$"; then
      REQUIRED="$REQUIRED code-reviewer security-reviewer"
    fi
    # api-integration-test
    if echo "$FILE" | grep -qE "^src/app/api/.*route\.integration\.test\.ts$"; then
      REQUIRED="$REQUIRED code-reviewer"
    fi
    # ui-component: src/components/**/*.tsx
    if echo "$FILE" | grep -qE "^src/components/.*\.tsx$"; then
      REQUIRED="$REQUIRED code-reviewer cx-ux-reviewer"
    fi
    # ios: ios/**/*.swift
    if echo "$FILE" | grep -qE "^ios/.*\.swift$"; then
      REQUIRED="$REQUIRED code-reviewer ios-expert"
    fi
    # schema-change
    if echo "$FILE" | grep -qE "^prisma/schema\.prisma$"; then
      REQUIRED="$REQUIRED tech-architect code-reviewer"
    fi
    # auth: src/lib/*auth*.ts
    if echo "$FILE" | grep -qE "^src/lib/[^/]*auth[^/]*\.ts$"; then
      REQUIRED="$REQUIRED security-reviewer code-reviewer"
    fi
    # middleware
    if echo "$FILE" | grep -qE "^middleware\.ts$"; then
      REQUIRED="$REQUIRED security-reviewer tech-architect code-reviewer"
    fi
    # default: alla src/e2e/scripts/prisma/ios-filer som inte matchat ovan
    if echo "$FILE" | grep -qE "^(src|e2e|scripts|prisma|ios)/"; then
      REQUIRED="$REQUIRED code-reviewer"
    fi
  done <<< "$NON_DOCS_FILES"

  # Deduplicera required_set
  REQUIRED_SET=$(echo "$REQUIRED" | tr ' ' '\n' | sort -u | grep -v "^$" | tr '\n' ' ' | sed 's/[[:space:]]*$//')

  [[ -z "$REQUIRED_SET" ]] && continue

  # Parsa done-filens "Reviews körda"-sektion (enbart den sektionen, inte hela filen)
  # Extraherar reviewer-namn (första token efter [x]) från rader i sektionen
  ACTUAL_SET=$(awk '/^## Reviews körda/{found=1; next} found && /^## /{found=0} found' "$DONE_FILE" 2>/dev/null \
    | grep -E "^\s*-\s*\[x\]\s+[a-z][a-z-]*" \
    | sed 's/.*\[x\][[:space:]]*//' | grep -oE "^[a-z][a-z-]*" \
    | sort -u | tr '\n' ' ' | sed 's/[[:space:]]*$//' || true)

  # Kontrollera att alla required finns i actual
  MISSING=""
  for REVIEWER in $REQUIRED_SET; do
    if ! echo " $ACTUAL_SET " | grep -q " $REVIEWER "; then
      MISSING="$MISSING $REVIEWER"
    fi
  done
  MISSING=$(echo "$MISSING" | sed 's/^[[:space:]]*//')

  if [ -n "$MISSING" ]; then
    # Visa exempel på utlösande filer (max 3)
    EXAMPLE_FILES=$(echo "$NON_DOCS_FILES" | grep -E "^src/app/api/.*route\.ts$|^src/components/.*\.tsx$|^ios/.*\.swift$|^prisma/schema\.prisma$|^middleware\.ts$|^src/lib/[^/]*auth[^/]*\.ts$" | head -3 || echo "$NON_DOCS_FILES" | head -3)

    echo ""
    echo "[BLOCKER] Reviews saknas i $(basename "$DONE_FILE"):"
    echo "  Story:   $STORY_ID"
    if [ -n "$EXAMPLE_FILES" ]; then
      while IFS= read -r EF; do
        [[ -z "$EF" ]] && continue
        echo "  Fil:     $EF"
      done <<< "$EXAMPLE_FILES"
    fi
    echo "  Krävs:   $(echo "$REQUIRED_SET" | tr ' ' ', ')"
    echo "  Hittat:  $([ -n "$ACTUAL_SET" ] && echo "$ACTUAL_SET" | tr ' ' ',' || echo 'ingen')"
    echo "  Saknar:  $(echo "$MISSING" | tr ' ' ', ')"
    echo ""
    echo "Kör saknade reviews innan commit av done-fil."
    echo "Eller: lägg [override: <motivering>] i commit-message."
    echo ""
    EXIT_CODE=1
  fi
done

exit $EXIT_CODE
