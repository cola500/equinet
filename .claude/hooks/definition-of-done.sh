#!/bin/bash
# Hook: Definition of Done vid Commit
# Triggers when running git commit

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

# Match git commit (but not git commit --amend or other git commands)
if echo "$COMMAND" | grep -qE '^git commit'; then
  cat <<'EOF'
DEFINITION OF DONE:
- [ ] npm run typecheck -- inga TypeScript-fel?
- [ ] npm run test:run -- alla tester grona?
- [ ] npm run lint -- inga lint-fel?
- [ ] Tester skrivna FORST (TDD)?
- [ ] Sakerhet: Zod-validering, error handling?
- [ ] Feature branch (inte main)?
EOF
fi
