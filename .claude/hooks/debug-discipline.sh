#!/bin/bash
# Hook: Påminn om 5 Whys och systematisk debugging
# Triggers on Bash commands that indicate trial-and-error debugging

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

# Match common debug patterns: re-running failed tests, quick retries
if echo "$COMMAND" | grep -qE '(npx vitest run|npm run test|xcodebuild test)'; then
  # Check if this is the same test being run again (retry pattern)
  LAST_CMD_FILE="/tmp/equinet-last-test-cmd"
  if [ -f "$LAST_CMD_FILE" ] && [ "$(cat "$LAST_CMD_FILE")" = "$COMMAND" ]; then
    cat <<'EOF'
STOPP -- Du kör samma test igen. Innan du försöker igen:

1. FÖRSTÅ felet: Läs felmeddelandet noggrant. Vad säger det?
2. 5 WHYS: Varför failar testet? Varför? Varför? (gräv till rotorsaken)
3. HYPOTES: Vad tror du är fel? Skriv ner det innan du ändrar något.
4. EN ÄNDRING: Gör en ändring som testar din hypotes. Inte fler.
5. VERIFIERA: Kör testet. Stämde hypotesen?

Om du fastnat efter 3 försök: fråga Johan eller beskriv problemet.
EOF
  fi
  echo "$COMMAND" > "$LAST_CMD_FILE"
fi
