#!/usr/bin/env bash
# Varna om en done-fil saknar docs-uppdatering för säkerhets-/feature-stories.
# Körs som pre-commit hook.

set -euo pipefail

# Kontrollera plan-filer: måste ha ## Aktualitet verifierad
STAGED_PLAN_FILES=$(git diff --cached --name-only --diff-filter=A | grep "^docs/plans/s[0-9]" | grep -v "TEMPLATE.md" || true)

if [ -n "$STAGED_PLAN_FILES" ]; then
  for PLAN_FILE in $STAGED_PLAN_FILES; do
    if ! grep -q "## Aktualitet verifierad" "$PLAN_FILE"; then
      echo "❌  Fel: $PLAN_FILE saknar '## Aktualitet verifierad'-sektion."
      echo "   Lägg till sektionen FÖRST i planen (se docs/plans/TEMPLATE.md):"
      echo ""
      echo "   ## Aktualitet verifierad"
      echo "   **Kommandon körda:** ..."
      echo "   **Resultat:** ..."
      echo "   **Beslut:** Fortsätt / Redan löst"
      echo ""
      echo "   Obligatorisk för backlog-stories. Skriv 'N/A (nyskriven sprint-story)' om ej tillämplig."
      echo ""
      exit 1
    fi
  done
fi

# Tech lead-på-feature-branch-varning
# Mönstret: tech lead (Johan) committar på feature/s\d+-branch OCH committen rör
# BARA lifecycle-docs som tech lead normalt hanterar → Varna (ej blockera).
BRANCH=$(git rev-parse --abbrev-ref HEAD)
AUTHOR_EMAIL=$(git config user.email)

LIFECYCLE_PATTERN="^docs/sprints/(status\.md|sprint-.*\.md)|^docs/ideas/|^docs/retrospectives/|^docs/architecture/patterns\.md"

if [[ "$BRANCH" =~ ^feature/s[0-9] ]] && [[ "$AUTHOR_EMAIL" == "johan@jaernfoten.se" ]]; then
  STAGED_FILES=$(git diff --cached --name-only)
  TECH_LEAD_PATHS=$(echo "$STAGED_FILES" | grep -E "$LIFECYCLE_PATTERN" || true)
  NON_TECH_LEAD=$(echo "$STAGED_FILES" | grep -v -E "$LIFECYCLE_PATTERN" || true)

  if [ -n "$TECH_LEAD_PATHS" ] && [ -z "$NON_TECH_LEAD" ]; then
    echo "⚠️  Tech lead-varning: du committar på feature branch '$BRANCH' men"
    echo "   ändringarna rör bara lifecycle-docs (sprint/status/ideas/retros)."
    echo "   Det här är dev:s branch -- använd worktree från main istället:"
    echo ""
    echo "     git worktree add ../equinet-techlead main"
    echo "     cd ../equinet-techlead"
    echo ""
    echo "   Om detta är avsiktligt: fortsätt (varningen blockerar inte)."
    echo ""
  fi
fi

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
