#!/usr/bin/env bash
#
# check-no-secrets.sh
#
# Scans STAGED file content for known secret patterns before commit.
# Exits non-zero if a likely secret is found.
#
# Patterns chosen to be high-signal / low-noise:
#   - Provider-specific prefixes (sk-ant-, sk-proj-, sk_live_, whsec_, AIza..., AKIA..., ghp_/gho_/ghs_/ghu_, xox[b-s]-)
#   - Private keys (BEGIN ... PRIVATE KEY)
#   - JWT tokens carrying role: service_role
#   - DB connection strings with embedded credentials, except local dev
#
# Files known to be safe by design are skipped:
#   - .env.example, *.example, *.template, *.sample
#   - prisma/seed-guard.test.ts (contains pattern-shaped strings for tests)
#   - this script itself + the pre-commit hook
#   - docs and retro files reference patterns by name
#
# Override an unavoidable match by adding the literal string "secret-scan:allow"
# on the same line in the diff. Use sparingly.

set -uo pipefail

STAGED=$(git diff --cached --name-only --diff-filter=AM)
if [ -z "$STAGED" ]; then
  exit 0
fi

# Skip files where pattern-shaped strings are expected.
SKIP_REGEX='(^|/)(\.env\.example|.+\.example|.+\.template|.+\.sample)$|(^|/)scripts/check-no-secrets\.(sh|test\.ts)$|(^|/)\.husky/pre-commit$|(^|/)prisma/seed-guard\.test\.ts$|(^|/)docs/.+\.md$|(^|/)\.claude/.+\.md$'

FILES=()
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if echo "$f" | grep -qE "$SKIP_REGEX"; then
    continue
  fi
  FILES+=("$f")
done <<< "$STAGED"

if [ ${#FILES[@]} -eq 0 ]; then
  exit 0
fi

# Patterns. Each line: <label>::<extended-regex>
PATTERNS=(
  'Anthropic API key::sk-ant-[A-Za-z0-9_-]{20,}'
  'OpenAI project key::sk-proj-[A-Za-z0-9_-]{20,}'
  'OpenAI legacy key::sk-[A-Za-z0-9]{40,}'
  'Google API key::AIza[0-9A-Za-z_-]{35}'
  'AWS access key::AKIA[0-9A-Z]{16}'
  'GitHub token::gh[pousr]_[A-Za-z0-9]{36,}'
  'GitHub fine-grained PAT::github_pat_[A-Za-z0-9_]{80,}'
  'Slack token::xox[baprs]-[A-Za-z0-9-]{10,}'
  'Stripe live secret::sk_live_[A-Za-z0-9]{20,}'
  'Stripe restricted::rk_live_[A-Za-z0-9]{20,}'
  'Stripe webhook secret::whsec_[A-Za-z0-9]{20,}'
  'Stripe test secret::sk_test_[A-Za-z0-9]{20,}'
  'RSA private key::BEGIN RSA PRIVATE KEY'
  'OpenSSH private key::BEGIN OPENSSH PRIVATE KEY'
  'PEM private key::BEGIN PRIVATE KEY'
  'EC private key::BEGIN EC PRIVATE KEY'
  'PGP private key::BEGIN PGP PRIVATE KEY'
)

HITS=0

scan_file() {
  local file="$1"
  local diff
  diff=$(git diff --cached --no-color -U0 -- "$file")
  [ -z "$diff" ] && return 0

  # Only look at added lines (start with + but not the +++ header).
  local added
  added=$(echo "$diff" | grep -E '^\+[^+]' || true)
  [ -z "$added" ] && return 0

  for entry in "${PATTERNS[@]}"; do
    local label="${entry%%::*}"
    local regex="${entry#*::}"
    local matches
    matches=$(echo "$added" | grep -E "$regex" || true)
    # Drop lines explicitly allowlisted.
    matches=$(echo "$matches" | grep -v 'secret-scan:allow' || true)
    if [ -n "$matches" ]; then
      echo ""
      echo "  [$label] in $file"
      echo "$matches" | sed 's/^/    /'
      HITS=$((HITS + 1))
    fi
  done

  # Service_role JWTs: decode payload and check role claim.
  # Only flags tokens whose payload literally contains "role":"service_role".
  local jwt_matches
  jwt_matches=$(echo "$added" | grep -oE 'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}' || true)
  if [ -n "$jwt_matches" ]; then
    while IFS= read -r token; do
      [ -z "$token" ] && continue
      local payload
      payload=$(echo "$token" | cut -d. -f2)
      # base64url -> base64 + padding
      local pad=$(( 4 - ${#payload} % 4 ))
      [ $pad -eq 4 ] && pad=0
      local padded="$payload"
      for _ in $(seq 1 $pad); do padded="${padded}="; done
      local decoded
      decoded=$(echo "$padded" | tr '_-' '/+' | base64 -d 2>/dev/null || true)
      if echo "$decoded" | grep -q '"role":"service_role"'; then
        echo ""
        echo "  [Supabase service_role JWT] in $file"
        echo "    $token" | cut -c 1-120
        HITS=$((HITS + 1))
      fi
    done <<< "$jwt_matches"
  fi

  # DB connection strings with embedded credentials.
  # Allow local dev (localhost / 127.0.0.1 with postgres:postgres).
  local db_matches
  db_matches=$(echo "$added" | grep -oE '(postgres(ql)?|mysql|mongodb(\+srv)?|redis)://[^:[:space:]"]+:[^@[:space:]"]+@[^/[:space:]"]+' || true)
  if [ -n "$db_matches" ]; then
    while IFS= read -r url; do
      [ -z "$url" ] && continue
      if echo "$url" | grep -qE '@(localhost|127\.0\.0\.1)([:/]|$)'; then
        continue
      fi
      if echo "$url" | grep -qE 'postgres:postgres@(localhost|127\.0\.0\.1)'; then
        continue
      fi
      echo ""
      echo "  [DB connection string with credentials] in $file"
      echo "    $url"
      HITS=$((HITS + 1))
    done <<< "$db_matches"
  fi
}

for f in "${FILES[@]}"; do
  scan_file "$f"
done

if [ "$HITS" -gt 0 ]; then
  echo ""
  echo "=========================================="
  echo "  $HITS likely secret(s) found in staged content."
  echo "=========================================="
  echo "  Move the value to .env (gitignored) or"
  echo "  add 'secret-scan:allow' on the line if it is a false positive."
  echo "=========================================="
  exit 1
fi

exit 0
