#!/bin/bash
# Detects common Swedish words written without å, ä, ö.
# Catches the "mobile keyboard" problem where å->a, ä->a, ö->o.
#
# Usage: bash scripts/check-swedish.sh
# Exit code: 0 = clean, 1 = issues found

# Each pattern is a Swedish word stem that only makes sense WITH å/ä/ö.
# None of these are valid English words, so false positives are unlikely.
PATTERN='\b(hastar|tjanst|oppna|oppet|anvand|losenord|genomford|sammanstall|innehall|leverantor|arende|atgard|pagaende|tillganglig|losning|forfragan|foretag|oversikt|bedomning|forbereda|halsa|valkomm|nodvandig|mojlig|andr[ai]ng|forandr)\b'

RESULTS=$(grep -rn --include="*.ts" --include="*.tsx" -iE "$PATTERN" src/ 2>/dev/null)

if [ -n "$RESULTS" ]; then
  echo "Svenska tecken saknas (å, ä, ö) i följande filer:"
  echo ""
  echo "$RESULTS"
  echo ""
  echo "Fix: Ersätt med korrekta svenska tecken."
  echo "Tips: Vanliga byten: a->å/ä, o->ö"
  exit 1
fi

echo "Inga svenska tecken-problem hittade."
exit 0
