---
title: "S44-0 Done: TA BORT-batch — 3 döda E2E-specs raderade"
description: "Raderade payment, exploratory-baseline, announcements specs. E2E: 29 → 26"
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Lärdomar
---

# S44-0 Done: TA BORT-batch

## Acceptanskriterier

- [x] 3 specs raderade från `e2e/`
- [x] Per-spec-verifiering dokumenterad (vilka ersättare verifierades)
- [x] Gap-rapport i `docs/metrics/testpyramid/removed-2026-04-19.md`
- [x] `npm run check:all` grön efter alla raderingar (4/4)
- [x] E2E-svit: 29 → 26 specs

**Notering:** `announcements.spec.ts` (456r) raderades av tech-lead i S43-avslut-commit `b485dd06`. `payment.spec.ts` (337r) och `exploratory-baseline.spec.ts` (302r) raderades av denna session.

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (inga ändringar i produktionskod)
- [x] Tester gröna (4232 passed, check:all 4/4)
- [x] Feature branch, check:all grön

## Reviews körda

Kördes: code-reviewer

(Se code-reviewer-analys nedan.)

### Code-reviewer analys

Inga nya API-ytor, inget säkerhetsrelevant, inga UI-ändringar. Enbart E2E-spec-radering med verifierad ersättar-täckning. Trivial gating gäller INTE (rör 3 filer, kräver coverage-verifiering) — code-reviewer kördes.

**Fynd:** Inga blockers. Integration-täckningen för payment är solid (380r). Gap för announcements UI-management dokumenterad som acceptabel given instabilitet i original-spec.

## Docs uppdaterade

- [x] `docs/metrics/testpyramid/removed-2026-04-19.md` — gap-rapport skapad
- Backlog-rad för 1.14.2 admin system gap läggs till vid merge i status.md

## Verktyg använda

- Läste patterns.md vid planering: nej (N/A — raderingsbatch, inget implementationsmönster)
- Kollade code-map.md för att hitta filer: nej (filerna var kända från sprint-dokumentet)
- Hittade matchande pattern: nej

## Arkitekturcoverage

N/A

## Modell

sonnet

## Lärdomar

- **announcements.spec.ts redan raderad:** Tech-lead hade raderat spec:en i S43-avslut-commit. Verifiering av git-historik FÖRE `git rm`-anrop hade sparat tid. Pattern: kör `git status` + `ls e2e/` i startskedet.
- **26 specs (inte 28):** Sprint-planen utgick från 29 specs, men faktisk startpunkt var 28 (efter tech-lead commit). Slutresultat stämmer ändå — 26 specs kvar som förväntat.
