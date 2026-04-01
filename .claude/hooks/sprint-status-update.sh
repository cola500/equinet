#!/bin/bash
# Hook: Paminnelse att uppdatera sprint-status vid commit
# Triggers when running git commit

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

# Match git commit
if echo "$COMMAND" | grep -qE '^git commit'; then
  # Check if status.md has been modified in this session
  if ! git diff --cached --name-only 2>/dev/null | grep -q "docs/sprints/status.md"; then
    cat <<'EOF'
SPRINT-STATUS PAMINNELSE:
Uppdatera docs/sprints/status.md med:
- [ ] Story-status (pending/in_progress/done)
- [ ] Din session i Sessioner-tabellen
- [ ] Branch och senaste commit-hash
Filen ar teamets kommunikationskanal -- tech lead laser den for review.
EOF
  fi
fi
