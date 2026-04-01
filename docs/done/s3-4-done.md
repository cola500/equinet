---
title: "S3-4 Done: Seed-data för recensioner"
description: "Acceptanskriterier och DoD för demo-recensioner"
category: plan
status: active
last_updated: 2026-04-01
sections:
  - Acceptanskriterier
  - Definition of Done
  - Avvikelser
---

# S3-4 Done: Seed-data för recensioner

## Acceptanskriterier

- [x] 3 recensioner med varierande betyg (4-5 stjarnor)
- [x] Realistiska kommentarer pa svenska
- [x] `npm run db:seed:demo:reset` inkluderar recensioner

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel (`npm run typecheck`)
- [x] Saker (ingen ny input, seed-script)
- [x] `npm run check:all` passerar (4/4 grona)
- [x] Docs uppdaterade vid behov (plan + done)

## Avvikelser

Inga. Mekanisk polish -- 3 recensioner kopplade till completed-bokningar.
Hanterar bade forsta seed och re-seed (exists-check pa bookingId).
