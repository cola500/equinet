---
title: "S19-3: Fixa waitForTimeout i calendar.spec.ts -- Done"
description: "10 waitForTimeout ersatta med explicita element waits"
category: retro
status: active
last_updated: 2026-04-10
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Lärdomar
---

# S19-3: Fixa waitForTimeout i calendar.spec.ts -- Done

## Acceptanskriterier

- [x] 0 st waitForTimeout utan dokumenterad motivering (10 -> 0)
- [x] Typecheck grön

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Feature branch, committad

## Reviews

Kördes: Inga subagenter behövdes (E2E-fix, ingen ny logik)

## Lärdomar

- Sprint-docen sa 6 waitForTimeout men det var 10 -- räkna alltid själv
- Vanligaste mönstret: `dialog.waitFor({ state: 'hidden' })` efter save
- Veckonavigation: `toHaveText()` / `not.toHaveText()` fungerar bra för att vänta på UI-uppdatering
