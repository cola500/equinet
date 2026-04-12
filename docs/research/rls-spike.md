---
title: "RLS Spike -- Row Level Security med Prisma + Supabase"
description: "Research-spike: kan RLS ge defense-in-depth for dataatkomst i Equinet?"
category: research
status: active
last_updated: 2026-04-01
tags: [security, rls, supabase, prisma, database]
sections:
  - Sammanfattning
  - Bakgrund
  - Fraga 1 -- RLS med Prisma direkt-anslutning
  - Fraga 2 -- Kraver det Supabase-klient
  - Fraga 3 -- RLS pa en tabell som proof-of-concept
  - Fraga 4 -- Prestanda-paverkan
  - Fraga 5 -- Serverless och PgBouncer
  - Booking-tabellens atkomstmonster
  - Implementationsalternativ
  - Rekommendation
  - Effort-uppskattning
  - Kallor
---

# RLS Spike -- Row Level Security med Prisma + Supabase

## Sammanfattning

**Rekommendation: Avvakta med RLS. Investera i applikationslagrets skydd istallet.**

RLS med Prisma + Supabase ar tekniskt möjligt men medfor betydande komplexitet.
Den storsta risken ar inte att det inte fungerar, utan att det skapar en falsk
trygghet -- policies som inte testas kontinuerligt kan bli inaktuella och skapa
subtila buggar. Var befintliga defense-in-depth (ownership-checks i routes,
atomic WHERE i repository, code review-checklist) ar mer underhallbar.

---

## Bakgrund

Equinet använder Prisma med direkt PostgreSQL-anslutning till Supabase. All
auktorisering sker i applikationslagret:

1. **Auth-check**: `auth()` i varje API route (NextAuth session)
2. **Ownership-check**: `providerId`/`customerId` fran session, aldrig fran request body
3. **Atomic WHERE**: Repository-metoder som `updateStatusWithAuth()` inkluderar
   ownership i WHERE-villkoret
4. **Code review**: Checklista i `.claude/rules/code-review-checklist.md` verifierar IDOR-skydd

Fragan ar om RLS i databasen kan ge ytterligare ett lager.

---

## Fraga 1 -- RLS med Prisma direkt-anslutning?

**Ja, men med begransningar.**

Prisma stodjer RLS genom Client Extensions (GA sedan v4.16.0). Monstret:

```typescript
// Skapa en extension som wrappar varje query i en transaction
const rlsPrisma = prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        const [, result] = await prisma.$transaction([
          prisma.$queryRaw`SELECT set_config('app.provider_id', ${providerId}, TRUE)`,
          query(args),
        ]);
        return result;
      },
    },
  },
});
```

`set_config(..., TRUE)` gor att installningen ar LOCAL -- den galler bara inom
den aktuella transaktionen. Detta ar sakert aven med connection pooling.

### Begransningar

1. **Varje query wrappas i en transaction** -- extra overhead
2. **Nested transactions fungerar inte** -- om du redan använder `$transaction`
   i din kod blir det problematiskt
3. **Raw queries (`$queryRaw`)** maste hanteras separat
4. **Prismas officiella exempel varnar**: "not intended for production environments"

---

## Fraga 2 -- Kraver det Supabase-klient?

**Nej, men Supabase-klienten gor det enklare.**

Tva vagar:

| Approach | Prisma direkt | Supabase JS-klient |
|----------|--------------|-------------------|
| RLS-context | `set_config()` i transaction | Automatiskt via JWT |
| Connection | Var befintliga `DATABASE_URL` | Supabase PostgREST API |
| Migrations | Prisma migrate (befintligt) | Supabase Dashboard/SQL |
| ORM-features | Allt fungerar | Inget ORM, query builder |
| Komplexitet | Hog (extension + policies) | Medel (byta ORM) |

Att byta till Supabase-klient for bokningsdata ar en **enorm omskrivning** --
vi har 83+ filer som använder `prisma.booking`. Det ar inte realistiskt.

---

## Fraga 3 -- RLS pa en tabell som proof-of-concept?

**Ja, Booking ar lamplig.**

Booking-tabellen har tydliga tenant-identifierare (`providerId`, `customerId`)
och ar var mest sakerhets-sensitiva tabell. En proof-of-concept skulle innebara:

### RLS-policy (skiss)

```sql
-- Aktivera RLS
ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;

-- Provider ser sina egna bokningar
CREATE POLICY provider_booking_access ON "Booking"
  USING ("providerId" = current_setting('app.provider_id', TRUE))
  WITH CHECK ("providerId" = current_setting('app.provider_id', TRUE));

-- Kund ser sina egna bokningar
CREATE POLICY customer_booking_access ON "Booking"
  USING ("customerId" = current_setting('app.customer_id', TRUE))
  WITH CHECK ("customerId" = current_setting('app.customer_id', TRUE));

-- Admin ser allt
CREATE POLICY admin_booking_access ON "Booking"
  USING (current_setting('app.is_admin', TRUE) = 'true');
```

### Problem med PoC

1. **Alla 83+ access-punkter** maste wrappas i en RLS-aware extension
2. **Admin-routes** (`/api/admin/bookings`) behover satta `app.is_admin`
3. **Cron-jobb och bakgrundsprocesser** har ingen session -- hur satts context?
4. **Prisma migrate** använder `DIRECT_DATABASE_URL` (postgres superuser) --
   RLS galler inte for table owner om inte `FORCE ROW LEVEL SECURITY` anvands
5. **Testmiljon**: Alla 3755 tester använder Prisma direkt -- maste koras
   utan RLS eller med en test-context

---

## Fraga 4 -- Prestanda-paverkan

**Liten men marbar.**

| Aspekt | Utan RLS | Med RLS |
|--------|---------|---------|
| Enkel query | 1 query | 1 transaction (BEGIN + SET + query + COMMIT) |
| Overhead | 0 | ~2-5ms per query (extra roundtrips) |
| Index-anvandning | Normal | RLS-villkor kan använde befintliga index |
| Komplex join | Normal | Varje tabell med RLS utvardera policy per rad |

For Equinet (lat-traffic, fa concurrent users) ar prestanda-paverkan
forsumbar. Men den extra transaktions-wrappningen okar latency marginellt.

**Index-stod**: Booking har redan index pa `[providerId, bookingDate, status]`
och `[customerId, bookingDate]`, sa RLS-villkoren ar snabba.

---

## Fraga 5 -- Serverless och PgBouncer

**Fungerar med transaction mode, INTE med statement mode.**

Supabase använder PgBouncer i **transaction mode** som default. Det innebar:

- Varje `BEGIN...COMMIT`-block garanteras samma fysiska anslutning
- `SET LOCAL` / `set_config(..., TRUE)` ar sakert inom en transaction
- Mellan transaktioner kan anslutningen atervinnas till en annan klient

**Kritiskt**: `SET` (utan LOCAL) ar **INTE sakert** med PgBouncer transaction
mode -- installningen kan lacka till nasta klients anslutning.

### Var konfiguration

```
DATABASE_URL="...?pgbouncer=true&connection_limit=1"   # Via PgBouncer
DIRECT_DATABASE_URL="..."                                # Direkt (migrations)
```

Prisma-extensionen maste använde `set_config(..., TRUE)` (local) --
aldrig `SET role` eller `SET app.provider_id`.

---

## Booking-tabellens atkomstmonster

### Nuvarande skydd (applikationslagret)

| Monster | Antal | Sakert? |
|---------|-------|---------|
| Repository med atomic WHERE | 12 anrop | Ja |
| Provider-scoped reads (`providerId` i WHERE) | 25+ anrop | Ja |
| Customer-scoped reads (`customerId` i WHERE) | 15+ anrop | Ja |
| Admin cross-tenant (requireAdmin) | 3 anrop | Ja (auth-skyddat) |
| Direkt `findById()` utan owner-filter | 5+ anrop | Beroende pa route |

### Identifierade risker

1. **`PrismaBookingRepository.findById()`** -- returnerar bokning utan
   ownership-check. Anroparen maste verifiera. RLS hade skyddat har.
2. **Nya routes som glommer WHERE-villkor** -- code review fangar detta
   idag, men RLS hade varit ett sakerhetsnat.

---

## Implementationsalternativ

### Alt 1: Full RLS med Prisma Extension (6-8 dagars arbete)

Skapa en Prisma Client Extension som:
1. Lagger `set_config()` i varje transaktion
2. Definiera RLS-policies for Booking (och ev. fler tabeller)
3. Hantera admin-context, cron-context, test-context
4. Uppdatera alla tester

**Fordelar**: Riktigt database-level skydd, fangar missade WHERE-villkor
**Nackdelar**: Hog komplexitet, alla queries wrappas i transaction, risk for
subtila buggar vid nested transactions, svar att underhalla policies

### Alt 2: Prisma Middleware (enklare, 2-3 dagars arbete)

Skapa en Prisma Extension som automatiskt lagger till `where.providerId`
eller `where.customerId` pa alla booking-queries. Ingen RLS i databasen.

```typescript
prisma.$extends({
  query: {
    booking: {
      findMany({ args, query }) {
        args.where = { ...args.where, providerId: currentProviderId };
        return query(args);
      },
    },
  },
});
```

**Fordelar**: Enklare, ingen databas-ändring, fungerar med befintliga tester
**Nackdelar**: Inte riktigt defense-in-depth (fortfarande app-niva), admin-undantag kravs

### Alt 3: Starka applikationslagret (0-1 dags arbete)

Forbattra det vi har:
1. Ta bort `findById()` fran BookingRepository -- ersatt med `findByIdForProvider()`
   och `findByIdForCustomer()` som ALLTID inkluderar ownership i WHERE
2. Lagg till lint-regel som varnar vid `prisma.booking.findUnique` utanfor repository
3. Forbattra code review-checklistan

**Fordelar**: Minimal effort, tydlig, testbar, ingen ny infrastruktur
**Nackdelar**: Ingen databas-niva skydd, beroende av disciplin

---

## Rekommendation

**Alt 3 -- Starka applikationslagret. Ateraktualisera RLS vid multi-tenant.**

### Motivering

1. **Equinet ar single-tenant per deployment idag**. En leverantör = en instans.
   RLS ger mest varde i multi-tenant-miljoer dar flera leverantörer delar databas.

2. **Komplexiteten ar for hog relativt risken.** 83+ access-punkter, nested
   transactions, admin/cron-undantag, testmiljo-konfiguration -- allt detta
   for att skydda mot en bugg-typ (missad WHERE) som code review redan fangar.

3. **Prisma + RLS ar inte production-ready.** Prismas eget officiella exempel
   varnar for produktionsanvandning. Community-bibliotek (prisma-extension-supabase-rls,
   prisma-rls) har begransad adoption och testning.

4. **Vi har bra befintligt skydd.** Atomic WHERE i repository, ownership-checks
   i routes, code review-checklista, IDOR-tester. Inga kanda sarbarheter.

### Nar RLS blir vart det

- Om vi gar till **multi-tenant** (flera leverantörer i samma databas)
- Om vi far en **sakerhetincident** relaterad till missad ownership-check
- Om **Prisma far forstaklassig RLS-support** (inte bara community-extensions)
- Om vi byter till **Supabase JS-klient** for delar av datalagret

### Konkreta forstarkningar (Alt 3)

Dessa kan goras som en liten story i nasta sprint:

1. Byt `findById()` till `findByIdForProvider(id, providerId)` och
   `findByIdForCustomer(id, customerId)` i BookingRepository
2. Lagg till ESLint-regel: `no-restricted-syntax` for `prisma.booking.find`
   utanfor `src/infrastructure/`
3. Lagg till i code review-checklistan: "Ny Booking-query? Kontrollera
   att providerId/customerId finns i WHERE"

---

## Effort-uppskattning

| Alternativ | Effort | Risk | Varde |
|-----------|--------|------|-------|
| Alt 1: Full RLS | 6-8 dagar | Hog (nested tx, tester) | Hogt (riktigt db-skydd) |
| Alt 2: Prisma middleware | 2-3 dagar | Medel (admin-undantag) | Medel (app-niva) |
| Alt 3: Starka app-lagret | 0.5-1 dag | Lag | Medel (bast ROI) |

---

## Kallor

- [Prisma Client Extensions -- Row Level Security (officiellt exempel)](https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security)
- [prisma-extension-supabase-rls (community)](https://github.com/dthyresson/prisma-extension-supabase-rls)
- [Supabase RLS dokumentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [prisma-rls -- Prisma extension for RLS](https://github.com/s1owjke/prisma-rls)
- [Prisma RLS discussion #12735](https://github.com/prisma/prisma/issues/12735)
- [PostgreSQL SET ROLE dokumentation](https://www.postgresql.org/docs/current/sql-set-role.html)
- [PgBouncer features](https://www.pgbouncer.org/features.html)
