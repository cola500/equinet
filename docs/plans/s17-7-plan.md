---
title: "S17-7: Byt lokal dev till supabase start"
description: "Ersatt Docker PostgreSQL med supabase start for lokal utveckling"
category: plan
status: active
last_updated: 2026-04-05
sections:
  - Bakgrund
  - Nuvarande setup
  - Approach
  - Steg
  - Risker
  - Acceptanskriterier
---

# S17-7: Byt lokal dev till supabase start

## Bakgrund

Sprint 16 retro identifierade tre problem med nuvarande Docker PostgreSQL:
1. **RLS-divergens**: Docker har inga RLS-policies, Supabase har 28 st
2. **Saknade triggers**: custom_access_token_hook finns inte i Docker
3. **Migrationer ej applicerade**: Prisma-migrationer och Supabase-migrationer kan vara ur synk

`supabase start` loser alla tre -- det kor samma infrastruktur som Supabase Cloud:
auth, RLS, triggers, GoTrueAuth, PostgREST etc.

## Nuvarande setup

- `docker-compose.yml`: postgres:17-alpine pa port 5432
- `npm run db:up/down/nuke`: docker compose kommandon
- `.env`: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/equinet`
- `supabase/config.toml`: finns redan, DB port 54322, auth port 54321
- 41 Prisma-migrationer i `prisma/migrations/`
- Supabase CLI installerat (v2.75.0)
- Inga Supabase-migrationer i `supabase/migrations/`

## Approach

**Stegvis migrering** -- behall Docker Compose som fallback.

Nyckelinsikt: Prisma `migrate dev` kopplar direkt till PostgreSQL (port 54322),
inte via PostgREST. Supabase start exponerar PostgreSQL pa port 54322 med
user `postgres` och password `postgres` (default). Sa Prisma fungerar som vanligt,
men nu far vi auth + RLS + triggers pa kopet.

Prisma-migrationer appliceras mot Supabase-DB:n via `prisma migrate dev`.
Custom access token hook-migrationen (20260403120000) kor SQL som skapar
funktionen och GRANTs -- detta fungerar aven mot lokal Supabase.

## Steg

### Fas 1: Uppdatera npm-scripts

1. Andra `db:up` fran `docker compose up -d --wait` till `supabase start`
2. Andra `db:down` fran `docker compose down` till `supabase stop`
3. Andra `db:nuke` fran `docker compose down -v` till `supabase db reset`
4. Lagga till `db:status` -> `supabase status` (visa portar/URL:er)

### Fas 2: Uppdatera .env och .env.example

1. `.env.example`: Byt default DATABASE_URL till Supabase-portar (54322)
2. `.env.example`: Uppdatera instruktioner
3. `.env`: Uppdatera DATABASE_URL till `postgresql://postgres:postgres@localhost:54322/postgres`
4. `.env`: Satt Supabase-nycklar fran `supabase status` output

**OBS**: Supabase lokal DB heter `postgres` (inte `equinet`).

### Fas 3: Verifiera

1. `npm run db:up` (supabase start)
2. `npx prisma migrate dev` (applicera alla 41 migrationer)
3. `npm run db:seed` (seeda testdata)
4. `npm run dev` (starta app, logga in)
5. Kontrollera att auth + custom_access_token_hook fungerar

### Fas 4: Uppdatera docs

1. README.md: Uppdatera prerequisites (Docker Desktop -> Docker Desktop for Supabase)
2. README.md: Uppdatera setup-instruktioner och kommandotabell
3. `.env.example`: Tydliga instruktioner
4. Behall `docker-compose.yml` som fallback (kommentera i README)

### Fas 5: CI-paverkan

- CI kors med separat testdatabas (`equinet_test` i GitHub Actions)
- CI använder INTE `db:up` -- migrationer kors direkt
- **Ingen CI-paverkan forvantad** -- vi andrar bara lokala dev-scripts

## Risker

| Risk | Sannolikhet | Åtgärd |
|------|-------------|--------|
| Prisma migrate mot Supabase-roller (supabase_auth_admin etc) krockar | Lag | Testa lokalt, GRANTs i migration.sql fungerar |
| Port-konflikt om Docker PostgreSQL ocksa kors | Lag | Dokumentera: kor `db:down` pa Docker forst |
| supabase start ar langsammare an docker compose | Medel | Acceptabelt -- ger mer korrekt miljo |
| Lokala Supabase-nycklar lacker till repo | Lag | Nycklarna ar lokala och kastas vid `supabase stop` |

## Acceptanskriterier

- [ ] `npm run db:up` startar lokal Supabase (auth + DB + triggers)
- [ ] `npm run db:down` stoppar lokal Supabase
- [ ] `npm run db:nuke` aterställer databasen (raderar all data)
- [ ] Prisma-migrationer appliceras mot lokal Supabase utan fel
- [ ] custom_access_token_hook fungerar lokalt
- [ ] Seed-scripts fungerar
- [ ] README uppdaterad med nya instruktioner
- [ ] Docker Compose behalls som dokumenterad fallback
- [ ] Inga CI-forandringar kravs
