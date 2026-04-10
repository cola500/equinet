---
title: "S19-6: Separera externa beroenden -- Done"
description: "Offline + AI specs exkluderade från standard E2E-svit"
category: retro
status: active
last_updated: 2026-04-10
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Lärdomar
---

# S19-6: Separera externa beroenden -- Done

## Acceptanskriterier

- [x] `npm run test:e2e` exkluderar externa specs (offline, AI)
- [x] `npm run test:e2e:external` kör enbart dessa
- [x] Typecheck grön

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Feature branch, committad

## Reviews

Kördes: Inga subagenter behövdes (config-ändring, ingen ny logik)

## Lärdomar

- `testIgnore` i Playwright-projekt accepterar regex-arrayer
- Offline-specs kördes redan i standard-sviten (utan `testIgnore`) -- de skippades pga guards men tog tid
- Separering minskar standard-svitens körtid och false positives
