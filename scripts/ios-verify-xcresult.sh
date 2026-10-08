#!/usr/bin/env bash
#
# Verify an xcodebuild test run from its exit code AND its .xcresult bundle.
#
# Why: CI used to grep the log for any "Executed ... with 0 failures" line, which
# matches every passing suite even when another suite failed. The result bundle
# is the source of truth (it also counts crashed and restarted test runs).
#
# Passes only if tests ran, none failed and the overall result is "Passed".
# A non-zero xcodebuild exit code is tolerated (with a warning) only in that case,
# because the simulator can exit 65 on an audio warning although all tests passed.
#
# Usage: scripts/ios-verify-xcresult.sh <xcodebuild-exit-code> <path/to/Result.xcresult>

set -euo pipefail

EXIT_CODE="${1:?usage: ios-verify-xcresult.sh <xcodebuild-exit-code> <result.xcresult>}"
RESULT="${2:?usage: ios-verify-xcresult.sh <xcodebuild-exit-code> <result.xcresult>}"

if [ ! -d "$RESULT" ]; then
  echo "FAIL: no result bundle at $RESULT (xcodebuild exit code $EXIT_CODE)"
  exit 1
fi

if ! SUMMARY=$(xcrun xcresulttool get test-results summary --path "$RESULT" --compact); then
  echo "FAIL: could not read test summary from $RESULT (xcodebuild exit code $EXIT_CODE)"
  exit 1
fi

read -r STATUS TOTAL FAILED <<<"$(python3 -c '
import json, sys
d = json.load(sys.stdin)
print(d.get("result", "unknown"), d.get("totalTestCount", 0), d.get("failedTests", 0))
' <<<"$SUMMARY")"

echo "xcodebuild exit code: $EXIT_CODE | result: $STATUS | tests: $TOTAL | failed: $FAILED"

if [ "$TOTAL" -le 0 ]; then
  echo "FAIL: no tests were executed (or the summary format changed with this Xcode version). Raw summary:"
  echo "$SUMMARY" | head -c 2000
  exit 1
fi

if [ "$FAILED" -gt 0 ] || [ "$STATUS" != "Passed" ]; then
  echo "FAIL: $FAILED failed test(s), result '$STATUS'"
  xcrun xcresulttool get test-results tests --path "$RESULT" --compact 2>/dev/null \
    | python3 -c '
import json, sys
def walk(nodes, path=""):
    for n in nodes:
        name = path + "/" + n.get("name", "")
        if n.get("nodeType") == "Test Case" and n.get("result") == "Failed":
            print("  failed:", name)
        walk(n.get("children", []), name)
try:
    walk(json.load(sys.stdin).get("testNodes", []))
except Exception:
    pass
' || true
  exit 1
fi

if [ "$EXIT_CODE" -ne 0 ]; then
  echo "::warning::xcodebuild exited with $EXIT_CODE but the result bundle shows all $TOTAL tests passed"
fi
echo "OK: all $TOTAL tests passed"
