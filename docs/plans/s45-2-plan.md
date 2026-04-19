---
title: "S45-2: Multi-commit-gate"
description: "Pre-push hook som varnar när feature branch har färre än 2 commits"
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Aktualitet verifierad
  - Approach
  - Filer som ändras
  - Testscenarier
  - Risker
---

# S45-2: Multi-commit-gate

## Aktualitet verifierad

**Kommandon körda:** `grep -n "COMMITS_AHEAD\|multi-commit" .husky/pre-push`
**Resultat:** Ingen träff — inte implementerat.
**Beslut:** Fortsätt

## Approach

Lägg till ett block i `.husky/pre-push` (efter befintliga checks):

```bash
# Multi-commit-gate: varnar om feature branch har <2 commits över main
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" =~ ^feature/ ]]; then
  COMMITS_AHEAD=$(git rev-list --count main..HEAD 2>/dev/null || echo "0")
  if [[ "$COMMITS_AHEAD" -lt 2 ]]; then
    echo "[VARNING] Multi-commit: feature/$BRANCH har bara $COMMITS_AHEAD commit(s) över main."
    echo "   Per team-workflow.md ska varje station committas separat (PLAN → RED → GREEN → ...)."
    echo "   Om detta är avsiktligt (hotfix, docs-only): fortsätt."
    echo ""
  fi
fi
```

Varning, ej blocker. Körs efter befintliga checks (svenska, test, lint).

## Filer som ändras

- `.husky/pre-push` (utökas i slutet)

## Testscenarier

1. **Feature branch <2 commits** → [VARNING] visas, push fortsätter
2. **Feature branch ≥2 commits** → ingen varning
3. **main-branch** → ingen varning (hoppar över)
4. **docs-only feature branch med 1 commit** → varning visas (acceptabelt — informativ)

## Risker

- `git rev-list main..HEAD` kan ge fel om main inte finns lokalt → `|| echo "0"` fallback
- Varningen ska inte blockera (exit 0 bevaras)
