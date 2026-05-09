#!/usr/bin/env bash
# Clean up xcresult bundles and test logs after iOS testing.
#
# xcodebuild generates Logs/Test/*.xcresult bundles that can grow several GB
# per test run. They are useful for debugging but rarely needed once results
# are reviewed, and they fill the disk quickly during iterative development.
#
# Run after `xcodebuild test ...` to free space, or manually anytime.
# Safe: only removes Logs/Test, leaves DerivedData/Build intact (so next
# test run doesn't need a full rebuild).

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
TEST_LOGS="$ROOT/ios/Equinet/build/derived/Logs/Test"

if [ ! -d "$TEST_LOGS" ]; then
    echo "[ios-test-cleanup] No test logs at $TEST_LOGS"
    exit 0
fi

SIZE=$(du -sh "$TEST_LOGS" 2>/dev/null | cut -f1)
echo "[ios-test-cleanup] Removing $TEST_LOGS ($SIZE)..."
rm -rf "$TEST_LOGS"
echo "[ios-test-cleanup] Done."
