#!/bin/bash
# PostToolUse Hook: Verifierar API route efter redigering
# Triggers: PostToolUse på Edit/Write av src/app/api/**/route.ts
# Grep:ar den redigerade filen efter vanliga misstag.

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

# Matcha bara API route-filer
if [[ "$FILE_PATH" != */src/app/api/*/route.ts ]] && \
   [[ "$FILE_PATH" != */src/app/api/*/*/route.ts ]] && \
   [[ "$FILE_PATH" != */src/app/api/*/*/*/route.ts ]]; then
  exit 0
fi

# Skippa test-helpers och test-routes
if [[ "$FILE_PATH" == */api/test/* ]] || [[ "$FILE_PATH" == */api/feature-flags/* ]] || [[ "$FILE_PATH" == */api/auth/* ]]; then
  exit 0
fi

WARNINGS=""

# Kolla om filen existerar (Write kan ha skapat den)
if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# 1. Auth-anrop saknas (skippa publika routes)
if ! grep -q 'auth(' "$FILE_PATH" && ! grep -q 'authFromMobileToken' "$FILE_PATH"; then
  # Kolla om det är en publik route (stables, feature-flags, providers/[id])
  if [[ "$FILE_PATH" != */api/stables/* ]] && \
     [[ "$FILE_PATH" != */api/providers/* ]] && \
     [[ "$FILE_PATH" != */api/cron/* ]]; then
    WARNINGS="${WARNINGS}VARNING: Saknar auth()-anrop i route\n"
  fi
fi

# 2. Auth null-check saknas
if grep -q 'auth(' "$FILE_PATH" && ! grep -q 'if (!session' "$FILE_PATH" && ! grep -q 'if(!session' "$FILE_PATH"; then
  WARNINGS="${WARNINGS}VARNING: auth() anropas men saknar null-check: if (!session) return 401\n"
fi

# 3. include: istället för select:
if grep -q 'include:' "$FILE_PATH" && ! grep -q '// include: OK' "$FILE_PATH"; then
  WARNINGS="${WARNINGS}VARNING: Använder include: -- byt till select: för att begränsa exponerade fält\n"
fi

# 4. console.log istället för logger
if grep -qE 'console\.(log|warn|error|info|debug)' "$FILE_PATH"; then
  WARNINGS="${WARNINGS}VARNING: Använder console.* -- byt till logger från @/lib/logger\n"
fi

# 5. Supabase-query utan .eq() ownership-filter (RLS OR-policy risk)
if grep -q '\.from(' "$FILE_PATH" && grep -q '\.select(' "$FILE_PATH"; then
  if ! grep -qE '\.eq\("(providerId|userId|customerId)"' "$FILE_PATH"; then
    # Skippa publika routes
    if [[ "$FILE_PATH" != */api/stables/* ]] && \
       [[ "$FILE_PATH" != */api/providers/* ]] && \
       [[ "$FILE_PATH" != */api/cron/* ]]; then
      WARNINGS="${WARNINGS}VARNING: Supabase-query saknar .eq() ownership-filter -- RLS-policies ar OR, explicit filter kravs\n"
    fi
  fi
fi

# 6. Prisma direkt pa karndomaner (ska anvanda repository)
if grep -qE 'prisma\.(booking|provider|service|customerReview|horse|follow|subscription)\.' "$FILE_PATH"; then
  if ! grep -q '\$transaction' "$FILE_PATH"; then
    WARNINGS="${WARNINGS}VARNING: Direkt Prisma-anrop pa karndomaner -- anvand repository pattern\n"
  fi
fi

if [ -n "$WARNINGS" ]; then
  echo ""
  echo "POST-EDIT VERIFIERING ($(basename $(dirname "$FILE_PATH"))/route.ts):"
  echo -e "$WARNINGS"
fi
