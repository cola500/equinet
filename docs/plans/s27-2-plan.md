---
title: "S27-2: Migrationstest ren DB i CI"
description: "Nytt CI-job som kör prisma migrate reset mot ren PostgreSQL"
category: plan
status: active
last_updated: 2026-04-16
sections:
  - Bakgrund
  - Approach
  - Filer som ändras
  - Risker
---

# S27-2: Migrationstest ren DB i CI

## Bakgrund

CI kör `prisma migrate deploy` (inkrementellt) men inte `prisma migrate reset` (from scratch). Trasiga migrationer som refererar saknade tabeller fångas inte.

## Approach

1. Lägg till nytt job `migration-from-scratch` i `quality-gates.yml`
2. Job startar ren PostgreSQL-service, kör `prisma migrate reset --force`
3. Lägg till i `quality-gate-passed` needs-listan
4. Ingen påverkan på befintliga jobs

## Filer som ändras

- `.github/workflows/quality-gates.yml` -- nytt job + uppdaterad needs

## Risker

- Låg risk. Additivt CI-jobb, påverkar inte befintliga.
- `prisma migrate reset --force` kräver `--force` för att hoppa över interaktiv prompt.
