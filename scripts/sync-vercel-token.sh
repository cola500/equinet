#!/usr/bin/env bash
#
# sync-vercel-token.sh [--dry-run]
#
# Synkar VERCEL_TOKEN i GitHub Actions-secrets med den token som redan finns
# i din inloggade Vercel CLI-sessions auth.json -- ingen fristående
# Personal Access Token skapas (kontot tillåter det inte just nu, se
# docs/operations/vercel-token-sync-and-production-deploy.md).
#
# Säkerhet:
#   - Token lämnar ALDRIG filen förutom via en enda variabel i minnet.
#   - Skickas till `gh secret set` via stdin (pipe), aldrig som CLI-argument
#     (som syns i `ps`), aldrig till en temp-fil, aldrig till stdout/logg.
#   - set -x får ALDRIG aktiveras i denna fil -- det skulle skriva ut
#     kommandot (inklusive token) till terminalen. Lägg inte till det.
#   - Vid minsta fel avbryts scriptet direkt (set -euo pipefail) innan
#     någon skrivning sker.
#
# --dry-run: kör alla kontroller och skriver planen, men anropar aldrig
#            `gh secret set`. Används av testsviten (aldrig med en riktig
#            token i tester/fixtures).
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/deploy-guard-lib.sh
source "$DIR/lib/deploy-guard-lib.sh"

REPO="cola500/equinet"
SECRET_NAME="VERCEL_TOKEN"
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      echo "Användning: bash scripts/sync-vercel-token.sh [--dry-run]"
      exit 0
      ;;
    *)
      echo "✖ Okänd flagga: $arg" >&2
      exit 1
      ;;
  esac
done

echo "=== Synka VERCEL_TOKEN till $REPO ==="
echo ""

echo "1/5 Kontrollerar Vercel CLI-token..."
dgl_require_auth_json

echo "2/5 Kontrollerar Vercel-sessionen..."
dgl_require_vercel_whoami

echo "3/5 Kontrollerar GitHub-autentisering..."
dgl_require_gh_auth

echo "4/5 Kontrollerar målrepo..."
dgl_require_repo "$REPO"
echo "  Repo: $REPO"

echo "5/5 Läser token (visas aldrig)..."
TOKEN="$(dgl_read_vercel_token)"
echo "  OK (${#TOKEN} tecken, värdet skrivs aldrig ut)"

echo ""
if [ "$DRY_RUN" -eq 1 ]; then
  echo "DRY-RUN: skulle satt secreten \"$SECRET_NAME\" i $REPO nu. Inget skrivet."
  unset TOKEN
  exit 0
fi

echo "Skriver secreten..."
if ! printf '%s' "$TOKEN" | gh secret set "$SECRET_NAME" --repo "$REPO" --app actions; then
  unset TOKEN
  echo "✖ 'gh secret set' misslyckades. Secreten kan vara i ett okänt tillstånd -- kontrollera manuellt." >&2
  exit 1
fi
unset TOKEN

echo ""
echo "Bekräftar (endast metadata, aldrig värdet)..."
gh secret list --repo "$REPO" | grep "^$SECRET_NAME" || {
  echo "✖ Secreten syns inte i listan efter skrivning -- verifiera manuellt." >&2
  exit 1
}

echo ""
echo "✓ $SECRET_NAME uppdaterad i $REPO."
