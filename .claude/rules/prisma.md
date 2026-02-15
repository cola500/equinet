---
paths:
  - "prisma/**"
  - "src/infrastructure/**"
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
- **Anvand `prisma migrate dev`** for schemaandringar (INTE `db push`). Baseline migration `0_init` representerar hela schemat
- **Kor `get_advisors(type: "security")` efter nya tabeller** -- RLS kan missas

## Repository Pattern

Karndomaner (Booking, Provider, Service, CustomerReview, Horse) MASTE anvanda repository.
Stoddomaner (AvailabilityException, AvailabilitySchedule) -- Prisma direkt ar OK.

## Nytt falt pa befintlig modell

Kontrollera ALLA select-block, mappings och queries i hela kodbasen. `providerNotes` missades forst i passport-route.
