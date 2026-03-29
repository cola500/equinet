---
title: CI Decisions
description: Beslut och lärdomar kring CI/CD-konfiguration
category: operations
status: current
last_updated: 2026-03-29
sections:
  - Web E2E in PR
---

# CI Decisions

## 2026-03-29 — Web E2E in PR

### Context

Full E2E (35 specs) kördes tidigare som PR-gate. Det gav återkommande failures -- inte alltid flaky i strikt mening, ofta miljö-/timing-/CI-relaterat (saknade snapshots, extern AI-timeout, redirect-timing). PR-feedback blev långsam (~43 min) och opålitlig (9-33 failures per körning).

### Change

Bytte PR-gate från `npm run test:e2e` till `npm run test:e2e:smoke` (exploratory-baseline + auth, 2 specs).

### Verified outcome

De senaste 7 PR-körningarna har passerat med smoke (25 tests, ~1.7 min). Inga återkommande failures. PR-flödet är stabilt.

### Known issues (full suite)

Dessa påverkar inte PR längre, men finns kvar om full suite körs:

- **visual-regression.spec.ts:** Konsekvent broken i CI -- saknade snapshot-baselines. 20 failures per körning.
- **customer-insights.spec.ts:** Extern AI-tjänst med 30s timeout. 2-4 failures.
- **auth.spec.ts registrering:** Intermittent redirect-timing.
- **route-announcement-notification.spec.ts:** DB-polling timeout.
- **provider-notes.spec.ts:** Dialog-interaktion timing.

### Decision

- Smoke är PR-gate för webben
- Full E2E körs inte i PR
- Full E2E behandlas som separat concern (main/nightly/manuell)

### Not doing now

- Fixar inte flaky tester i full suite
- Genererar inte visual regression baselines i CI
- Ändrar inte smoke-scope

### Future option

Om vi vill återinföra full suite i CI: börja med att exkludera visual-regression.spec.ts, sedan adressera timing-/miljöproblem stegvis.
