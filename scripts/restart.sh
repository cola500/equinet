#!/bin/bash

# Restart Equinet development server
echo "🔄 Startar om Equinet..."

# Stop the server
./scripts/stop.sh

# Wait a moment
sleep 1

# Start the server
./scripts/start.sh
