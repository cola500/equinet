#!/usr/bin/env bash
# Varna om en done-fil saknar docs-uppdatering för säkerhets-/feature-stories.
# Körs som pre-commit hook.

set -euo pipefail

# Bara kör om en done-fil är staged
STAGED_DONE_FILES=$(git diff --cached --name-only --diff-filter=A | grep "^docs/done/s[0-9]" || true)

if [ -z "$STAGED_DONE_FILES" ]; then
  exit 0
fi

EXIT_CODE=0

for DONE_FILE in $STAGED_DONE_FILES; do
  # Kontrollera om filen har "Docs uppdaterade"-sektion
  if ! grep -q "Docs uppdaterade\|Uppdaterade:\|Ingen docs-uppdatering" "$DONE_FILE"; then
    echo "⚠️  Varning: $DONE_FILE saknar 'Docs uppdaterade'-sektion."
    echo "   Lägg till under Reviews:"
    echo "   ## Docs uppdaterade"
    echo "   Uppdaterade: <lista> eller 'Ingen docs-uppdatering (motivation)'"
    echo ""
    EXIT_CODE=1
  fi

  # Varna extra hårt om säkerhets-nyckelord finns men inga security-docs uppdaterade
  if grep -qi "MFA\|auth\|säkerhet\|security\|authentication\|GDPR\|RLS\|encryption\|XSS\|CSRF\|sanitize" "$DONE_FILE"; then
    STAGED_SECURITY_DOCS=$(git diff --cached --name-only | grep -E "^(docs/security/|NFR\.md|docs/operations/incident-runbook\.md)" || true)
    if [ -z "$STAGED_SECURITY_DOCS" ]; then
      echo "⚠️  Varning: $DONE_FILE nämner säkerhet men ingen security-doc är uppdaterad."
      echo "   Överväg att uppdatera: NFR.md, docs/security/*, docs/operations/incident-runbook.md"
      echo ""
      # Inte blockera -- agenten kan ha medvetet skippat
    fi
  fi

  # Varna om feature-nyckelord finns men ingen hjälpartikel eller testing-guide uppdaterad
  # Hjälpartiklar/testing-guide ska följa när användarvänd funktionalitet ändras.
  if grep -qi "\bfeature\b\|\bUI\b\|komponent\|sida\|wizard\|flöde\|user experience\|användarupplevelse\|native vy" "$DONE_FILE"; then
    STAGED_CONTENT_DOCS=$(git diff --cached --name-only | grep -E "^(src/lib/help/articles/|docs/testing/testing-guide\.md|docs/guides/feature-docs\.md)" || true)
    if [ -z "$STAGED_CONTENT_DOCS" ]; then
      echo "ℹ️  Not: $DONE_FILE nämner feature/UI men ingen hjälpartikel eller testing-guide är uppdaterad."
      echo "   Om ändringen påverkar vad användaren ser eller gör -- uppdatera:"
      echo "   - src/lib/help/articles/<roll>/<slug>.md (hjälpcentral)"
      echo "   - docs/testing/testing-guide.md (admin-sidans testguide)"
      echo "   - docs/guides/feature-docs.md (projekt-docs)"
      echo ""
      # Inte blockera -- agenten kan ha bedömt att det var intern ändring
    fi
  fi
done

if [ $EXIT_CODE -ne 0 ]; then
  echo "Done-filer saknar docs-uppdateringssektion."
  echo "Lägg till sektionen eller skriv 'Ingen docs-uppdatering (motivation)'."
  echo ""
  echo "Bypass: git commit --no-verify (gör inte detta utan bra skäl)"
fi

exit $EXIT_CODE
