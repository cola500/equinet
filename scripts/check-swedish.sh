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
# Exclude lines with slug: or href containing URL slugs (ASCII by design)
SRC_RESULTS=$(grep -rn --include="*.ts" --include="*.tsx" -iE "$PATTERN" src/ 2>/dev/null | grep -vE 'slug:|"slug":|\.slug ===|href.*help/|getArticle\(' )

# Markdown: blocking for active files, warning for legacy docs
# Active files: rules, sprints, root-level md
MD_ACTIVE=$(grep -rn --include="*.md" -iE "$PATTERN" .claude/rules/ docs/sprints/ AGENTS.md CLAUDE.md 2>/dev/null)
# Legacy docs: warning only (326+ issues in old files)
MD_LEGACY=$(grep -rn --include="*.md" -iE "$PATTERN" docs/ 2>/dev/null | grep -v "docs/sprints/")

EXIT_CODE=0

if [ -n "$MD_ACTIVE" ]; then
  echo "Svenska tecken saknas (å, ä, ö) i aktiva filer (BLOCKERANDE):"
  echo ""
  echo "$MD_ACTIVE"
  echo ""
  echo "Fix: Ersätt med korrekta svenska tecken (å, ä, ö)."
  EXIT_CODE=1
fi

if [ -n "$MD_LEGACY" ]; then
  echo "Varning: Svenska tecken saknas i legacy docs ($(echo "$MD_LEGACY" | wc -l | tr -d ' ') rader, ej blockerande)"
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
