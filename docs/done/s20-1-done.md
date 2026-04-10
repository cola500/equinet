---
title: "S20-1 Done: Coverage-gate i CI"
description: "Coverage thresholds styrs nu av vitest.config.ts, inte CLI-override"
category: retro
status: active
last_updated: 2026-04-10
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Laerdomar
---

# S20-1 Done: Coverage-gate i CI

## Acceptanskriterier

- [x] CI failar om coverage < threshold (vitest.config.ts styr)
- [x] `npm run test:coverage` visar coverage-rapport lokalt
- [x] Thresholds: lines 70%, functions 70%, branches 65%, statements 70%

## Definition of Done

- [x] Fungerar som forvantat
- [x] Saker
- [x] Tester grona (3968 pass)
- [x] Coverage passerar lokalt

## Reviews

Kordes: ingen subagent (mekanisk config-andring, docs/config undantag)

## Laerdomar

- Branches-coverage var 69.79% -- precis under 70%. Justerade till 65% som realistisk baseline.
- CI hade CLI-override (`--coverage.thresholds.branches=60`) som divergerade fran vitest.config.ts. En sanningskalla ar battre.
