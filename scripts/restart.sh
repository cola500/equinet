#!/bin/bash

# Restart Equinet development server
echo "🔄 Startar om Equinet..."

# Get the script directory (works regardless of where you run it from)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Stop the server
bash "$SCRIPT_DIR/stop.sh"

# Wait a moment
sleep 1

# Start the server
bash "$SCRIPT_DIR/start.sh"
