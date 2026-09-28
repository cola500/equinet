#!/bin/bash
# Stoppar tidigt med ett tydligt fel om fel Node-huvudversion är aktiv.
#
# .nvmrc är den enda källan till sanning för vilken version som krävs (samma
# version som CI kör, se .github/workflows/quality-gates.yml). Utan denna
# check ger fel Node-huvudversion (t.ex. Node 26) kryptiska, orelaterade
# jsdom-testfel långt senare i stället för en direkt förklaring — se
# docs/guides/gotchas.md, Gotcha #42.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REQUIRED_VERSION="$(tr -d '[:space:]' < "$REPO_ROOT/.nvmrc")"
REQUIRED_MAJOR="${REQUIRED_VERSION%%.*}"

CURRENT_VERSION="$(node -v)"
CURRENT_MAJOR="$(echo "$CURRENT_VERSION" | sed -E 's/^v([0-9]+).*/\1/')"

if [ "$CURRENT_MAJOR" != "$REQUIRED_MAJOR" ]; then
  echo ""
  echo "=========================================="
  echo "  FEL NODE-VERSION"
  echo "=========================================="
  echo "  Aktiv:   $CURRENT_VERSION"
  echo "  Krävs:   Node ${REQUIRED_MAJOR}.x (.nvmrc, matchar CI)"
  echo ""
  echo "  Byt version:"
  echo "    nvm:      nvm use"
  echo "    Homebrew: export PATH=\"/opt/homebrew/opt/node@${REQUIRED_MAJOR}/bin:\$PATH\""
  echo "              (installera först vid behov: brew install node@${REQUIRED_MAJOR})"
  echo ""
  echo "  Se README.md#prerequisites för mer info."
  echo "=========================================="
  echo ""
  exit 1
fi
