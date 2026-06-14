#!/usr/bin/env bash
#
# prod-smoke-secrets.sh — sätt GitHub Secrets för prod-smoke-workflowet.
#
# Sätter:
#   PROD_SMOKE_BYPASS_SECRET        (från env PROD_SMOKE_BYPASS_SECRET)
#   PROD_SMOKE_PROVIDER_EMAIL/_PASSWORD   (interaktiv inmatning)
#   PROD_SMOKE_CUSTOMER_EMAIL/_PASSWORD   (interaktiv inmatning)
#
# Skriver ALDRIG ut lösenord eller bypass-secret. Värden skickas till
# `gh secret set` via stdin (syns inte i `ps`).
#
# Bypass-secret delas med WAF-scriptet via env-variabeln PROD_SMOKE_BYPASS_SECRET
# i SAMMA shell-session (ingen secret på disk). Generera och exportera en gång:
#
#   export PROD_SMOKE_BYPASS_SECRET=$(openssl rand -hex 32)
#   bash scripts/prod-smoke-secrets.sh
#   APPLY=1 bash scripts/prod-smoke-waf.sh
#   unset PROD_SMOKE_BYPASS_SECRET
#
set -euo pipefail

command -v gh >/dev/null || { echo "FEL: gh (GitHub CLI) krävs." >&2; exit 1; }

if [[ -z "${PROD_SMOKE_BYPASS_SECRET:-}" ]]; then
  echo "FEL: PROD_SMOKE_BYPASS_SECRET är inte satt i env." >&2
  echo "     Exportera samma värde som WAF-scriptet ska använda, t.ex.:" >&2
  echo "       export PROD_SMOKE_BYPASS_SECRET=\$(openssl rand -hex 32)" >&2
  exit 1
fi

set_secret() {  # set_secret NAME <value-on-stdin>
  gh secret set "$1"
}

echo "==> Sätter PROD_SMOKE_BYPASS_SECRET"
printf '%s' "$PROD_SMOKE_BYPASS_SECRET" | set_secret PROD_SMOKE_BYPASS_SECRET

echo "==> Provider-konto (prod test)"
read -r  -p "  Provider e-post: " P_EMAIL
read -rs -p "  Provider lösenord: " P_PASS; echo
echo "==> Kund-konto (prod test)"
read -r  -p "  Kund e-post: " C_EMAIL
read -rs -p "  Kund lösenord: " C_PASS; echo

printf '%s' "$P_EMAIL" | set_secret PROD_SMOKE_PROVIDER_EMAIL
printf '%s' "$P_PASS"  | set_secret PROD_SMOKE_PROVIDER_PASSWORD
printf '%s' "$C_EMAIL" | set_secret PROD_SMOKE_CUSTOMER_EMAIL
printf '%s' "$C_PASS"  | set_secret PROD_SMOKE_CUSTOMER_PASSWORD
unset P_PASS C_PASS

echo
echo "==> Verifierar att secrets finns (endast namn):"
gh secret list | grep -E '^PROD_SMOKE_' || { echo "VARNING: inga PROD_SMOKE_-secrets hittade." >&2; exit 1; }
echo "Klart. (Inga värden har skrivits ut.)"
