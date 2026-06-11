#!/usr/bin/env bash
#
# Shared helpers for Vercel env scripts (verify-db-urls.sh, set-vercel-env.sh).
# CLI-auth only (reads the logged-in Vercel CLI token from auth.json) — never
# requires VERCEL_TOKEN. Never prints secret values; always mask.
#
# Targeting: reads are done via a TEMP directory linked to the chosen project
# (`vercel link --cwd <tmp>`), so the repo's own .vercel link is never touched.
# Writes are done via the Vercel REST API against the project id.
#
# shellcheck shell=bash

_VENV_AUTH_JSON="$HOME/Library/Application Support/com.vercel.cli/auth.json"

# Map a friendly selector to the real Vercel project name.
venv_project_name() {  # $1 = prod|production|staging
  case "$1" in
    prod|production) echo "equinet-app" ;;
    staging)         echo "equinet-staging-app" ;;
    *) return 1 ;;
  esac
}

# The logged-in CLI token (no VERCEL_TOKEN needed).
venv_token() {
  [ -f "$_VENV_AUTH_JSON" ] || { echo "✖ Vercel-token saknas ($_VENV_AUTH_JSON) — kör 'vercel login'." >&2; return 1; }
  node -e "console.log(require(process.env.HOME+'/Library/Application Support/com.vercel.cli/auth.json').token||'')"
}

# Team/org id from the repo's existing link (.vercel/project.json).
venv_team() {
  node -e "console.log(require(process.cwd()+'/.vercel/project.json').orgId)" 2>/dev/null
}

# Resolve a project id by name via REST API.
venv_pid() {  # $1 = project name
  local name="$1" team token
  team="$(venv_team)"; token="$(venv_token)" || return 1
  curl -s "https://api.vercel.com/v9/projects?teamId=$team&search=equinet" -H "Authorization: Bearer $token" \
   | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const p=(JSON.parse(d).projects||[]).find(x=>x.name===process.argv[1]);process.stdout.write(p?p.id:'')})" "$name"
}

# Pull a project's PRODUCTION env to an absolute outfile, without touching the
# repo's link. Uses a throwaway temp dir linked to the project. Returns non-zero
# on failure. The outfile contains secrets — the caller MUST delete it.
venv_pull() {  # $1 = project name, $2 = absolute outfile
  local name="$1" out="$2" tmp
  tmp="$(mktemp -d)" || return 1
  if ! vercel link --cwd "$tmp" --project "$name" --yes >/dev/null 2>&1; then rm -rf "$tmp"; return 1; fi
  if ! vercel env pull --cwd "$tmp" --environment=production "$tmp/.env.pull" >/dev/null 2>&1; then rm -rf "$tmp"; return 1; fi
  rm -f "$out"; cp "$tmp/.env.pull" "$out" 2>/dev/null; rm -rf "$tmp"
  [ -s "$out" ]
}

# Read a single value from a pulled dotenv file (quotes stripped). No masking —
# callers mask before printing.
venv_getval() {  # $1 = envfile, $2 = key
  local line; line=$(grep -E "^$2=" "$1" | head -1); line="${line#*=}"; line="${line%\"}"; line="${line#\"}"
  printf '%s' "$line"
}

# Mask the password in a postgres URL ( ://user:PASSWORD@host → ://user:***@host ).
venv_mask() { printf '%s' "$1" | sed -E 's#(://[^:]+:)[^@]+(@)#\1***\2#'; }

# Normalise a Supabase pooler DATABASE_URL's query suffix to the correct
# ?pgbouncer=true&connection_limit=1, preserving host + password. Uses %/postgres*
# (last match) so the 'postgres.<ref>' username is not clipped.
venv_normalize_db_url() {  # $1 = current url -> echoes normalised url
  printf '%s' "${1%/postgres*}/postgres?pgbouncer=true&connection_limit=1"
}
