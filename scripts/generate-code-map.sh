#!/usr/bin/env bash
# Generate .claude/rules/code-map.md from actual codebase structure
# Usage: npm run codemap
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/.claude/rules/code-map.md"

cat > "$OUT" << HEADER
# Kodkarta -- Domän till filer

> Genererad $(date +%Y-%m-%d). Använd denna för att snabbt hitta rätt filer vid implementation, review eller felsökning.

## Domäner

HEADER

echo "Scanning domains..."

for domain_dir in "$ROOT"/src/domain/*/; do
  [ -d "$domain_dir" ] || continue
  domain=$(basename "$domain_dir")

  repo_dir="$ROOT/src/infrastructure/persistence/$domain"
  has_repo=false
  [ -d "$repo_dir" ] && has_repo=true

  suffix=""
  $has_repo && suffix=" (kärndomän, repository obligatoriskt)"
  echo "### $domain$suffix" >> "$OUT"
  echo "" >> "$OUT"
  echo "| Lager | Filer |" >> "$OUT"
  echo "|-------|-------|" >> "$OUT"

  # Services (exclude tests, index, interfaces, mappers, factories)
  svc_list=""
  while IFS= read -r s; do
    [ -z "$s" ] && continue
    name=$(basename "$s")
    svc_list="$svc_list\`src/domain/$domain/$name\`, "
  done < <(find "$domain_dir" -maxdepth 1 -name "*.ts" ! -name "*.test.*" ! -name "*.spec.*" ! -name "index.*" ! -name "create*" ! -name "I*" ! -name "*Mapper*" 2>/dev/null | sort)
  if [ -n "$svc_list" ]; then
    echo "| Service | ${svc_list%, } |" >> "$OUT"
  fi

  # Repository (with full relative paths, deduped)
  if $has_repo; then
    repo_list=""
    while IFS= read -r r; do
      [ -z "$r" ] && continue
      rel=$(echo "$r" | sed "s|$ROOT/||")
      repo_list="$repo_list\`$rel\`, "
    done < <(find "$repo_dir" -maxdepth 1 -name "*.ts" ! -name "*.test.*" ! -name "index.*" 2>/dev/null | sort)
    if [ -n "$repo_list" ]; then
      echo "| Repository | ${repo_list%, } |" >> "$OUT"
    fi
  fi

  # API routes -- search multiple patterns, dedup with sort -u
  domain_kebab=$(echo "$domain" | sed 's/_/-/g')
  tmpfile=$(mktemp)

  for pattern in \
    "$ROOT/src/app/api/${domain}s" \
    "$ROOT/src/app/api/${domain}" \
    "$ROOT/src/app/api/${domain_kebab}s" \
    "$ROOT/src/app/api/${domain_kebab}" \
    "$ROOT/src/app/api/provider/${domain}" \
    "$ROOT/src/app/api/provider/${domain}s" \
    "$ROOT/src/app/api/provider/${domain_kebab}" \
    "$ROOT/src/app/api/provider/${domain_kebab}s" \
    "$ROOT/src/app/api/native/${domain}s" \
    "$ROOT/src/app/api/native/${domain}" \
    "$ROOT/src/app/api/native/${domain_kebab}s" \
    "$ROOT/src/app/api/native/${domain_kebab}"; do
    [ -d "$pattern" ] && find "$pattern" -name "route.ts" 2>/dev/null >> "$tmpfile"
  done

  routes_found=""
  while IFS= read -r rf; do
    [ -z "$rf" ] && continue
    rel=$(echo "$rf" | sed "s|$ROOT/||")
    routes_found="$routes_found\`$rel\`, "
  done < <(sort -u "$tmpfile")
  rm -f "$tmpfile"

  if [ -n "$routes_found" ]; then
    echo "| Routes | ${routes_found%, } |" >> "$OUT"
  fi

  echo "" >> "$OUT"
done

# Cross-cutting infrastructure
cat >> "$OUT" << 'INFRA'
---

## Tvärgående infrastruktur

| Vad | Fil |
|-----|-----|
INFRA

declare -a infra=(
  "Auth helper|src/lib/auth-dual.ts"
  "Auth server|src/lib/auth-server.ts"
  "Admin auth|src/lib/admin-auth.ts"
  "API handler wrapper|src/lib/api-handler.ts"
  "Rate limiting|src/lib/rate-limit.ts"
  "Prisma client|src/lib/prisma.ts"
  "Supabase server|src/lib/supabase/server.ts"
  "Supabase browser|src/lib/supabase/browser.ts"
  "Logger (server)|src/lib/logger.ts"
  "Logger (klient)|src/lib/client-logger.ts"
  "Feature flags (server)|src/lib/feature-flags.ts"
  "Feature flags (metadata)|src/lib/feature-flag-definitions.ts"
  "Feature flags (klient)|src/components/providers/FeatureFlagProvider.tsx"
  "Email|src/lib/email/index.ts"
)

for entry in "${infra[@]}"; do
  label="${entry%%|*}"
  path="${entry##*|}"
  [ -f "$ROOT/$path" ] && echo "| $label | \`$path\` |" >> "$OUT"
done

# UI Pages
echo "" >> "$OUT"
echo "## UI-sidor" >> "$OUT"
echo "" >> "$OUT"

for section in "provider:Provider (leverantör)" "customer:Kund" "admin:Admin"; do
  dir="${section%%:*}"
  title="${section##*:}"

  echo "### $title" >> "$OUT"
  echo "" >> "$OUT"
  echo "| Sida | Fil |" >> "$OUT"
  echo "|------|-----|" >> "$OUT"

  while IFS= read -r p; do
    [ -z "$p" ] && continue
    rel=$(echo "$p" | sed "s|$ROOT/||")
    page_name=$(echo "$rel" | sed "s|src/app/$dir/||" | sed 's|/page.tsx||' | sed 's|\[.*\]/||g')
    [ -z "$page_name" ] && page_name="index"
    echo "| $page_name | \`$rel\` |" >> "$OUT"
  done < <(find "$ROOT/src/app/$dir" -name "page.tsx" 2>/dev/null | sort)

  echo "" >> "$OUT"
done

# --- Feature flag mapping ---
echo "" >> "$OUT"
echo "## Feature flag -> fil-mapping" >> "$OUT"
echo "" >> "$OUT"
echo "> Vilka filer berörs om en flagga ändras? Genererat via grep." >> "$OUT"
echo "" >> "$OUT"

# Extract flag keys from definitions file
defs="$ROOT/src/lib/feature-flag-definitions.ts"
if [ -f "$defs" ]; then
  flag_keys=$(grep -oP '^\s+\K\w+(?=:\s*\{)' "$defs" 2>/dev/null || grep -E '^\s+[a-z_]+:\s*\{' "$defs" | sed 's/:.*//' | tr -d ' ')

  for flag in $flag_keys; do
    # Search for flag references in ts/tsx files (exclude definitions file itself and test files)
    refs=$(grep -rl "\"$flag\"\|'$flag'" "$ROOT/src" --include="*.ts" --include="*.tsx" 2>/dev/null \
      | grep -v "feature-flag-definitions" \
      | grep -v "\.test\." \
      | grep -v "__tests__" \
      | sort -u)

    if [ -n "$refs" ]; then
      echo "### \`$flag\`" >> "$OUT"
      echo "" >> "$OUT"
      for ref in $refs; do
        rel=$(echo "$ref" | sed "s|$ROOT/||")
        echo "- \`$rel\`" >> "$OUT"
      done
      echo "" >> "$OUT"
    fi
  done
fi

echo "Code map generated: $OUT"
wc -l "$OUT"
