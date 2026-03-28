#!/bin/bash
# Hook: TDD Reminder
# Triggers when editing src/**/*.ts(x) files that are NOT test files

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

# Skip if not a src/ TypeScript file
[[ "$FILE_PATH" != */src/*.ts ]] && [[ "$FILE_PATH" != */src/*.tsx ]] && exit 0

# Skip test files, type files, index files, config files
[[ "$FILE_PATH" == *.test.* ]] && exit 0
[[ "$FILE_PATH" == *.spec.* ]] && exit 0
[[ "$FILE_PATH" == */types.ts ]] && exit 0
[[ "$FILE_PATH" == */types/*.ts ]] && exit 0
[[ "$FILE_PATH" == */index.ts ]] && exit 0

# Skip UI components (pages, layouts, components) - TDD applies to logic, not views
[[ "$FILE_PATH" == */page.tsx ]] && exit 0
[[ "$FILE_PATH" == */layout.tsx ]] && exit 0
[[ "$FILE_PATH" == */loading.tsx ]] && exit 0
[[ "$FILE_PATH" == */error.tsx ]] && exit 0
[[ "$FILE_PATH" == */not-found.tsx ]] && exit 0
[[ "$FILE_PATH" == */components/*.tsx ]] && exit 0
[[ "$FILE_PATH" == */providers/*.tsx ]] && exit 0

# Check if corresponding test file exists
TEST_FILE="${FILE_PATH%.ts}.test.ts"
TEST_FILE_TSX="${FILE_PATH%.tsx}.test.tsx"
TEST_FILE_ALT="${FILE_PATH%.ts}.test.tsx"

if [[ ! -f "$TEST_FILE" ]] && [[ ! -f "$TEST_FILE_TSX" ]] && [[ ! -f "$TEST_FILE_ALT" ]]; then
  # Derive relative path for display
  RELATIVE=$(echo "$FILE_PATH" | sed 's|.*/src/|src/|')
  EXPECTED_TEST=$(echo "$TEST_FILE" | sed 's|.*/src/|src/|')
  cat <<EOF
TDD REMINDER: Ingen testfil hittad for $RELATIVE.
Skriv test FORST (RED -> GREEN -> REFACTOR).
Forvantad testfil: $EXPECTED_TEST
EOF
fi
