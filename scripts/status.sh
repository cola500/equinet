#!/usr/bin/env bash
# Visar status för lokal utvecklingsmiljö: Supabase + dev-server.
# Kör: npm run status

set -uo pipefail

echo "=== Supabase (lokal) ==="
if supabase status 2>/dev/null | grep -q "API URL"; then
  supabase status 2>/dev/null | grep -E "API URL|DB URL|Studio URL" | sed 's/^/  /'
else
  echo "  Inte igång — starta med: npm run db:up"
fi

echo ""
echo "=== Dev-server (Next.js) ==="
if lsof -i :3000 -sTCP:LISTEN >/dev/null 2>&1; then
  PID=$(lsof -i :3000 -sTCP:LISTEN -t | head -1)
  echo "  Kör på http://localhost:3000 (PID $PID)"
else
  echo "  Inte igång — starta med: npm run dev"
fi

echo ""
echo "=== PWA-server (offline-build, port 3001) ==="
if lsof -i :3001 -sTCP:LISTEN >/dev/null 2>&1; then
  PID=$(lsof -i :3001 -sTCP:LISTEN -t | head -1)
  echo "  Kör på http://localhost:3001 (PID $PID)"
else
  echo "  Inte igång (valfri — npm run start:pwa för offline-tester)"
fi
