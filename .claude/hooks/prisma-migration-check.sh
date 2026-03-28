#!/bin/bash
# Hook: Prisma Migration Reminder
# Triggers when editing prisma/schema.prisma

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('file_path',''))" 2>/dev/null)

if [[ "$FILE_PATH" == */prisma/schema.prisma ]]; then
  cat <<'EOF'
PRISMA SCHEMA ANDRAD:
- [ ] npx prisma migrate dev --name <namn>
- [ ] ALDRIG db push
- [ ] Uppdatera ALLA select-block for nya falt
- [ ] Deploy-ordning: commit -> push -> migration -> deploy
- [ ] Kolla ALLA repositories for nya falt i select
EOF
fi
