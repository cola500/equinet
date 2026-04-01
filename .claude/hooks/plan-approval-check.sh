#!/bin/bash
# Hook: Blockera implementation innan plan är godkänd
# Triggers on git commit -- checks if only a plan exists on the branch

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

# Match git commit
if echo "$COMMAND" | grep -qE '^git commit'; then
  BRANCH=$(git branch --show-current 2>/dev/null)

  # Only check feature branches
  if echo "$BRANCH" | grep -qE '^feature/'; then
    # Count commits ahead of main
    COMMIT_COUNT=$(git rev-list --count main.."$BRANCH" 2>/dev/null || echo "0")

    # If only 1 commit (the plan), block
    if [ "$COMMIT_COUNT" = "1" ]; then
      FIRST_MSG=$(git log --oneline -1 "$BRANCH" 2>/dev/null)
      if echo "$FIRST_MSG" | grep -qiE "^[a-f0-9]+ (plan|docs:.*plan)"; then
        cat <<'EOF'
STOPP: Planen har inte godkänts ännu.

Du har bara en plan-commit på denna branch. Vänta tills Johan
säger "godkänd" innan du börjar implementera.

Gör INGENTING mer -- ingen research, ingen kod, inga API-anrop.
EOF
      fi
    fi
  fi
fi
