#!/bin/bash
#
# iOS Offline Verification Script
#
# Automated E2E verification of the iOS app's offline chain:
# NetworkMonitor → offline banner → stale cache → reconnect banner
#
# Uses simctl defaults write to trigger debug override in NetworkMonitor.
# Requires: Xcode, booted iOS Simulator, app installed (DEBUG build).
#
# Usage:
#   ./scripts/ios-offline-verification.sh [device-name]
#   ./scripts/ios-offline-verification.sh "iPhone 17 Pro"
#

set -euo pipefail

DEVICE_NAME="${1:-iPhone 17 Pro}"
BUNDLE_ID="com.equinet.Equinet"
WAIT_SECONDS=3
SCREENSHOT_DIR="/tmp/equinet-offline-verify"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${YELLOW}[offline-verify]${NC} $1"; }
pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

mkdir -p "$SCREENSHOT_DIR"

# Step 1: Find booted simulator
log "Looking for booted simulator..."
DEVICE_UDID=$(xcrun simctl list devices booted -j | python3 -c "
import json, sys
data = json.load(sys.stdin)
for runtime, devices in data.get('devices', {}).items():
    for d in devices:
        if d.get('state') == 'Booted':
            print(d['udid'])
            sys.exit(0)
sys.exit(1)
" 2>/dev/null) || true

if [ -z "${DEVICE_UDID:-}" ]; then
    log "No booted simulator found. Booting '${DEVICE_NAME}'..."
    DEVICE_UDID=$(xcrun simctl list devices -j | python3 -c "
import json, sys
name = '${DEVICE_NAME}'
data = json.load(sys.stdin)
for runtime, devices in data.get('devices', {}).items():
    for d in devices:
        if d.get('name') == name and d.get('isAvailable', False):
            print(d['udid'])
            sys.exit(0)
sys.exit(1)
")
    xcrun simctl boot "$DEVICE_UDID"
    sleep 5
    log "Simulator booted: $DEVICE_UDID"
else
    log "Found booted simulator: $DEVICE_UDID"
fi

# Step 2: Ensure clean debug state
log "Clearing any previous debug override..."
xcrun simctl spawn "$DEVICE_UDID" defaults delete "$BUNDLE_ID" debugOffline 2>/dev/null || true

# Step 3: Launch app
log "Launching Equinet app..."
xcrun simctl launch "$DEVICE_UDID" "$BUNDLE_ID" 2>/dev/null || {
    log "App not installed or failed to launch. Build a DEBUG version first:"
    log "  cd ios/Equinet"
    log "  xcodebuild build -project Equinet.xcodeproj -scheme Equinet -destination 'id=$DEVICE_UDID' -derivedDataPath build"
    log "  xcrun simctl install $DEVICE_UDID build/Build/Products/Debug-iphonesimulator/Equinet.app"
    fail "App launch failed"
}
log "App launched. Waiting ${WAIT_SECONDS}s for app to load..."
sleep "$WAIT_SECONDS"

# Step 4: Take baseline screenshot (online)
xcrun simctl io "$DEVICE_UDID" screenshot "$SCREENSHOT_DIR/01-baseline.png" 2>/dev/null
log "Baseline screenshot: $SCREENSHOT_DIR/01-baseline.png"

# Step 5: Trigger offline mode
log "Setting debugOffline=true via UserDefaults..."
xcrun simctl spawn "$DEVICE_UDID" defaults write "$BUNDLE_ID" debugOffline -bool true
log "Waiting ${WAIT_SECONDS}s for offline banner (NetworkMonitor polls every 1s)..."
sleep "$WAIT_SECONDS"

# Step 6: Take offline screenshot
xcrun simctl io "$DEVICE_UDID" screenshot "$SCREENSHOT_DIR/02-offline.png" 2>/dev/null
log "Offline screenshot: $SCREENSHOT_DIR/02-offline.png"
pass "Offline mode triggered"

# Step 7: Trigger reconnect
log "Removing debugOffline override (back to real network state)..."
xcrun simctl spawn "$DEVICE_UDID" defaults delete "$BUNDLE_ID" debugOffline
log "Waiting ${WAIT_SECONDS}s for reconnected banner..."
sleep "$WAIT_SECONDS"

# Step 8: Take reconnected screenshot
xcrun simctl io "$DEVICE_UDID" screenshot "$SCREENSHOT_DIR/03-reconnected.png" 2>/dev/null
log "Reconnected screenshot: $SCREENSHOT_DIR/03-reconnected.png"
pass "Reconnect triggered"

# Step 9: Wait for reconnected banner to auto-dismiss (app shows it for 3s)
sleep 4
xcrun simctl io "$DEVICE_UDID" screenshot "$SCREENSHOT_DIR/04-normal.png" 2>/dev/null

# Summary
echo ""
echo "=============================="
pass "iOS offline verification complete"
echo "=============================="
echo ""
log "Screenshots in $SCREENSHOT_DIR/:"
log "  01-baseline.png    -- normal state before test"
log "  02-offline.png     -- should show orange 'Ingen internetanslutning' banner"
log "  03-reconnected.png -- should show green 'Ansluten igen' banner"
log "  04-normal.png      -- should show normal state (banners dismissed)"
echo ""
log "For automated accessibility verification, use mobile-mcp:"
log "  mobile_list_elements_on_screen -> search for 'Ingen internetanslutning'"
