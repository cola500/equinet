#!/bin/bash
# Återställer en backup till den lokala Docker-databasen.
# Kör: npm run db:restore
# Flaggor: --file <sökväg> (skippar interaktivt val)

set -e

BACKUP_DIR="backups"
SELECTED_FILE=""

# --- Parse flaggor ---
while [[ $# -gt 0 ]]; do
  case $1 in
    --file)
      SELECTED_FILE="$2"
      shift 2
      ;;
    *)
      echo "Okänd flagga: $1" >&2
      echo "Användning: npm run db:restore [-- --file <sökväg>]" >&2
      exit 1
      ;;
  esac
done

# --- 1. Verifiera att Docker-containern kör ---
if ! docker ps 2>/dev/null | grep -q equinet-db; then
  echo "FEL: Docker-containern 'equinet-db' kör inte." >&2
  echo "  Starta med: npm run db:up" >&2
  exit 1
fi

# --- 2. Bestäm target-databas ---
DB_URL=""
if grep -q "^DATABASE_URL=" .env.local 2>/dev/null; then
  DB_URL=$(grep "^DATABASE_URL=" .env.local | head -1 | cut -d'"' -f2)
elif grep -q "^DATABASE_URL=" .env 2>/dev/null; then
  DB_URL=$(grep "^DATABASE_URL=" .env | head -1 | cut -d'"' -f2)
fi

# Säkerhetskontroll: blockera restore till Supabase
if [[ "$DB_URL" == *"supabase"* ]] || [[ "$DB_URL" == *"pooler"* ]]; then
  echo "FEL: DATABASE_URL pekar på Supabase. Restore är bara tillåtet mot lokal databas." >&2
  echo "  Byt DATABASE_URL till localhost i .env / .env.local först." >&2
  exit 1
fi

LOCAL_DB="postgresql://postgres:postgres@localhost:5432/equinet"

# --- 3. Välj backup-fil ---
if [[ -n "$SELECTED_FILE" ]]; then
  if [[ ! -f "$SELECTED_FILE" ]]; then
    echo "FEL: Filen '$SELECTED_FILE' finns inte." >&2
    exit 1
  fi
else
  # Lista tillgängliga backups
  if [[ ! -d "$BACKUP_DIR" ]] || [[ -z $(ls -1 "$BACKUP_DIR"/*.sql.gz 2>/dev/null) ]]; then
    echo "Inga backups hittade i $BACKUP_DIR/"
    echo "Kör 'npm run db:backup' först."
    exit 1
  fi

  echo ""
  echo "=== Tillgängliga backups ==="
  echo ""

  FILES=()
  i=1
  for f in $(ls -1t "$BACKUP_DIR"/*.sql.gz 2>/dev/null); do
    SIZE=$(ls -lh "$f" | awk '{print $5}')
    echo "  $i) $(basename "$f")  ($SIZE)"
    FILES+=("$f")
    i=$((i + 1))
  done

  echo ""
  read -rp "Välj backup (1-$((i-1))): " CHOICE

  if [[ -z "$CHOICE" ]] || [[ "$CHOICE" -lt 1 ]] || [[ "$CHOICE" -ge "$i" ]]; then
    echo "Ogiltigt val."
    exit 1
  fi

  SELECTED_FILE="${FILES[$((CHOICE-1))]}"
fi

# --- 4. Bekräftelse ---
echo ""
echo "  Backup:   $(basename "$SELECTED_FILE")"
echo "  Target:   Lokal Docker-databas (equinet)"
echo ""
read -rp "  Återställ? Detta RADERAR all befintlig data i lokal DB. (y/N): " CONFIRM

if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "Avbruten."
  exit 0
fi

# --- 5. Restore ---
echo ""
echo "Återställer..."

# Hämta alla tabellnamn i public schema (exkludera _prisma_migrations)
TABLES=$(docker exec equinet-db psql "$LOCAL_DB" -t -A -c \
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'" \
  2>/dev/null)

if [[ -n "$TABLES" ]]; then
  # Bygg TRUNCATE-kommando med CASCADE
  TRUNCATE_SQL="TRUNCATE TABLE"
  FIRST=true
  while IFS= read -r table; do
    if [[ -n "$table" ]]; then
      if [[ "$FIRST" == true ]]; then
        TRUNCATE_SQL="$TRUNCATE_SQL \"$table\""
        FIRST=false
      else
        TRUNCATE_SQL="$TRUNCATE_SQL, \"$table\""
      fi
    fi
  done <<< "$TABLES"
  TRUNCATE_SQL="$TRUNCATE_SQL CASCADE;"

  docker exec equinet-db psql "$LOCAL_DB" -c "$TRUNCATE_SQL" > /dev/null 2>&1
  echo "  Tabeller rensade"
fi

# Dekomprimera och kör SQL
gunzip -c "$SELECTED_FILE" | docker exec -i equinet-db psql "$LOCAL_DB" > /dev/null 2>&1
echo "  Data återställd"

# Verifiera
ROW_COUNT=$(docker exec equinet-db psql "$LOCAL_DB" -t -A -c \
  "SELECT SUM(n_live_tup) FROM pg_stat_user_tables WHERE schemaname = 'public'" \
  2>/dev/null | tr -d ' ')

echo ""
echo "  Klart! $ROW_COUNT rader i databasen."
echo ""
