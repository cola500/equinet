---
title: "S47-2: Branch-check pre-commit (BLOCKER)"
description: "Plan för att lägga till pre-commit hook som blockerar kod-commits på main när story är in_progress."
category: plan
status: active
last_updated: 2026-04-20
sections:
  - Aktualitet verifierad
  - Syfte
  - Filer som ändras
  - Approach
  - Lifecycle-docs-mönster
  - Testscenarier
---

# S47-2: Branch-check pre-commit (BLOCKER)

## Aktualitet verifierad

**Kommandon körda:** `glob scripts/check-branch*.sh` + `cat .husky/pre-commit`
**Resultat:** `check-branch-for-story.sh` saknas helt. Pre-commit har 6 steg, inget branch-check.
**Beslut:** Fortsätt

## Syfte

Förhindra direkta kod-commits på main när en story är in_progress. Adresserar rotorsaken till S46-1-procedurbrottet (Dev committade direkt på main + hoppade security-reviewer).

## Filer som ändras

1. `scripts/check-branch-for-story.sh` — ny skriptfil med hook-logiken
2. `.husky/pre-commit` — lägg till rad för branch-check (BLOCKER, som check-reviews-done.sh)
3. `docs/sprints/status.md` — S47-2 → in_progress + done vid slutföring

## Approach

### Steg 1: Skriv scripts/check-branch-for-story.sh

Logiken:
1. `CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)`
2. Om branch != main → exit 0 (bara relevant på main)
3. Läs `docs/sprints/status.md`, hitta `in_progress`-stories
4. Om inga in_progress → exit 0
5. Kolla staged filer — filtrera bort lifecycle-docs
6. Om inga non-lifecycle-filer staged → exit 0
7. Kolla COMMIT_EDITMSG för `[override: <text>]`
8. Om override med motivering → logga + exit 0
9. Annars → BLOCKER med tydligt felmeddelande

### Steg 2: Uppdatera .husky/pre-commit

Lägg till efter rad 6 (check-reviews-done):
```bash
# 7. Branch-check (BLOCKER om kod-commit på main under aktiv story)
bash scripts/check-branch-for-story.sh || exit 1
```

### Steg 3: Kör manuella smoke-tester för alla 4 scenarier

### Steg 4: npm run check:all

### Steg 5: code-reviewer (enda obligatorisk per review-matrix.md för scripts/)

## Lifecycle-docs-mönster

Filer som är OK att committa direkt på main (undantagna från block):
- `docs/sprints/status.md`
- `docs/sprints/session-*.md`
- `docs/sprints/sprint-*.md`
- `docs/sprints/backlog.md`
- `docs/done/*.md`
- `docs/retrospectives/*.md`
- `docs/plans/*.md`
- `docs/metrics/*.md`

Mönster: `^docs/(sprints|done|retrospectives|plans|metrics)/`

Allt annat är "non-lifecycle" och trigger blocken om man är på main med story in_progress.

## Testscenarier

| Scenario | Förväntat resultat |
|----------|-------------------|
| main + story in_progress + src/-fil staged | BLOCKER |
| main + story in_progress + docs/sprints/status.md staged | OK (lifecycle) |
| main + story in_progress + docs/plans/*.md staged | OK (lifecycle) |
| main + inga in_progress stories | OK |
| feature branch + story in_progress + src/-fil staged | OK (inte main) |
| main + in_progress + src/-fil + [override: motivering] | OK (override logged) |

## Risker

- Ingen: hooken är additiv (bara blockerar det som var problem), lifecycle-undantaget är bred nog för normalt arbete på main.
