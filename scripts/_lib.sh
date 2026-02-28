#!/bin/bash
# Delad hjälpfil för migrationsskript.
# Sourca med: source "$(dirname "$0")/_lib.sh"

# --- get_direct_url ---
# Hämta DIRECT_DATABASE_URL (eller DATABASE_URL som fallback) från .env.local/.env
get_direct_url() {
  local url=""
  if grep -q "^DIRECT_DATABASE_URL=" .env.local 2>/dev/null; then
    url=$(grep "^DIRECT_DATABASE_URL=" .env.local | head -1 | cut -d'"' -f2)
  elif grep -q "^DIRECT_DATABASE_URL=" .env 2>/dev/null; then
    url=$(grep "^DIRECT_DATABASE_URL=" .env | head -1 | cut -d'"' -f2)
  fi

  if [[ -z "$url" ]]; then
    if grep -q "^DATABASE_URL=" .env.local 2>/dev/null; then
      url=$(grep "^DATABASE_URL=" .env.local | head -1 | cut -d'"' -f2)
    elif grep -q "^DATABASE_URL=" .env 2>/dev/null; then
      url=$(grep "^DATABASE_URL=" .env | head -1 | cut -d'"' -f2)
    fi
  fi

  echo "$url"
}

# --- is_localhost_url ---
# Returnera 0 om URL pekar på localhost/127.0.0.1
is_localhost_url() {
  local url="$1"
  [[ "$url" == *"localhost"* ]] || [[ "$url" == *"127.0.0.1"* ]]
}

# --- require_docker ---
# Kontrollera att equinet-db körs, exit 1 annars
require_docker() {
  if ! docker ps 2>/dev/null | grep -q equinet-db; then
    echo "FEL: Docker-containern 'equinet-db' kör inte." >&2
    echo "  Starta med: npm run db:up" >&2
    return 1
  fi
}

# --- query_supabase ---
# Kör SQL via docker exec equinet-db psql
query_supabase() {
  local url="$1"
  local sql="$2"
  docker exec equinet-db psql "$url" -t -A -c "$sql" 2>/dev/null
}

# --- get_local_migration_names ---
# Lista lokala migrationsnamn (sorterade), ett per rad
get_local_migration_names() {
  ls -1d prisma/migrations/[0-9]* 2>/dev/null | while read -r dir; do
    basename "$dir"
  done | sort
}

# --- get_remote_migration_names ---
# Hämta migrationsnamn från _prisma_migrations (sorterade), ett per rad
get_remote_migration_names() {
  local url="$1"
  query_supabase "$url" \
    "SELECT migration_name FROM _prisma_migrations ORDER BY migration_name" \
    | sort
}
