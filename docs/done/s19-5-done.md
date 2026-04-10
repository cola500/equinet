---
title: "S19-5: Fixa waitForTimeout i announcements.spec.ts -- Done"
description: "21 waitForTimeout ersatta med explicita element waits"
category: retro
status: active
last_updated: 2026-04-10
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Lärdomar
---

# S19-5: Fixa waitForTimeout i announcements.spec.ts -- Done

## Acceptanskriterier

- [x] 0 st waitForTimeout utan dokumenterad motivering (21 -> 0)
- [x] Typecheck grön

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Feature branch, committad

## Reviews

Kördes: Inga subagenter behövdes (E2E-fix, ingen ny logik)

## Lärdomar

- Sprint-docen sa 8 men det var 21 -- största specen med flest waitForTimeout
- Rate limit reset saknades i provider beforeEach -- tillagd som bonus
- Promise.race-mönstret fungerar bra för "laddning ELLER empty state"
- Municipality dropdown: `li.waitFor()` ersätter `waitForTimeout(500)` elegant
