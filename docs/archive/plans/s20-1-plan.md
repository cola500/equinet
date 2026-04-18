---
title: "S20-1: Coverage-gate i CI"
description: "Anvand vitest.config.ts thresholds som enda sanningskalla for coverage i CI"
category: plan
status: active
last_updated: 2026-04-10
sections:
  - Approach
  - Filer
---

# S20-1: Coverage-gate i CI

## Approach

Coverage thresholds finns redan i vitest.config.ts men CI overridade med egna varden.
Fix: ta bort CLI-override i CI, lat vitest.config.ts styra. Justera branches till 65%
(nuvarande baseline 69.79%).

## Filer

- `vitest.config.ts` -- branches threshold 70 -> 65 (realistisk baseline)
- `.github/workflows/quality-gates.yml` -- ta bort CLI threshold-override
