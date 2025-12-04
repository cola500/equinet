#!/bin/bash

# Start Equinet development server
echo "🚀 Startar Equinet..."

# Get the script directory (works regardless of where you run it from)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

# Check if port 3000 is already in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 3000 är redan upptagen!"
    echo "Kör ./scripts/stop.sh först för att stoppa befintlig server."
    exit 1
fi

# Start the dev server in background with nohup
cd "$PROJECT_DIR"
nohup npm run dev > /dev/null 2>&1 &

# Get the PID
DEV_PID=$!

# Wait a bit and check if it started successfully
sleep 3

if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Servern startad på http://localhost:3000 (PID: $DEV_PID)"
else
    echo "❌ Servern kunde inte startas. Kolla 'npm run dev' manuellt."
  