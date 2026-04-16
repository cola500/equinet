---
title: "S27-2 Done: Migrationstest ren DB i CI"
description: "Nytt CI-job migration-from-scratch som kör prisma migrate reset"
category: retro
status: active
last_updated: 2026-04-16
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Lärdomar
---

# S27-2 Done: Migrationstest ren DB i CI

## Acceptanskriterier

- [x] CI kör migrationer från scratch (`prisma migrate reset --force --skip-seed`)
- [x] Trasig migration failar CI (job ingår i quality-gate-passed needs)
- [x] Befintliga CI-jobb opåverkade (additivt job)

## Definition of Done

- [x] Inga TypeScript-fel
- [x] Säker (CI-konfiguration, ingen produktionskod)
- [x] Tester gröna (4045 passed)
- [x] Feature branch, check:all grön

## Reviews

Kördes: Inga subagenter (mekanisk CI-konfiguration, 35 rader YAML tillagda).

## Lärdomar

- `--skip-seed` behövs eftersom seed kan ha beroenden som inte finns i ren test-DB.
- Separat DB-namn (`equinet_migration_test`) undviker konflikter med andra jobs.
