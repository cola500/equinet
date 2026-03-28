#!/bin/bash
# Hook: Feature Flag Checklist
# Triggers when editing feature-flag-definitions.ts

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

if [[ "$FILE_PATH" == */feature-flag-definitions.ts ]]; then
  cat <<'EOF'
NY FEATURE FLAG CHECKLIST:
- [ ] Server-gate: isFeatureEnabled() i alla API routes (404)
- [ ] Klient-gate: useFeatureFlag() i UI
- [ ] Nav-gating i ProviderNav / BottomTabBar
- [ ] Unit test: "returns 404 when flag disabled"
- [ ] E2E test i feature-flag-toggle.spec.ts
- [ ] iOS: fetchFeatureFlags() i APIClient
EOF
fi
