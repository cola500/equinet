#!/bin/bash

# Start Equinet development server
echo "🚀 Startar Equinet..."

# Check if port 3000 is already in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 3000 är redan upptagen!"
    echo "Kör ./scripts/stop.sh först för att stoppa befintlig server."
    exit 1
fi

# Start the dev server
npm run dev
