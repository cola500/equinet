---
title: "S19-2: Slå ihop flexible-booking -- Done"
description: "Toggle-test flyttat till booking.spec.ts, 5 svaga tester borttagna"
category: retro
status: active
last_updated: 2026-04-10
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Lärdomar
---

# S19-2: Slå ihop flexible-booking -- Done

## Acceptanskriterier

- [x] Alla unika testfall bevarade i booking.spec.ts (toggle fixed/flexible)
- [x] flexible-booking.spec.ts borttagen
- [x] Inga regressioner (typecheck grön)

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Säker (ingen funktionell ändring)
- [x] Feature branch, committad

## Reviews

Kördes: Inga subagenter behövdes (E2E-konsolidering, ingen ny logik)

## Lärdomar

5 av 6 tester i flexible-booking.spec.ts hade 2-3 waitForTimeout och conditional skips.
Testerna gav falskt förtroende -- de passerade genom att skippa sig själva vid problem.
Bättre att ha 1 robust toggle-test än 6 sköra tester.
