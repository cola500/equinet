#!/usr/bin/env bash
#
# Delade skyddsfunktioner för scripts/sync-vercel-token.sh och
# scripts/deploy-production.sh. Ren valideringslogik -- inga hemligheter
# hanteras här (token-läsning sker i sync-vercel-token.sh, aldrig här).
#
# Testbarhet: DEPLOY_GUARD_AUTH_JSON kan sättas för att peka om var
# dgl_read_vercel_token letar efter Vercel CLI:s auth.json (tester source:ar
# denna fil och sätter variabeln till en temp-fixture istället för att röra
# den riktiga inloggade sessionen). Osatt i normal användning.
#
# shellcheck shell=bash

_DGL_DEFAULT_AUTH_JSON="$HOME/Library/Application Support/com.vercel.cli/auth.json"

# --- dgl_auth_json_path ---
# Path till Vercel CLI:s auth.json (override:bar för tester).
dgl_auth_json_path() {
  printf '%s' "${DEPLOY_GUARD_AUTH_JSON:-$_DGL_DEFAULT_AUTH_JSON}"
}

# --- dgl_require_auth_json ---
# Kontrollerar att auth.json finns. Skriver INGET om innehållet.
dgl_require_auth_json() {
  local path; path="$(dgl_auth_json_path)"
  if [ ! -f "$path" ]; then
    echo "✖ Vercel CLI-token saknas ($path) -- kör 'vercel login' och försök igen." >&2
    return 1
  fi
}

# --- dgl_read_vercel_token ---
# Läser token-fältet ur auth.json och skriver det till stdout (ENDA stället
# värdet lämnar filen -- anroparen MÅSTE fånga det direkt i en variabel via
# $(...), aldrig echo:a det vidare eller skriva det till disk/log).
# Returnerar 1 om filen saknas eller token-fältet är tomt.
dgl_read_vercel_token() {
  dgl_require_auth_json || return 1
  local path token
  path="$(dgl_auth_json_path)"
  token="$(AUTH_JSON_PATH="$path" node -e "
    const fs = require('fs')
    const data = JSON.parse(fs.readFileSync(process.env.AUTH_JSON_PATH, 'utf8'))
    process.stdout.write(data.token || '')
  " 2>/dev/null)"
  if [ -z "$token" ]; then
    echo "✖ Kunde inte läsa ett giltigt token ur $path -- kör 'vercel login' och försök igen." >&2
    return 1
  fi
  printf '%s' "$token"
}

# --- dgl_require_vercel_whoami ---
# Kräver att den inloggade Vercel CLI-sessionen faktiskt är giltig.
# Skriver ENDAST användarnamnet (icke-hemligt) vid lyckat resultat.
dgl_require_vercel_whoami() {
  local who
  if ! who="$(vercel whoami 2>&1)"; then
    echo "✖ 'vercel whoami' misslyckades -- sessionen är utloggad eller ogiltig. Kör 'vercel login'." >&2
    return 1
  fi
  echo "  Inloggad i Vercel som: $who"
}

# --- dgl_require_gh_auth ---
# Kräver att gh CLI är autentiserad.
dgl_require_gh_auth() {
  if ! gh auth status >/dev/null 2>&1; then
    echo "✖ 'gh auth status' misslyckades -- kör 'gh auth login' och försök igen." >&2
    return 1
  fi
}

# --- dgl_require_repo ---
# $1 = förväntat "owner/repo". Kräver att gh (kört i cwd) pekar på exakt detta repo.
dgl_require_repo() {
  local expected="$1" actual
  actual="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)"
  if [ "$actual" != "$expected" ]; then
    echo "✖ Fel repo: gh pekar på \"${actual:-<okänt>}\", förväntade \"$expected\". Avbryter." >&2
    return 1
  fi
}

# --- dgl_require_clean_tree ---
# Kräver att git working tree inte har okommitterade ändringar.
dgl_require_clean_tree() {
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo "✖ Okommitterade ändringar i arbetskatalogen. Committa eller stasha dem först." >&2
    return 1
  fi
}

# --- dgl_require_branch ---
# $1 = förväntad branch. Kräver att nuvarande lokala branch matchar exakt.
dgl_require_branch() {
  local expected="$1" actual
  actual="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
  if [ "$actual" != "$expected" ]; then
    echo "✖ Fel branch: du står på \"$actual\", måste stå på \"$expected\". Avbryter." >&2
    return 1
  fi
}

# --- dgl_local_sha / dgl_remote_sha ---
# $1 = branch/ref. Skriver full SHA till stdout, eller tomt vid fel.
dgl_local_sha() { git rev-parse "$1" 2>/dev/null; }
dgl_remote_sha() { git rev-parse "origin/$1" 2>/dev/null; }

# --- dgl_require_sha_match ---
# $1 = lokal SHA, $2 = remote SHA. Kräver exakt match (efter att anroparen
# kört `git fetch` så origin/<branch> är färsk).
dgl_require_sha_match() {
  local local_sha="$1" remote_sha="$2"
  if [ -z "$local_sha" ] || [ -z "$remote_sha" ]; then
    echo "✖ Kunde inte läsa SHA för lokal eller remote branch. Avbryter." >&2
    return 1
  fi
  if [ "$local_sha" != "$remote_sha" ]; then
    echo "✖ Lokal main ($local_sha) matchar inte origin/main ($remote_sha)." >&2
    echo "  Din lokala vy är inte i synk med GitHub -- kör 'git fetch && git status' och lös det först." >&2
    return 1
  fi
}
