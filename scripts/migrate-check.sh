#!/bin/bash
# Visa migrationer som finns lokalt och (om möjligt) jämför med Supabase.
# Kör: npm run migrate:check

source "$(dirname "$0")/_lib.sh"

echo ""
echo "  Senaste 5 migrationer (lokalt):"
get_local_migration_names | sort -r | head -5 | while read -r name; do
  echo "    $name"
done

# Kolla om det finns ocommittade migrations
UNCOMMITTED=$(git status -s prisma/migrations 2>/dev/null)
if [[ -n "$UNCOMMITTED" ]]; then
  echo ""
  echo "  OBS: Ocommittade migrations:"
  echo "$UNCOMMITTED" | sed 's/^/    /'
fi

# Visa remote-info om Docker körs och URL inte pekar på localhost
DIRECT_URL=$(get_direct_url)
if [[ -n "$DIRECT_URL" ]] && ! is_localhost_url "$DIRECT_URL"; then
  if docker ps 2>/dev/null | grep -q equinet-db; then
    REMOTE_NAMES=$(get_remote_migration_names "$DIRECT_URL")
    if [[ -n "$REMOTE_NAMES" ]]; then
      echo ""
      echo "  Senaste 5 migrationer (Supabase):"
      echo "$REMOTE_NAMES" | sort -r | head -5 | while read -r name; do
        echo "    $name"
      done
    fi
  fi
fi

echo ""
echo "  Tips: Kör 'npm run migrate:status' för fullständig jämförelse."
echo ""
