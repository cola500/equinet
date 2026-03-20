#!/bin/bash
# PostToolUse Hook: Kontrollerar imports i klient-komponenter efter redigering
# Triggers: PostToolUse på Edit/Write av src/**/*.tsx
# Varnar för server-only imports och console.*-användning.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

# Matcha bara .tsx-filer i src/
if [[ "$FILE_PATH" != */src/*.tsx ]] && [[ "$FILE_PATH" != */src/**/*.tsx ]]; then
  exit 0
fi

# Skippa server-filer (route.ts hanteras av post-api-route-verify)
if [[ "$FILE_PATH" == */route.ts ]] || [[ "$FILE_PATH" == */layout.tsx ]] || [[ "$FILE_PATH" == */page.tsx ]]; then
  # page.tsx och layout.tsx kan vara Server Components -- skippa
  exit 0
fi

if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

WARNINGS=""

# 1. Server-only feature-flags import i klient-komponent
if grep -q 'use client' "$FILE_PATH" && grep -q 'from "@/lib/feature-flags"' "$FILE_PATH"; then
  WARNINGS="${WARNINGS}VARNING: feature-flags.ts är server-only (drar in Prisma). Använd useFeatureFlag() från FeatureFlagProvider istället\n"
fi

# 2. console.* i klient-komponent (ska använda clientLogger)
if grep -q 'use client' "$FILE_PATH" && grep -qE 'console\.(log|warn|error|info|debug)' "$FILE_PATH"; then
  # Ignorera kommenterade rader
  UNCOMMENTED=$(grep -E 'console\.(log|warn|error|info|debug)' "$FILE_PATH" | grep -v '^\s*//' | grep -v '^\s*\*')
  if [ -n "$UNCOMMENTED" ]; then
    WARNINGS="${WARNINGS}VARNING: Använder console.* i klient-komponent -- byt till clientLogger från @/lib/client-logger\n"
  fi
fi

if [ -n "$WARNINGS" ]; then
  echo ""
  echo "POST-EDIT VERIFIERING ($(basename "$FILE_PATH")):"
  echo -e "$WARNINGS"
fi
