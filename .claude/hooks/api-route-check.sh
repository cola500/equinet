#!/bin/bash
# Hook: API Route Edit Checklist
# Triggers when editing src/app/api/**/route.ts

# Read tool input from stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

# Match pattern: src/app/api/**/route.ts
if [[ "$FILE_PATH" == */src/app/api/*/route.ts ]] || [[ "$FILE_PATH" == */src/app/api/*/*/route.ts ]] || [[ "$FILE_PATH" == */src/app/api/*/*/*/route.ts ]]; then
  cat <<'EOF'
API ROUTE CHECKLIST:
- [ ] Auth null-check: if (!session) return 401
- [ ] Rate limiting FORE request.json()
- [ ] Zod .strict() pa alla scheman
- [ ] select: {} (ALDRIG include:)
- [ ] providerId/customerId fran session, ALDRIG fran body
- [ ] Felmeddelanden pa svenska
- [ ] try-catch runt request.json()
EOF
fi
