#!/usr/bin/env bash
# Varnar om du försöker merga din egen PR.
# Användning: bash scripts/check-own-pr-merge.sh <PR-nummer>
# Anropa INNAN gh pr merge.

PR_NUMBER="${1:-}"

if [[ -z "$PR_NUMBER" ]]; then
  echo "Användning: bash scripts/check-own-pr-merge.sh <PR-nummer>"
  exit 1
fi

# Validera att PR-nummer är ett heltal (förhindrar shell injection)
if [[ ! "$PR_NUMBER" =~ ^[0-9]+$ ]]; then
  echo "Fel: PR-nummer måste vara ett heltal."
  exit 1
fi

# Kräver gh CLI
if ! command -v gh &> /dev/null; then
  echo "[INFO] gh CLI saknas — kan inte kontrollera PR-author. Fortsätt manuellt."
  exit 0
fi

PR_AUTHOR=$(gh pr view "$PR_NUMBER" --json author --jq '.author.login' 2>/dev/null || echo "")
CURRENT_USER=$(gh api user --jq '.login' 2>/dev/null || echo "")

if [[ -z "$PR_AUTHOR" || -z "$CURRENT_USER" ]]; then
  echo "[INFO] Kunde inte hämta PR-author eller inloggad användare. Kontrollera manuellt."
  exit 0
fi

if [[ "$PR_AUTHOR" == "$CURRENT_USER" ]]; then
  # Kolla om PR rör bara .claude/rules/* (undantag — jq finns via gh)
  NON_RULES=$(gh pr view "$PR_NUMBER" --json files \
    --jq '[.files[].path | select(startswith(".claude/rules/") | not)] | length' \
    2>/dev/null || echo "1")

  if [[ "$NON_RULES" -eq 0 ]]; then
    echo "[INFO] PR #$PR_NUMBER rör bara .claude/rules/* — undantaget gäller. Self-merge OK efter self-review."
    exit 0
  fi

  echo "[VARNING] Tech-lead-merge: du ($CURRENT_USER) försöker merga din egen PR #$PR_NUMBER."
  echo "   Per team-workflow.md Station 7: Dev mergar inte egen PR."
  echo "   Trigga tech lead: säg 'kör review' till en annan Claude-session."
  echo ""

  # Icke-interaktivt läge (CI, pipe): avsluta utan att blocka
  if [[ ! -t 0 ]]; then
    echo "   (Icke-interaktivt läge — fortsätter automatiskt)"
    exit 0
  fi

  read -rp "   Fortsätt ändå? (y/N) " REPLY
  echo ""
  if [[ "$REPLY" =~ ^[Yy]$ ]]; then
    echo "[INFO] Fortsätter merge på eget ansvar."
    exit 0
  else
    echo "[INFO] Merge avbruten. Trigga tech lead."
    exit 1
  fi
fi

echo "[OK] PR #$PR_NUMBER: author ($PR_AUTHOR) är inte du ($CURRENT_USER). Merge OK."
exit 0
