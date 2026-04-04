---
title: "S15-0: Fixa E2E i CI -- lokal Supabase Auth"
description: "Kör supabase start i GitHub Actions så E2E-tester har riktig auth-instans"
category: plan
status: active
last_updated: 2026-04-04
sections:
  - Problem
  - Approach
  - Faser
  - Risker
  - Filer som ändras
  - Acceptanskriterier
---

# S15-0: Fixa E2E i CI -- lokal Supabase Auth

## Problem

19 E2E-tester failar i CI sedan Sprint 13 (NextAuth -> Supabase Auth-migrering).
CI har `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321` men ingen Supabase-instans kör.
E2E seed kraschar vid user creation, login når aldrig dashboard.

## Approach

**`supabase start` i GitHub Actions** -- kör full lokal Supabase via Docker.

Ger riktig Auth-server, inbyggd Postgres med `auth`-schema och `supabase_auth_admin`-roll.
E2E seed skapar användare via Supabase Auth admin API istället för bara Prisma.
Custom access token hook aktiveras via `config.toml`.

Granskad av: tech-architect + security-reviewer (inga blockers).

## Faser

### Fas 1: Supabase lokal konfiguration

1. `npx supabase init` -- skapar `supabase/` katalog med `config.toml`
2. Konfigurera `config.toml`:
   - Aktivera custom access token hook:
     ```toml
     [auth.hook.custom_access_token]
     enabled = true
     uri = "pg-functions://postgres/public/custom_access_token_hook"
     ```
   - Auto-confirm email: `enable_signup = true`, `enable_email_autoconfirm = true`
   - `site_url = "http://localhost:3000"` (bara localhost, aldrig prod-URL)
3. Verifiera lokalt: `npx supabase start` + `npx supabase status`
4. Kör `npx prisma migrate deploy` mot Supabase's Postgres (port 54322)
5. Verifiera att hook + trigger + RLS-migrationer appliceras korrekt

### Fas 2: Uppdatera E2E seed

1. Uppdatera `e2e/setup/seed-e2e.setup.ts`:
   - Skapa testanvändare via `supabase.auth.admin.createUser()` istället för Prisma upsert
   - `handle_new_user`-triggern skapar automatiskt `public.User`-rader
   - Behåll Prisma-logik för provider-profil, tjänster, häst, availability (dessa berör inte auth)
   - Uppdatera provider-user till `userType: 'provider'` via Prisma efter auth-skapande (triggern sätter alltid 'customer')
2. Skapa Supabase admin-klient i seed:
   ```typescript
   import { createClient } from '@supabase/supabase-js'
   const supabaseAdmin = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY!
   )
   ```
3. Hantera idempotens: `createUser` med befintlig email ger error -- fånga och fortsätt

### Fas 3: Uppdatera GitHub Actions workflow

1. I `e2e-tests`-jobbet:
   - Ta bort separat `postgres`-service (Supabase's inbyggda Postgres används istället)
   - Installera Supabase CLI
   - Kör `npx supabase start`
   - Exportera nycklar från `supabase status` (dynamiskt, inte hårdkodade)
   - Uppdatera env:
     - `DATABASE_URL` -> `postgresql://postgres:postgres@localhost:54322/postgres`
     - `DIRECT_DATABASE_URL` -> samma
     - `NEXT_PUBLIC_SUPABASE_URL` -> `http://localhost:54321`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` -> från `supabase status`
     - `SUPABASE_SERVICE_ROLE_KEY` -> från `supabase status`
   - Ta bort legacy-env: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
   - Byt `npx prisma db push` till `npx prisma migrate deploy`
   - Ta bort `npx tsx prisma/seed-test-users.ts` (seed hanteras av Playwright setup)
2. Behåll separat `postgres`-service i `unit-tests`, `type-check`, `lint`, `build` (de behöver inte Supabase Auth)

### Fas 4: Verifiera

1. Kör E2E lokalt med `supabase start` för att verifiera hela flödet
2. Verifiera att `npm run test:e2e:smoke` passerar (auth.spec.ts + exploratory-baseline.spec.ts)
3. Pusha och verifiera att CI E2E-jobb passerar

## Risker

| Risk | Sannolikhet | Mitigation |
|------|------------|------------|
| `supabase start` tar lång tid i CI (~90s) | Hög | Acceptabelt, Docker-layer-cache möjlig senare |
| Prisma-migrationer failar mot Supabase Postgres | Låg | Verifierat i PoC (S10-5) |
| `handle_new_user`-triggern skapar inte User | Låg | Triggern testad i S14, `ON CONFLICT DO NOTHING` |
| Hook inte aktiverad -> JWT saknar claims | Medel | `config.toml`-konfiguration, verifieras i fas 1 |

## Filer som ändras

| Fil | Ändring |
|-----|---------|
| `supabase/config.toml` | NY -- lokal Supabase-konfiguration |
| `e2e/setup/seed-e2e.setup.ts` | ÄNDRA -- auth admin API istället för Prisma upsert |
| `.github/workflows/quality-gates.yml` | ÄNDRA -- supabase start i E2E-jobb |
| `.gitignore` | ÄNDRA -- ignorera `supabase/.temp/` |

## Säkerhetsnoteringar (från security-reviewer)

- `/api/test/reset-rate-limit` har NODE_ENV-guard (verifierat, rad 11) -- OK
- `supabase start`-nycklar är deterministiska/lokala -- inte hemligheter
- `config.toml` site_url pekar bara på localhost
- Inga nya test-only endpoints behövs

## Acceptanskriterier

- [ ] `supabase start` kör i GitHub Actions E2E-jobb
- [ ] E2E seed skapar användare via Supabase Auth admin API
- [ ] `npm run test:e2e:smoke` passerar i CI (auth.spec.ts + exploratory-baseline.spec.ts)
- [ ] Custom access token hook aktiverad (JWT innehåller claims)
- [ ] Prisma-migrationer (hook, trigger, RLS) appliceras via `migrate deploy`
- [ ] Unit tests, typecheck, lint, build påverkas INTE
