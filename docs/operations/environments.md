---
title: "Miljoer (Environments)"
description: "Konfiguration och skillnader mellan lokal utveckling och produktion (Vercel + Supabase)"
category: operations
tags: [environments, vercel, supabase, docker, config]
status: active
last_updated: 2026-04-04
related:
  - deployment.md
  - ../../NFR.md
sections:
  - Oversikt
  - Lokal utveckling
  - Staging (PoC-projektet)
  - Produktion (Vercel + Supabase)
  - Miljovariabler per miljo
  - Deploy-ordning vid schemaandring
  - .env.local-fallgropen
---

# Miljoer (Environments)

---

## Oversikt

| Miljo | URL | Databas (Supabase) | Auth | Deploy |
|-------|-----|--------------------|------|--------|
| **Lokal** | `localhost:3000` | Docker PostgreSQL (localhost:5432) | Lokal Supabase (`supabase start`) | `npm run dev` |
| **Staging** | Vercel Preview | `zzdamokfeenencuggjjp` (eu-central-1) | Supabase Auth + RLS | Vercel Preview deploy |
| **Produktion** | `equinet-app.vercel.app` | `xybyzflfxnqqyxnvjklv` (eu-central-2) | Supabase Auth + RLS | `git push` -> Vercel auto-deploy |

---

## Lokal utveckling

### Databas

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/equinet
DIRECT_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/equinet
```

Startas med `npm run db:up` (Docker Compose, `postgres:17-alpine`).

### Miljovariabler

Konfigureras i `.env`. Se `.env.example` for alla tillgangliga variabler.

**Skillnader mot produktion:**
- Rate limiting: In-memory fallback (hogre granser)
- E-post: Loggad till konsol om `RESEND_API_KEY` saknas
- Stripe: Mock-gateway (`SUBSCRIPTION_PROVIDER="mock"`)
- Kryptering: Auto-genererad fallback-nyckel

### Feature flags

Alla feature flags ar styrda av:
1. **Miljovariabel** (hogst prioritet): `FEATURE_X=true` i `.env`
2. **Databas-override**: Via admin-panelen `/admin/system`
3. **Kod-default**: I `src/lib/feature-flag-definitions.ts`

---

## Staging (PoC-projektet)

- **Supabase-projekt:** `zzdamokfeenencuggjjp` (eu-central-1)
- **Ursprung:** Skapades som PoC for Supabase Auth (S10-5, S11-2)
- **Anvandning:** Vercel Preview-deployer, manuell testning fore prod-release
- **Data:** Samma seed-data som prod (migrerad i S11-2), men kan divergera
- **Credentials:** Sparas i `.env.local` (PoC-variabler)
- **RLS:** 28 policies + Custom Access Token Hook (samma som prod)

> Staging och prod delar samma Prisma-schema men har separata Supabase-projekt.
> Migrationer maste appliceras pa BADA miljerna.

---

## Produktion (Vercel + Supabase)

### Vercel

- **Region:** `fra1` (Frankfurt, matchar Supabase eu-central-2)
- **Konfiguration:** `vercel.json`
- **Miljovariabler:** Vercel Project Settings -> Environment Variables

### Supabase

- **Projekt:** `xybyzflfxnqqyxnvjklv` (eu-central-2, Frankfurt)
- **Auth:** Supabase Auth med Custom Access Token Hook (claims: userType, providerId, isAdmin)
- **RLS:** 30 policies pa 8 tabeller (Booking, Service, Horse, Payment, CustomerReview, User, Provider, BookingSeries)
- **Connection pooling:** PgBouncer (session mode port 5432, transaction mode port 6543)
- **`connection_limit=1`** i DATABASE_URL (krävs for serverless)

```
DATABASE_URL=postgresql://postgres.REF:PWD@pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1
DIRECT_DATABASE_URL=postgresql://postgres.REF:PWD@pooler.supabase.com:5432/postgres
```

> `DIRECT_DATABASE_URL` anvands for migrationer (kringgår PgBouncer).

### Cron-jobb

| Jobb | Schema (UTC) |
|------|-------------|
| Paminnelser | 08:00 dagligen |
| Bokningspaminnelser | 06:00 dagligen |

Autentiseras med `CRON_SECRET` (Bearer token).

---

## Miljovariabler per miljo

| Variabel | Lokal | Staging | Produktion | Anteckning |
|----------|-------|---------|------------|------------|
| `DATABASE_URL` | localhost | PoC pooler | Prod pooler | `connection_limit=1` i prod |
| `NEXT_PUBLIC_SUPABASE_URL` | Lokal Supabase | PoC URL | Prod URL | Auth + RLS |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Lokal | PoC anon key | Prod anon key | Publik, projektspecifik |
| `SUPABASE_SERVICE_ROLE_KEY` | Lokal | PoC service role | Prod service role | Hemlig, bypassar RLS |
| `UPSTASH_REDIS_REST_URL` | (tom = in-memory) | Prod Redis | Prod Redis | Rate limiting |
| `RESEND_API_KEY` | (tom = konsol-logg) | -- | Resend API-nyckel | E-post |
| `CRON_SECRET` | Valfri | -- | Stark slumpad | Cron-autentisering |
| `SUBSCRIPTION_PROVIDER` | `mock` | `mock` | `stripe` | Betalning |

---

## Deploy-ordning vid schemaandring

```
1. Committa andringar
2. git push (startar Vercel build)
3. npm run migrate:supabase  (FORE deploy nar klart!)
4. Verifiera i Vercel Dashboard
```

> **Kritiskt:** Migrationer MASTE appliceras INNAN Vercel-deployen nar produktionstrafik. Saknade migrationer ger 500-fel.

Se [deployment.md](deployment.md) for fullstandig deploy-guide.

---

## .env.local-fallgropen

Next.js prioriterar `.env.local` over `.env`. Om du har bade filer och de innehaller olika `DATABASE_URL`:

```
.env.local  -> Supabase (hogst prioritet)
.env        -> Lokal Docker (ignoreras)
```

**Losning:** Ta bort `.env.local` for lokal utveckling, eller uppdatera `DATABASE_URL` i bada filerna.

---

*Senast uppdaterad: 2026-04-04*
