---
title: "Autonom sprint-körning"
description: "Hur en Claude-session kör en hel sprint utan mänsklig inblandning"
category: rule
status: active
last_updated: 2026-04-04
tags: [workflow, autonomous, sprint]
sections:
  - Trigger
  - Flöde per story
  - Kvalitetsgates
  - Review-matris
  - Kommunikation med Johan
  - Stopp-villkor
---

# Autonom sprint-körning

## Trigger

Sessionen startas med "kör sprint X" eller "kör sprint X autonomt".
Sessionen kör ALLA stories i sprinten sekventiellt utan att stanna.

## Flöde per story

För VARJE story i sprint-dokumentets prioritetsordning:

### 1. Plocka story
- Läs `docs/sprints/status.md` -- vilken är nästa pending?
- Uppdatera status: story -> `in_progress`
- Skapa feature branch: `feature/<story-id>-<kort-beskrivning>`

### 2. Planera (station 1)
- Skriv plan i `docs/plans/<story-id>-plan.md`
- Committa planen

### 3. Self-review av plan
- Kör ALLA relevanta subagenter (se Review-matris nedan)
- Om blocker hittas: uppdatera planen och kör review igen
- Om godkänd: fortsätt till implementation

### 4. Implementera (station 2-3: RED -> GREEN)
- TDD: tester FÖRST (RED), sedan implementation (GREEN)
- BDD dual-loop för API routes och domain services
- Kör `npx vitest run <path>` efter varje GREEN-steg

### 5. Self-review av kod (station 4)
- Kör code-reviewer subagent
- Kör relevanta specialistsubagenter (se Review-matris)
- Om blocker/major hittas: fixa och kör review igen
- Dokumentera vilka reviews som kördes

### 6. Verifiera (station 5)
- `npm run check:all` (typecheck + test + lint + swedish)
- ALLA 4 gates MÅSTE vara gröna innan vidare
- Om fail: fixa och kör igen. Max 3 försök, sedan STOPP.
- **Vid infrastruktur/auth-ändringar:** Kör även `npm run test:e2e:smoke` lokalt

### 7. Done-fil + status-uppdatering (SAMMA commit)
- Skriv `docs/done/<story-id>-done.md` med:
  - Acceptanskriterier bockade
  - Definition of Done bockade
  - **Reviews körda** (vilka subagenter)
  - Avvikelser
  - Lärdomar
- **SAMTIDIGT:** Uppdatera `docs/sprints/status.md`: story -> `done` + commit-hash
- **Committa BÅDA filerna i samma commit** (förhindrar drift)

### 8. Merga (Dev äger hela flödet)

```bash
# 1. Pusha feature branch
git push -u origin feature/<story-id>-<namn>

# 2. Byt till main och merga
git checkout main
git pull origin main
git merge feature/<story-id>-<namn> --no-ff -m "Merge feature/<story-id>: kort beskrivning"

# 3. Pusha main
git push origin main

# 4. Rensa branch (OMEDELBART)
git branch -d feature/<story-id>-<namn>
git push origin --delete feature/<story-id>-<namn>
```

**REGLER:**
- Dev mergar SJÄLV -- ingen Lead-merge behövs
- `LEAD_MERGE=1` behövs INTE (branch protection av)
- Feature branch MÅSTE raderas efter merge (lokalt + remote)
- `git pull origin main` FÖRE merge (undvik divergent branches)
- Pusha ALDRIG direkt till main utan feature branch

### 9. Nästa story
- Gå till steg 1 med nästa pending story
- Om alla stories klara: kör sprint-avslut (se nedan)

---

## Kvalitetsgates (OBLIGATORISKA)

### Per story (före merge)

- [ ] Plan skriven och committad
- [ ] Self-review av plan med relevanta subagenter
- [ ] Tester skrivna FÖRE implementation (TDD)
- [ ] `npm run check:all` 4/4 gröna
- [ ] Done-fil med reviews-sektion
- [ ] Inga blockers eller majors från subagenter
- [ ] Vid schema-ändring: `npm run migrate:status` visar inga pending

### Per sprint (vid avslut, före retro)

- [ ] E2E smoke grön: `npm run test:e2e:smoke`
- [ ] Migrationer applicerade på staging: `npm run migrate:status`
- [ ] Docs uppdaterade: kör `/update-docs` (README, NFR, CLAUDE.md, gotchas)
- [ ] Inga uncommittade ändringar: `git status` visar rent

---

## Review-matris (vilka subagenter per story-typ)

| Story berör | Subagenter att köra |
|-------------|-------------------|
| API route (ny/ändrad) | tech-architect (plan) + security-reviewer (kod) + code-reviewer |
| iOS Swift-filer | ios-expert (plan) + code-reviewer |
| UI-komponenter | cx-ux-reviewer (kod) + code-reviewer |
| Auth/säkerhet | security-reviewer (plan + kod) + tech-architect (plan) |
| Databas/schema | tech-architect (plan) + code-reviewer |
| Mekanisk migrering | code-reviewer (bara) |
| Docs/config | Inga subagenter behövs |

Kör ALLTID code-reviewer. Övriga baserat på story-typ.

---

## Kommunikation med Johan

### Fråga Johan vid:
- Produktbeslut (scope, prioritering, "ska vi bygga X?")
- Nya env-variabler eller konton (Supabase, Stripe, Apple)
- Arkitekturbeslut som INTE täcks av sprint-planen
- Blockerare från externa system

### Fråga INTE Johan vid:
- Plan-godkännande (self-review med subagenter räcker)
- Code review (subagenter + check:all)
- Merge-beslut (om gates är gröna)
- Tekniska val inom sprint-scopet

---

## Stopp-villkor

STOPPA sprinten och meddela Johan om:
- `check:all` failar 3 gånger i rad på samma story
- En subagent hittar en blocker som kräver arkitekturbeslut utanför sprint-scope
- En story kräver env-variabler eller konton som inte finns
- Något oväntat som påverkar produktionsmiljön
- Alla stories klara (skriv retro, meddela Johan)

---

## Sprint-avslut (OBLIGATORISKT)

När alla stories är klara, kör dessa steg I ORDNING:

### 1. Sprint-gates (kvalitetskontroll)
```bash
npm run test:e2e:smoke          # E2E smoke grön
npm run migrate:status          # Inga pending migrationer
git status                      # Rent working tree
```

### 2. Docs-uppdatering
Kör `/update-docs` med sprint-numret. Kontrollera:
- README.md (testantal, nya features, ändrad stack)
- NFR.md (nya säkerhetskapabiliteter, testantal)
- CLAUDE.md (nya key learnings, ändrade resurslänkar)
- docs/guides/gotchas.md (nya gotchas upptäckta under sprinten)

### 3. Sprint-retro
Skriv `docs/retrospectives/<datum>-sprint-<N>.md` med:
- Levererat (stories, tester, LOC)
- Vad gick bra
- Vad som inte fungerade
- Processändring till nästa sprint

### 4. Meddela Johan
"Sprint X klar. Retro i docs/retrospectives/."

---

## Parallella sessioner med worktrees

Stories som rör **helt separata filer** kan köras parallellt med git worktrees:

```bash
git worktree add ../equinet-s16-2 -b feature/s16-2-seed-scripts main
```

**Regler:**
- Varje session MÅSTE ange story-ID (`kör S16-2`)
- Skriv ALDRIG bara `kör` vid parallella sessioner
- Mergea sekventiellt (en i taget, pull innan merge)
- Radera worktree efter merge: `git worktree remove ../equinet-s16-2`

**Bra kandidater för parallellisering:**
- Cleanup + seed-scripts (olika filer)
- iOS + webb (olika kataloger)
- Docs + implementation (ingen överlapp)

**ALDRIG parallellt:**
- Två stories som rör samma API routes
- Schema-ändring + route-ändring (migreringen måste vara klar först)
