#!/usr/bin/env bash
# Wrapper runt 'gh pr merge' som kör check-own-pr-merge.sh FÖRE merge.
# Användning: git merge-pr <PR-nummer> [--merge|--squash|--rebase] [--delete-branch] [--override]
# Alias-setup (en gång per klon): git config --local alias.merge-pr '!bash scripts/gh-pr-merge.sh'

PR="$1"

if [[ -z "$PR" ]]; then
  echo "Användning: git merge-pr <PR-nummer> [--merge|--squash|--rebase] [--delete-branch] [--override]"
  exit 1
fi

shift

# Filtrera ut --override (hör till check-own-pr-merge, inte gh pr merge)
OVERRIDE=""
GH_ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--override" ]]; then
    OVERRIDE="--override"
  else
    GH_ARGS+=("$arg")
  fi
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

CHECK_ARGS=("$PR")
[[ -n "$OVERRIDE" ]] && CHECK_ARGS+=("$OVERRIDE")
bash "$SCRIPT_DIR/check-own-pr-merge.sh" "${CHECK_ARGS[@]}" || exit 1
gh pr merge "$PR" "${GH_ARGS[@]}"
