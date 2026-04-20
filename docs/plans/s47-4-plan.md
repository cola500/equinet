---
title: "S47-4: Uppgradera S45-varningar till BLOCKERS med override"
description: "Plan för att uppgradera 4 varnings-hooks till blockers med override-mekanism."
category: plan
status: active
last_updated: 2026-04-20
sections:
  - Aktualitet verifierad
  - Syfte
  - Filer som ändras
  - Approach per hook
  - Override-mönster
---

# S47-4: Uppgradera S45-varningar till BLOCKERS med override

## Aktualitet verifierad

**Kommandon körda:** Läst check-plan-commit.sh, check-sprint-closure.sh, pre-push, check-own-pr-merge.sh
**Resultat:** Alla 4 bekräftade som warnings-only (exit 0 alltid). Problem kvarstår.
**Beslut:** Fortsätt

## Syfte

S45-hooks är idag varningar som ignoreras under tempo. Uppgradera till blockers med override — explicit motivering krävs för att kringgå.

## Filer som ändras

1. `scripts/check-plan-commit.sh` — BLOCK + override via COMMIT_EDITMSG
2. `scripts/check-sprint-closure.sh` — BLOCK + override via COMMIT_EDITMSG
3. `scripts/check-multi-commit.sh` (ny) — extraherat från pre-push, BLOCK + override via senaste commit-msg
4. `.husky/pre-push` — ersätt inline multi-commit-gate med anrop till check-multi-commit.sh
5. `scripts/check-own-pr-merge.sh` — BLOCK i non-interactive + `--override`-flagga
6. `scripts/test-hooks.sh` — uppdatera befintliga tester + nya scenarier
7. `.claude/rules/commit-strategy.md` — override-dokumentation

## Approach per hook

### check-plan-commit.sh

Nuvarande: always exit 0 med varningstext

Nytt: om plan saknas + ingen override → exit 1
```bash
# Läs COMMIT_EDITMSG för override
if echo "$COMMIT_SUBJECT" | grep -qE '\[override:[[:space:]]*[a-zA-Z0-9åäöÅÄÖ]'; then
  echo "[OVERRIDE] Plan-commit-gate kringgått: $OVERRIDE_TEXT"
  exit 0
fi
echo "[BLOCKER] Plan saknas för: $ACTIVE_STORIES"
exit 1
```

### check-sprint-closure.sh

Nuvarande: always exit 0 med varningstext

Nytt: om alla done + retro saknas + ingen override → exit 1

### check-multi-commit.sh (ny, extraherat från pre-push)

Separat script för testbarhet. Logik:
- Bara relevant om feature/-branch
- Om >= 2 commits → exit 0
- Kolla override i `git log -1 --pretty=%B HEAD`
- Om < 2 commits och ingen override → BLOCK

### check-own-pr-merge.sh

Nuvarande i non-interactive: exit 0 (auto-fortsätt)

Nytt:
- Utan `--override`: exit 1 (block) i non-interactive
- Med `bash check-own-pr-merge.sh 123 --override`: exit 0 med log

## Override-mönster

Alla hooks: `[override: <motivering>]` i commit-message (pre-commit) eller senaste commit-msg (pre-push). Motivering MÅSTE starta med bokstav/siffra — inte `<placeholder>`.

check-own-pr-merge.sh: `--override` flagga som andra argument.
