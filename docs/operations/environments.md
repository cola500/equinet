---
title: "Miljoer (Environments)"
description: "Konfiguration och skillnader mellan lokal utveckling, staging och produktion. Sedan 2026-05-06 har staging fullständig isolation (egen domain, separat Supabase, separat DB)."
category: operations
tags: [environments, vercel, supabase, ios, config]
status: active
last_updated: 2026-05-08
related:
  - deployment.md
  - staging-environment-setup.md
  - url-configuration.md
  - ../../NFR.md
sections:
  - Oversikt
  - env-hierarki
  - Lokal utveckling
  - Staging
  - Produktion (Vercel + Supabase)
  - iOS-scheman
  - Miljovariabler per miljo
  - Deploy-ordning vid schemaandring
  - .env.local-fallgropen
---

# Miljoer (Environments)

---

## Oversikt

| Miljö | Webb-URL (custom domain) | Vercel branch-URL (fallback) | Supabase-projekt | Auth | Deploy |
|-------|---------------------------|-------------------------------|------------------|------|--------|
| **Lokal** | `http://localhost:3000` | — | Lokal CLI (`127.0.0.1:54321`) | Supabase CLI | `npm run dev` |
| **Staging** | `https://equinet-staging.johanlindengard.com` | `equinet-app-git-staging-cola500s-projects.vercel.app` | `zzdamokfeenencuggjjp` (eu-central-1, Frankfurt) | Supabase Auth + RLS | Push till `staging`-branch |
| **Produktion** | `https://equinet.johanlindengard.com` | `equinet-app.vercel.app` (kvar tills cutover) | `xybyzflfxnqqyxnvjklv` (eu-central-2, Zurich) | Supabase Auth + RLS | Push till `main`-branch |

> **Custom domains skapade 2026-05-06.** Båda pekar på Vercel-projektet `equinet-app` via samma CNAME-target (`58f6e9422ba8b696.vercel-dns-017.com`) — Vercel routar via Host-header. Se [url-configuration.md](url-configuration.md) för matrisen.

> **iOS-not:** iOS-appen använder `zzdamokfeenencuggjjp` för **både** staging och produktion tills Apple Developer Program är köpt (separat bundle ID + prod-projekt). Intentionellt — dokumenterat beslut från S48-1.

---

## env-hierarki

Next.js läser miljövariabler i denna prioritetsordning (högst överst):

```
.env.local          ← TRUMFAR ALLT. Vercel CLI skriver hit med vercel env pull.
.env.development    ← Endast i dev-läge. Aldrig i CI.
.env                ← Standard. Committad version är .env.example.
```

**Kontrollera aktiv miljö:** `npm run status` — visar grön "lokal" eller röd varning vid remote.

**VARNING:** `vercel env pull` skapar `.env.local` med produktionsnycklar (remote `DATABASE_URL`, remote Supabase-URL). Kommentera bort dessa för lokal dev. Se [gotchas.md #23](../guides/gotchas.md#23-vercel-env-pull-overskrider-lokal-config).

---

## Lokal utveckling

### Databas

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DIRECT_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Startas med `npm run db:up` (`supabase start` — Supabase CLI, ersatte Docker Compose i S17-7).

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

## Staging

- **URL:** `https://equinet-staging.johanlindengard.com` (custom domain, sedan 2026-05-06)
- **Vercel branch-URL:** `equinet-app-git-staging-cola500s-projects.vercel.app` (fortfarande live, parallell access)
- **Supabase-projekt:** `zzdamokfeenencuggjjp` ("slot machine", eu-central-1, Frankfurt)
- **Ursprung:** Skapades som PoC for Supabase Auth (S10-5, S11-2). Block 2 (2026-05-06) gjorde det till fullständigt isolerad staging.
- **Anvandning:** Manuell testning fore prod-release. Deployar vid push till `staging`-branch.
- **Data:** Helt separat från prod — egna 24 users, 5 providers, 8 services. **Inga prod-bokningar/data.**
- **Schema:** 45 migrations applied (synkad med prod via `prisma migrate deploy` mot staging-pooler).
- **RLS:** Custom Access Token Hook aktiv (samma kod som prod, separat installation).
- **Deployment Protection:** Vercel SSO aktiv (kräver Vercel-login för att se). Toggle off om extern delning behövs.

**Deploytrigger:**
```bash
git checkout staging && git merge main && git push origin staging
# Vercel deployas automatiskt ~3 min
```

**Vercel env-vars (Preview, branch=`staging`):**
- `DATABASE_URL` — staging-pooler (transaction mode, port 6543)
- `DIRECT_DATABASE_URL` — staging-direct (port 5432)
- `NEXT_PUBLIC_SUPABASE_URL` — `https://zzdamokfeenencuggjjp.supabase.co`
- `APP_URL` — `https://equinet-staging.johanlindengard.com`

> Staging och prod har **separata Supabase-projekt och separata Vercel env-rader** — migrationer maste appliceras pa BADA. Se [staging-environment-setup.md](staging-environment-setup.md) för fullständig setup-procedur.

---

## Produktion (Vercel + Supabase)

### Vercel

- **Region:** `fra1` (Frankfurt) — matchar Supabase eu-central-2 (Zurich) inom AWS Frankfurt-AZ
- **Custom domain:** `https://equinet.johanlindengard.com` (sedan 2026-05-06)
- **Vercel branch-URL:** `https://equinet-app.vercel.app` (kvarstår tills cutover, kan tas bort senare)
- **Konfiguration:** `vercel.json`
- **Miljovariabler:** Vercel Project Settings -> Environment Variables

### Supabase

- **Projekt:** `xybyzflfxnqqyxnvjklv` ("equine-app", eu-central-2, Zurich)
- **Auth:** Supabase Auth med Custom Access Token Hook (claims: userType, providerId, isAdmin)
- **RLS:** 30 policies pa 8 tabeller (Booking, Service, Horse, Payment, CustomerReview, User, Provider, BookingSeries)
- **Connection pooling:** PgBouncer (session mode port 5432, transaction mode port 6543)
- **`connection_limit=1`** i DATABASE_URL (krävs for serverless)
- **Site URL:** `https://equinet.johanlindengard.com`
- **Redirect URLs allowlist:** innehåller både ny och gammal domän under cutover-perioden

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
| `DISABLE_CRONS` | -- | `true` (i isolerat staging-projekt) | -- (FAR ALDRIG vara satt) | Skip-flagga for cron-jobb. Pre-build-guard avvisar prod-deploy om DISABLE_CRONS=true. |
| `SUBSCRIPTION_PROVIDER` | `mock` | `mock` | `stripe` | Betalning |

### DISABLE_CRONS — anvandning

`DISABLE_CRONS=true` far cron-routes (`/api/cron/*`) att returnera `200 { skipped: true, reason: "DISABLE_CRONS" }` istallet for att exekvera. Anvands i isolerade staging/preview-projekt dar Vercel klassar staging-branch som production (vilket annars triggar duplicerade cron-jobb mot staging-DB).

**Belt-and-suspenders i staging-projekt:**
1. `DISABLE_CRONS=true` (explicit guard, syns i kod)
2. `CRON_SECRET` satts INTE (om guarden av nagon anledning hoppas over → `verifyCronAuth` returnerar 401, ingen exekvering)

**Skydd mot misstag:** `scripts/check-prod-env.ts` har en `checkCronsEnabled`-funktion som kor i pre-build pa Vercel Production. Om `DISABLE_CRONS=true` upptäcks pa production faller bygget med tydligt felmeddelande.

**Sla av guarden i staging:** ta bort env-flaggan (eller satt `false`) → cron-routes kor som vanligt vid nasta deploy. Reversibelt utan kodandring.

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

## iOS-scheman

iOS-appen väljer miljö via `AppEnvironment` i `AppConfig.swift`:

| Schema | Trigger | Webb-URL | Supabase |
|--------|---------|----------|----------|
| **Local** (DEBUG, default) | Bygg i Xcode | `http://localhost:3000` | `127.0.0.1:54321` (CLI) |
| **Staging** (DEBUG + `-STAGING`) | Launch arg `-STAGING` | `https://equinet-git-staging-cola500.vercel.app` | `zzdamokfeenencuggjjp` |
| **Production** (RELEASE) | Archive-build | `https://equinet-app.vercel.app` | `zzdamokfeenencuggjjp`* |

*) iOS prod använder staging Supabase-projekt tills Apple Developer Program aktiveras (separat bundle ID + prod-projekt).

**Sätta staging i Xcode:**
Product → Scheme → Edit Scheme → Run → Arguments → Lägg till `-STAGING`

---

## .env.local-fallgropen

Se [gotchas.md #23](../guides/gotchas.md#23-vercel-env-pull-overskrider-lokal-config) for fullstandig beskrivning.

Kort sammanfattning: `vercel env pull` skriver `.env.local` med **remote** `DATABASE_URL` och Supabase-nycklar.
Kommentera bort dessa rader for lokal dev. Kör `npm run status` for att verifiera aktiv miljo.
