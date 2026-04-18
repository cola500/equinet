---
title: "S31-5 Done: Arkivera gamla planer"
description: "Sprint-planer S3-S28 (83 filer) flyttade till docs/archive/plans/"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Lärdomar
---

# S31-5 Done: Arkivera gamla planer

## Acceptanskriterier

- [x] `docs/plans/` innehåller ~28 filer (aktuella s29-s31 + template + icke-sprint) — under ~30, acceptabelt
- [x] Arkiverade planer spårbara via `git log --follow`
- [x] `docs/archive/plans/README.md` finns med kontext

## Definition of Done

- [x] Inga TypeScript-fel
- [x] `npm run check:all` 4/4 grön
- [x] Feature branch, PR skapad

## Reviews körda

Kördes: ingen (trivial story -- mekanisk git mv, ingen logik, <15 min, check:all grön)

## Docs uppdaterade

Uppdaterade: docs/archive/plans/ (ny katalog med 83 arkiverade plan-filer + README)
Ingen docs-uppdatering i övrigt (intern struktur-förändring, inget användarvänt)

## Verktyg använda

- Läste patterns.md vid planering: nej (N/A -- trivial fil-flytt)
- Kollade code-map.md för att hitta filer: nej (visste redan)
- Hittade matchande pattern? Nej
- Varför: trivial story, inget arkitektur-pattern tillämpligt

## Lärdomar

Inga s2-planer fanns att flytta (sprintar 2-9 hade varierande namnschema). Icke-sprint-planer (2026-02-28-*, bdd-payment-refactor.md, etc.) behölls i docs/plans/ per spec.
