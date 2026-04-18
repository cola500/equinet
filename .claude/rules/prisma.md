---
title: "Prisma & Databas Requirements"
description: "Migration workflow, checklista vid schemaandring och repository pattern"
category: rule
status: active
last_updated: 2026-04-18
tags: [prisma, database, migration, repository-pattern]
paths:
  - "prisma/**"
  - "src/infrastructure/**"
sections:
  - Migration Workflow
  - Checklista vid schemaandring
  - Gotchas
  - Repository Pattern
  - Schema-först
  - Migration med constraint-ändring + datamigrering
  - Nytt falt pa befintlig modell
---

# Prisma & Databas Requirements

## Migration Workflow

1. `prisma migrate dev --name beskrivning` (lokalt)
2. `npm run deploy` (push till GitHub -> Vercel auto-deploy)
3. `apply_migration` via Claude MCP (Supabase)
4. Verifiera: `/api/health`

**VIKTIGT:** Vercel deploy uppdaterar BARA kod, INTE databasen. Schemaandringar kraver `apply_migration` via Supabase MCP separat.

## Checklista vid schemaandring

1. Skapa lokal migrationsfil (`prisma/migrations/<ts>_<name>/migration.sql`)
2. `apply_migration` pa Supabase
3. `prisma migrate resolve --applied <name>`
4. Verifiera med `execute_sql`

**Hoppa ALDRIG over steg 1** -- utan lokal fil detekterar Prisma "drift" och blockerar `migrate dev`.

## Gotchas

- **`select` > `include`**: Bade performance och sakerhet
- **`$transaction` kraver `@ts-expect-error`**: Kanda TS-inferensproblem med callback-syntax
- **NOT NULL utan default failar** om tabellen har data. Fix: `--create-only`, andra SQL till `ADD COLUMN ... DEFAULT now()`, kor `migrate dev` igen
- **Använd `prisma migrate dev`** för schemaändringar (INTE `db push`). Baseline migration `0_init` representerar hela schemat
- **Kor `get_advisors(type: "security")` efter nya tabeller** -- RLS kan missas

## RLS vid ny kärndomän (OBLIGATORISKT)

Ny kärndomän (repository obligatoriskt) = RLS-migration i FÖRSTA commiten, inte skjuten till senare.

- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- READ/INSERT/UPDATE-policies för alla relevanta roller
- RLS-bevistest i `src/__tests__/rls/<domain>.test.ts`
- Om kolumn-nivå-permissions behövs: se `docs/architecture/column-level-grant-rls-pattern.md`

**Varför:** S35-1 implementerade Conversation utan RLS. Tabellerna deployades till prod. Även om feature flag skyddade användare var defense-in-depth-skyddet ett hål. Backa alltid säkerhet i migration-lagret, inte bara i service-lagret.

## Repository Pattern

Karndomaner (Booking, Provider, Service, CustomerReview, Horse) MASTE anvanda repository.
Stoddomaner (AvailabilityException, AvailabilitySchedule) -- Prisma direkt ar OK.

## Schema-först

Prisma-schema -> API -> UI ger typsäkerhet hela vägen. Designa alltid schemat först.

## Migration med constraint-ändring + datamigrering

Ordning: (1) Add nullable column + FK, (2) DROP old constraint, (3) Data migration DO-block, (4) SET NOT NULL + CREATE new constraint. Droppa ALLTID gamla constrainten FÖRE datamigreringssteget -- annars failar INSERT på duplicate key.

## Nytt falt pa befintlig modell

Kontrollera ALLA select-block, mappings och queries i hela kodbasen. `providerNotes` missades forst i passport-route.
