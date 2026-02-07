#!/bin/bash
# Detects common Swedish words written without å, ä, ö.
# Catches the "mobile keyboard" problem where å->a, ä->a, ö->o.
#
# Usage: bash scripts/check-swedish.sh
# Exit code: 0 = clean, 1 = issues found in source code (blocking)
# Markdown issues are warnings only (non-blocking).

# Each pattern is a Swedish word stem that only makes sense WITH å/ä/ö.
# None of these are valid English words, so false positives are unlikely.
PATTERN='\b(hastar|tjanst|oppna|oppet|anvand|losenord|genomford|sammanstall|innehall|leverantor|arende|atgard|pagaende|tillganglig|losning|forfragan|foretag|oversikt|bedomning|forbereda|halsa|valkomm|nodvandig|mojlig|andr[ai]ng|forandr)\b'

# Source code (blocking)
SRC_RESULTS=$(grep -rn --include="*.ts" --include="*.tsx" -iE "$PATTERN" src/ 2>/dev/null)

# Markdown (warning only)
MD_RESULTS=$(grep -rn --include="*.md" -iE "$PATTERN" docs/ *.md 2>/dev/null)

EXIT_CODE=0

if [ -n "$MD_RESULTS" ]; then
  echo "Varning: Svenska tecken saknas (å, ä, ö) i markdown-filer:"
  echo ""
  echo "$MD_RESULTS"
  echo ""
fi

if [ -n "$SRC_RESULTS" ]; then
  echo "Svenska tecken saknas (å, ä, ö) i källkod:"
  echo ""
  echo "$SRC_RESULTS"
  echo ""
  echo "Fix: Ersätt med korrekta svenska tecken."
  echo "Tips: Vanliga byten: a->å/ä, o->ö"
  EXIT_CODE=1
fi

if [ $EXIT_CODE -eq 0 ]; then
  echo "Inga svenska tecken-problem hittade."
fi

exit $EXIT_CODE
