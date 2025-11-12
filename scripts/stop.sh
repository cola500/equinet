#!/bin/bash

# Stop Equinet development server
echo "🛑 Stoppar Equinet..."

# Kill all Next.js dev processes
pkill -f "next dev"

# Wait a moment for processes to stop
sleep 1

# Check if server is stopped
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Kunde inte stoppa servern helt. Försöker force kill..."
    lsof -ti:3000 | xargs kill -9
    sleep 1
fi

# Final check
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ Servern körs fortfarande på port 3000"
    exit 1
else
    echo "✅ Servern är stoppad"
fi
