#!/bin/bash
# Skapar en backup av produktionsdatabasen (Supabase) via lokal Docker-container.
# Kör: npm run db:backup
# Flaggor: --quiet (bara errors, för automation)

set -e

QUIET=false
for arg in "$@"; do
  case $arg in
    --quiet) QUIET=true ;;
  esac
done

log() {
  if [[ "$QUIET" == false ]]; then
    echo "$1"
  fi
}

# --- 1. Hämta DATABASE_URL (samma logik som env-status.sh) ---
DB_URL=""
if grep -q "^DIRECT_DATABASE_URL=" .env.local 2>/dev/null; then
  DB_URL=$(grep "^DIRECT_DATABASE_URL=" .env.local | head -1 | cut -d'"' -f2)
elif grep -q "^DIRECT_DATABASE_URL=" .env 2>/dev/null; then
  DB_URL=$(grep "^DIRECT_DATABASE_URL=" .env | head -1 | cut -d'"' -f2)
elif grep -q "^DATABASE_URL=" .env.local 2>/dev/null; then
  DB_URL=$(grep "^DATABASE_URL=" .env.local | head -1 | cut -d'"' -f2)
elif grep -q "^DATABASE_URL=" .env 2>/dev/null; then
  DB_URL=$(grep "^DATABASE_URL=" .env | head -1 | cut -d'"' -f2)
fi

if [[ -z "$DB_URL" ]]; then
  echo "FEL: Ingen DATABASE_URL eller DIRECT_DATABASE_URL hittad i .env / .env.local" >&2
  exit 1
fi

# --- 2. Skippa localhost (behöver inte backas upp) ---
if [[ "$DB_URL" == *"localhost"* ]] || [[ "$DB_URL" == *"127.0.0.1"* ]]; then
  log "Lokal databas -- backup behövs inte (exit 2)"
  exit 2
fi

# --- 3. Verifiera att Docker-containern kör ---
if ! docker ps 2>/dev/null | grep -q equinet-db; then
  echo "FEL: Docker-containern 'equinet-db' kör inte." >&2
  echo "  Starta med: npm run db:up" >&2
  exit 1
fi

# --- 4. Skapa backup ---
BACKUP_DIR="backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DATE}.sql"

mkdir -p "$BACKUP_DIR"

log ""
log "=== Databas-backup ==="
log "  Källa: ${DB_URL:0:60}..."
log "  Mål:   $BACKUP_DIR/${DATE}.sql.gz"
log ""

# pg_dump via Docker-containern (som har psql/pg_dump installerat)
# --data-only: bara data (schema hanteras av Prisma-migrationer)
# --schema=public: exkluderar Supabase-interna schemas (auth, storage, realtime, etc)
# --no-owner --no-privileges: portabel backup
# --exclude-table: hoppa över Prisma migration-tabell
docker exec equinet-db pg_dump "$DB_URL" \
  --data-only \
  --schema=public \
  --no-owner \
  --no-privileges \
  --exclude-table=_prisma_migrations \
  > "$BACKUP_FILE"

# Komprimera
gzip "$BACKUP_FILE"
FINAL_FILE="${BACKUP_FILE}.gz"

# Visa storlek
SIZE=$(ls -lh "$FINAL_FILE" | awk '{print $5}')
log "  Backup klar: $FINAL_FILE ($SIZE)"

# --- 5. Auto-cleanup: ta bort backups äldre än 30 dagar ---
DELETED=$(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -print -delete 2>/dev/null | wc -l | tr -d ' ')
if [[ "$DELETED" -gt 0 ]]; then
  log "  Rensade $DELETED gamla backups (>30 dagar)"
fi

log ""
