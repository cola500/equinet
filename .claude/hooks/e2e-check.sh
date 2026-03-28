#!/bin/bash
# Hook: E2E Test Checklist
# Triggers when editing e2e/**/*.spec.ts

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

if [[ "$FILE_PATH" == */e2e/*.spec.ts ]] || [[ "$FILE_PATH" == */e2e/**/*.spec.ts ]]; then
  cat <<'EOF'
E2E TEST CHECKLIST:
- [ ] Rate limit reset i beforeEach
- [ ] Cookie-consent dismissal i fixtures
- [ ] Strict selectors: { exact: true }
- [ ] ALDRIG networkidle med SWR-polling
- [ ] Feature flag env-var i playwright.config.ts?
- [ ] beforeAll-guard for feature flag via admin API
EOF
fi
