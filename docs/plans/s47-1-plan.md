---
title: "S47-1 Plan: Review-obligatorisk-gate (pre-commit BLOCKER)"
description: "Plan för att skapa check-reviews-done.sh och integrera i pre-commit hook"
category: plan
status: active
last_updated: 2026-04-20
sections:
  - Aktualitet verifierad
  - Approach
  - Filer som ändras
  - Risker
---

# S47-1: Review-obligatorisk-gate (pre-commit BLOCKER)

## Aktualitet verifierad

**Kommandon körda:** `ls scripts/check-*.sh && cat .husky/pre-commit`
**Resultat:** `check-reviews-done.sh` existerar inte. Pre-commit kör 5 steg idag, inget review-check.
**Beslut:** Fortsätt — problemet är aktivt.

## Approach

### Steg 1: Skapa `scripts/check-reviews-done.sh`

Logik:
1. Kolla om `docs/done/s*.md` är staged — annars exit 0
2. Override-check: läs `.git/COMMIT_EDITMSG` för `[override: <text>]`
3. Hämta branch-diff (`git diff main..HEAD --name-only`) + staged files → union
4. Exkludera lifecycle-docs (done, sprints, retrospectives, plans)
5. Om inga icke-docs-filer: docs-only → exit 0
6. Trivial-gating: om done-filen har `- [ ] code-reviewer — ej tillämplig (trivial story:` → exit 0
7. Matcha filer mot review-matrix (hardkodade patterns):
   - `src/app/api/**/route.ts` → code-reviewer, security-reviewer
   - `src/app/api/**/route.integration.test.ts` → code-reviewer
   - `src/components/**/*.tsx` → code-reviewer, cx-ux-reviewer
   - `ios/**/*.swift` → code-reviewer, ios-expert
   - `prisma/schema.prisma` → tech-architect, code-reviewer
   - `src/lib/*auth*.ts` → security-reviewer, code-reviewer
   - `middleware.ts` → security-reviewer, tech-architect, code-reviewer
   - Alla andra src/e2e/scripts/prisma/ios-filer → code-reviewer (default)
8. Bygg `required_set` = union av alla matchade subagents
9. Parsa done-filens `- [x] <reviewer>` rader → `actual_set`
10. Om `required_set ⊄ actual_set`: **exit 1** med tydligt felmeddelande

### Steg 2: Uppdatera `.husky/pre-commit`

Lägg till steg 6 efter befintliga 5:
```bash
# 6. Review-obligatorisk-gate (BLOCKER)
bash scripts/check-reviews-done.sh || exit 1
```

### Verifiering (manuell)

Testa tre scenarier manuellt:
- S46-1-scenariot: route.ts ändrad, security-reviewer saknas → blockerar
- Korrekt done-fil: alla required `[x]` → passerar
- Docs-only story → passerar utan reviews

## Filer som ändras/skapas

- `scripts/check-reviews-done.sh` (ny)
- `.husky/pre-commit` (uppdateras)

## Risker

- `git diff main..HEAD` returnerar tomt om vi är på main → fallback till staged files (graceful, ej blockering)
- COMMIT_EDITMSG inte tillgänglig för interaktiva commits → override fungerar inte, men agenter använder alltid `git commit -m "..."`
- Falska positiver om done-filens Reviews-sektion har oväntad formatering → mitigeras med enkel sed-parsning
