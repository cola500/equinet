---
title: "S19-4: Fixa waitForTimeout i route-planning.spec.ts -- Done"
description: "8 waitForTimeout ersatta med explicita element waits"
category: retro
status: active
last_updated: 2026-04-10
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Lärdomar
---

# S19-4: Fixa waitForTimeout i route-planning.spec.ts -- Done

## Acceptanskriterier

- [x] 0 st waitForTimeout utan dokumenterad motivering (8 -> 0)
- [x] Typecheck grön

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Feature branch, committad

## Reviews

Kördes: Inga subagenter behövdes (E2E-fix, ingen ny logik)

## Lärdomar

- Promise.race-mönstret fungerar bra för "vänta på data ELLER empty state"
- `toBeEnabled({ timeout })` bättre än sleep innan form submission
