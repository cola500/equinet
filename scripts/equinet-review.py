#!/usr/bin/env python3
"""
Equinet diff review tool.

Reads a git diff and returns a structured review based on
Equinet's coding standards.

Usage:
    git diff | scripts/equinet-review
    git diff -- ios/ | scripts/equinet-review
    scripts/equinet-review --staged

Exit codes:
    0  = APPROVE
    10 = FIX (review found issues)
    20 = usage or configuration error
    30 = API or response error

Requires:
    OPENAI_API_KEY environment variable

Optional:
    EQUINET_REVIEW_MODEL  -- model to use (default: gpt-4o-mini)
"""

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

EXIT_APPROVE = 0
EXIT_FIX = 10
EXIT_USAGE = 20
EXIT_API = 30

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4o-mini"
TIMEOUT_SECONDS = 30
MAX_DIFF_CHARS = 12000

SYSTEM_PROMPT = """\
You are a code reviewer for the Equinet iOS/web app. Review the provided git diff \
and return a structured verdict.

## Review rules

### General
- Small changes, minimal diff, one clear slice at a time.
- No accidental extra refactoring beyond what the diff intends.
- Risk assessment: consider blast radius and reversibility.

### SwiftUI / UI
- Prefer Button over onTapGesture for interactive controls.
- accessibilityLabel must describe user intent or object meaning, not just visual content.
  - Good: "Sätt betyg 3 av 5", "måndag 31 mars, idag, vald"
  - Bad: "3 stjärna", "måndag, 31"
- Only add accessibility traits when they clearly add value.
- Preserve visual appearance (.buttonStyle(.plain) when needed).
- Avoid unnecessary refactoring.

### Typography / UI polish
- Prioritize always-visible UI parts first.
- Avoid large sweeps -- small targeted changes are better.

### CI / workflow
- Distinguish between speed, cost, stability, and semantics.
- Mark verified vs estimated claims.

### Mechanical API migrations
- Recognize diffs that replace a deprecated/older API with its modern equivalent:
  - e.g. showsIndicators: false -> .scrollIndicators(.hidden)
  - e.g. appendingPathComponent() -> appending(path:)
  - e.g. String(format: "%.1f") -> .formatted(.number.precision(...))
  - e.g. foregroundColor() -> foregroundStyle()
- When ALL of these are true, lean APPROVE:
  - the diff is small
  - the change is mechanical (old API -> new API, same behavior)
  - no extra refactoring has been added
  - no UX, semantics, or accessibility degradation
- Do NOT give FIX just because the API form changed. Only FIX when there is a concrete \
signal of changed behavior, degraded UX, or missing verification.
- A green build is a positive signal for mechanical migrations but does not override \
clear risks.

### What to weigh
- Is the diff minimal?
- Is semantics improved?
- Is accessibility sufficient?
- What is the risk level?
- Is this reasonable as a focused slice?

## Output format

You MUST respond with EXACTLY this format and nothing else:

RESULT: <APPROVE or FIX>
RISK: <LOW or MEDIUM or HIGH>

REASONS:
- <reason 1>
- <reason 2>
- ...

VERIFY:
- <verification step 1>
- <verification step 2>
- ...

Rules:
- APPROVE means the diff looks good as-is.
- FIX means something should be changed before committing.
- Keep reasons and verify steps concise (one line each).
- 2-5 reasons, 1-3 verify steps.
- Do NOT include any other text, markdown fences, or commentary.
"""

EMPTY_DIFF_RESPONSE = """\
RESULT: FIX
RISK: LOW

REASONS:
- no diff provided

VERIFY:
- run git diff again"""

VALID_RESULTS = {"APPROVE", "FIX"}
VALID_RISKS = {"LOW", "MEDIUM", "HIGH"}


def get_diff() -> str:
    """Read diff from --staged, stdin, or show usage."""
    if "--staged" in sys.argv:
        try:
            result = subprocess.run(
                ["git", "diff", "--cached"],
                capture_output=True, text=True, check=True,
            )
            return result.stdout
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            print(f"Error: could not run git diff --cached: {e}", file=sys.stderr)
            sys.exit(EXIT_USAGE)

    if not sys.stdin.isatty():
        return sys.stdin.read()

    print("Error: no diff provided.", file=sys.stderr)
    print("Usage:", file=sys.stderr)
    print("  git diff | scripts/equinet-review", file=sys.stderr)
    print("  scripts/equinet-review --staged", file=sys.stderr)
    sys.exit(EXIT_USAGE)


def truncate_diff(diff: str) -> str:
    if len(diff) > MAX_DIFF_CHARS:
        print(
            f"Warning: diff truncated from {len(diff)} to {MAX_DIFF_CHARS} chars.",
            file=sys.stderr,
        )
        return diff[:MAX_DIFF_CHARS]
    return diff


def call_openai(diff: str, api_key: str, model: str) -> str:
    payload = json.dumps({
        "model": model,
        "temperature": 0,
        "max_tokens": 512,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Review this diff:\n\n{diff}"},
        ],
    }).encode()

    req = urllib.request.Request(
        OPENAI_API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            body = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        error_body = e.read().decode() if e.fp else ""
        print(f"Error: OpenAI API returned {e.code}: {error_body}", file=sys.stderr)
        sys.exit(EXIT_API)
    except urllib.error.URLError as e:
        print(f"Error: could not reach OpenAI API: {e.reason}", file=sys.stderr)
        sys.exit(EXIT_API)

    try:
        return body["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError):
        print("Error: unexpected API response format.", file=sys.stderr)
        print(f"Response: {json.dumps(body)[:500]}", file=sys.stderr)
        sys.exit(EXIT_API)


def validate_output(text: str) -> bool:
    lines = text.splitlines()
    if len(lines) < 4:
        return False

    result_ok = any(
        line.startswith("RESULT:") and line.split(":", 1)[1].strip() in VALID_RESULTS
        for line in lines
    )
    risk_ok = any(
        line.startswith("RISK:") and line.split(":", 1)[1].strip() in VALID_RISKS
        for line in lines
    )
    has_reasons = any(line.strip() == "REASONS:" for line in lines)
    has_verify = any(line.strip() == "VERIFY:" for line in lines)

    return result_ok and risk_ok and has_reasons and has_verify


def parse_result(text: str) -> str:
    for line in text.splitlines():
        if line.startswith("RESULT:"):
            return line.split(":", 1)[1].strip()
    return ""


def main():
    diff = get_diff()

    if not diff.strip():
        print(EMPTY_DIFF_RESPONSE)
        sys.exit(EXIT_FIX)

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("Error: OPENAI_API_KEY environment variable is not set.", file=sys.stderr)
        print("Export it before running:", file=sys.stderr)
        print("  export OPENAI_API_KEY=sk-...", file=sys.stderr)
        sys.exit(EXIT_USAGE)

    model = os.environ.get("EQUINET_REVIEW_MODEL", "").strip() or DEFAULT_MODEL

    diff = truncate_diff(diff)
    result = call_openai(diff, api_key, model)

    if not validate_output(result):
        print("Warning: unexpected output format from API.", file=sys.stderr)

    print(result)

    verdict = parse_result(result)
    sys.exit(EXIT_APPROVE if verdict == "APPROVE" else EXIT_FIX)


if __name__ == "__main__":
    main()
