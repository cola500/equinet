#!/usr/bin/env python3
"""
Equinet diff review tool.

Reads a git diff from stdin and returns a structured review
based on Equinet's coding standards.

Usage:
    git diff | python3 scripts/equinet-review.py
    git diff -- ios/ | python3 scripts/equinet-review.py
    git diff HEAD~1 | python3 scripts/equinet-review.py

Requires:
    OPENAI_API_KEY environment variable

Optional:
    EQUINET_REVIEW_MODEL  -- model to use (default: gpt-4o-mini)
"""

import json
import os
import sys
import urllib.error
import urllib.request

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


def read_diff() -> str:
    if sys.stdin.isatty():
        print("Error: no diff provided on stdin.", file=sys.stderr)
        print("Usage: git diff | python3 scripts/equinet-review.py", file=sys.stderr)
        sys.exit(1)
    return sys.stdin.read()


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
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Error: could not reach OpenAI API: {e.reason}", file=sys.stderr)
        sys.exit(1)

    try:
        return body["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError):
        print("Error: unexpected API response format.", file=sys.stderr)
        print(f"Response: {json.dumps(body)[:500]}", file=sys.stderr)
        sys.exit(1)


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


def main():
    diff = read_diff()

    if not diff.strip():
        print(EMPTY_DIFF_RESPONSE)
        sys.exit(0)

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("Error: OPENAI_API_KEY environment variable is not set.", file=sys.stderr)
        print("Export it before running:", file=sys.stderr)
        print("  export OPENAI_API_KEY=sk-...", file=sys.stderr)
        sys.exit(1)

    model = os.environ.get("EQUINET_REVIEW_MODEL", "").strip() or DEFAULT_MODEL

    diff = truncate_diff(diff)
    result = call_openai(diff, api_key, model)

    if not validate_output(result):
        print("Warning: unexpected output format from API.", file=sys.stderr)

    print(result)


if __name__ == "__main__":
    main()
