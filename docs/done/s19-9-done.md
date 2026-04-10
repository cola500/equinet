---
title: "S19-9: Fixa waitForTimeout i booking, provider, no-show -- Done"
description: "26 waitForTimeout ersatta med explicita element waits i 3 spec-filer"
category: retro
status: active
last_updated: 2026-04-10
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Lärdomar
---

# S19-9: Fixa waitForTimeout i booking, provider, no-show -- Done

## Acceptanskriterier

- [x] 0 st waitForTimeout i booking.spec.ts (10 -> 0)
- [x] 0 st waitForTimeout i provider.spec.ts (8 -> 0)
- [x] 0 st waitForTimeout i no-show.spec.ts (8 -> 0)
- [x] Typecheck grön

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Feature branch, committad

## Reviews

Kördes: Inga subagenter behövdes (E2E-fix, ingen ny logik)

## Lärdomar

- `expect().toPass({ timeout })` fungerar utmärkt för polling-assertions (räkna items)
- Tab-klick i Playwright behöver sällan sleep -- nästa assertion väntar ändå
- no-show helper-funktion med waitForResponse behövde inte extra sleep efteråt
- Totalt i sprint 19: 65 waitForTimeout eliminerade (39 + 26)
