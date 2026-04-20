---
title: "S47-3: Hook-tester (scripts/test-hooks.sh)"
description: "Plan för att skapa test-script för alla 6 pre-commit hooks."
category: plan
status: active
last_updated: 2026-04-20
sections:
  - Aktualitet verifierad
  - Syfte
  - Filer som ändras
  - Approach
  - Scenarier per hook
---

# S47-3: Hook-tester (scripts/test-hooks.sh)

## Aktualitet verifierad

**Kommandon körda:** `glob scripts/check-*.sh` + läst pre-commit + pre-push
**Resultat:** 6 check-scripts finns (check-docs-updated, check-plan-commit, check-sprint-closure, check-reviews-done, check-branch-for-story, check-own-pr-merge). Inget test-script finns.
**Beslut:** Fortsätt

## Syfte

Vi har 6+ hooks utan automatiska tester. Om status.md-formatet ändras brister hooks tyst utan feedback. `test-hooks.sh` kör varje hook mot kända scenarier i isolerade temp-repos och rapporterar PASS/FAIL.

## Filer som ändras

1. `scripts/test-hooks.sh` (ny) — test-runner
2. `package.json` — lägg till `"test:hooks": "bash scripts/test-hooks.sh"`
3. `docs/sprints/status.md` — S47-3 → in_progress + done

## Approach

### Isolerade temp-repos per hook-grupp

Varje hook-grupp kör i en temp-katalog med eget git-repo:
- `git init` + initial commit → `main`
- Fixture-filer skapas
- `git add` + kör script → assert_pass/assert_fail
- Cleanup: `rm -rf $tmpdir`

Inga sideeffekter på huvud-repot.

### assert_pass / assert_fail

```bash
assert_pass "beskrivning" $?  # Fail-rapporteras om exit != 0
assert_fail "beskrivning" $?  # Fail-rapporteras om exit == 0
```

### Hur lägger man till test för ny hook

1. Skapa `test_<hooknamn>()` funktion
2. `setup_repo tmpdir` → `cd $tmpdir`
3. Skapa fixtures, `git add`, kör `bash "$SCRIPT_DIR/<hook>.sh"`
4. `assert_pass`/`assert_fail` med beskrivning
5. `cd "$ORIG_DIR" && rm -rf $tmpdir`
6. Lägg till anrop i `run_all_tests()` längst ner

## Scenarier per hook

| Hook | Scenarier |
|------|-----------|
| check-sprint-closure.sh | ingen status.md, pending stories, alla done+retro, alla done utan retro (varning exit 0) |
| check-plan-commit.sh | ingen in_progress, lifecycle-only, in_progress+plan saknas (varning), in_progress+plan committad |
| check-branch-for-story.sh | feature branch, main+ingen in_progress, main+lifecycle-only, main+in_progress+kod (BLOCK), override |
| check-reviews-done.sh | ingen done-fil, docs-only, korrekt reviews, saknar security-reviewer (BLOCK), trivial, override |
| check-docs-updated.sh | inget staged, plan med aktualitet, plan utan aktualitet (BLOCK), done med docs, done utan docs (BLOCK) |
| check-own-pr-merge.sh | inget PR-nummer (exit 1), ogiltigt PR-nummer (exit 1), gh saknas (exit 0) |

**Totalt:** 22 scenarier över 6 hooks (≥3 per hook).
