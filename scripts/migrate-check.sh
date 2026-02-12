#!/bin/bash
# Visa migrationer som finns lokalt men kanske inte på Supabase

echo ""
echo "  Senaste 5 migrationer (lokalt):"
ls -1d prisma/migrations/[0-9]* 2>/dev/null | sort -r | head -5 | while read dir; do
  echo "    $(basename "$dir")"
done

# Kolla om det finns ocommittade migrations
UNCOMMITTED=$(git status -s prisma/migrations 2>/dev/null)
if [[ -n "$UNCOMMITTED" ]]; then
  echo ""
  echo "  OBS: Ocommittade migrations:"
  echo "$UNCOMMITTED" | sed 's/^/    /'
fi

echo ""
echo "  Tips: Kontrollera Supabase med:"
echo "    execute_sql(project_id, \"SELECT version FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5\")"
echo ""
