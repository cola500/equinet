---
title: "RLS + Prisma Spike -- Resultat"
description: "S10-1: Kan Prisma anvanda set_config + SET ROLE for att RLS-filtrera Booking-tabellen?"
category: research
status: active
last_updated: 2026-04-03
sections:
  - Sammanfattning
  - Testresultat
  - Prestandamatning
  - Supabase-begransningar
  - Produktionsskiss
  - VARNING -- Deploy-ordning
  - Rekommendation
---

# RLS + Prisma Spike -- Resultat

## Sammanfattning

**Fragestellning:** Kan Prisma anvanda `set_config('app.provider_id', ...)` i
transaktioner for att RLS-filtrera Booking-tabellen per provider?

**Svar: JA -- fungerar lokalt. Supabase kraver anpassad rollhantering.**

Monster: `SET ROLE rls_app_user` + `set_config` + query i `$transaction`,
sedan `RESET ROLE`. Alla 8 tester grona mot lokal Docker PostgreSQL.

## Testresultat

Korda mot lokal Docker PostgreSQL 17. Schema-isolation via `?schema=rls_test`.

| # | Test | Resultat | Tid |
|---|------|----------|-----|
| 1 | Prisma + set_config i $transaction | **PASS** -- Provider A ser 3, Provider B ser 3 | 16ms |
| 2 | Utan set_config (negativ-test) | **PASS** -- 0 rader (RLS blockerar) | 1ms |
| 3 | Separat Prisma-klient (ny connection) | **PASS** -- Fräsch klient fungerar identiskt | 15ms |
| 4 | $queryRawUnsafe med RLS | **PASS** -- Raw queries filtreras korrekt | 2ms |
| 5 | Prestanda (100 queries) | **PASS** -- 1.1ms overhead per query | 154ms |
| 6 | Session-lackage mellan transaktioner | **PASS** -- 0 rader (ingen lackage) | 3ms |
| 7 | Concurrent access (parallella transaktioner) | **PASS** -- Isolerade, ingen korsning | 10ms |
| 8 | Ingen-policy-fallback (deny-by-default) | **PASS** -- Tabell utan policy = 0 rader | 3ms |

### Testdetaljer

**Test 1 (karntest):** `SET ROLE rls_app_user` + `set_config('app.provider_id', X, TRUE)` +
`SELECT FROM Booking` i en `$transaction`. Varje provider ser BARA sina bokningar.

**Test 2 (negativ):** Utan `set_config` returnerar `current_setting` NULL, och policyn
`"providerId" = NULL` matchar inget -> 0 rader. Bekraftar att RLS ar default-deny.

**Test 6 (lackage):** `set_config` med `is_local=TRUE` scopas till transaktionen.
Nasta transaktion har inget varde -> 0 rader. Ingen risk for att en provider
"arver" en annans session.

**Test 7 (concurrent):** Tva parallella `Promise.all`-transaktioner med olika
provider-IDs returnerar korrekta resultat. `set_config` kopplas till
transaktionens snapshot, inte till Prisma-klientens connection.

**Test 8 (deny-by-default):** Service-tabellen har `ENABLE + FORCE ROW LEVEL SECURITY`
men INGEN policy. Resultat: 0 rader aven med `set_config`. Bekraftar att en
glomd policy = ingen data, INTE all data. Detta ar kritiskt for sakerheten.

## Prestandamatning

100 iterationer, lokal Docker PostgreSQL:

| Metod | Total | Per query |
|-------|-------|-----------|
| Med RLS (SET ROLE + set_config + query i transaktion) | 130ms | **1.3ms** |
| Baseline (superuser, ingen RLS) | 24ms | **0.2ms** |
| **Overhead** | 106ms | **1.1ms** |

**Bedomning:** 1.1ms overhead ar acceptabelt. I produktion (Supabase, nätverkslatens ~50ms)
gor detta minimal skillnad. Transaktionskostnaden domineras av natverksroundtrip,
inte av `set_config` + `SET ROLE`.

## Supabase-begransningar

Spike:n avslojde tre begransningar i Supabase som paverkar RLS-implementation:

### 1. `postgres`-rollen har BYPASSRLS

Supabase-projektets `postgres`-roll har `rolbypassrls = true`. Det betyder att
RLS-policies ALDRIG appliceras for `postgres`. `FORCE ROW LEVEL SECURITY` paverkar
bara table owner, inte roller med `BYPASSRLS`.

**Konsekvens:** Vi kan INTE anvanda `postgres`-rollen for RLS-skyddade queries.

### 2. SET ROLE blockeras av Supabase-poolern

Supavisor (Supabase connection pooler) blockerar `SET ROLE` med
`ERROR: permission denied to set role "rls_app_user"`.

**Konsekvens:** `SET ROLE`-monsteert (som fungerar lokalt) funkar INTE via Supabase pooler.

### 3. Custom roller kan inte ansluta via poolern

Supavisor tillater bara fordefinierade roller (`postgres`, `authenticated`, `anon`,
`service_role`). Custom roller som `rls_app_user` far
`FATAL: There is no user 'rls_app_user' in the database`.

**Konsekvens:** Vi kan INTE ansluta som en dedicerad app-roll via poolern.

### Alternativa approaches for Supabase

| Approach | Fungerar? | Anteckning |
|----------|-----------|------------|
| `SET ROLE` i transaktion | Nej | Blockeras av Supavisor |
| Direkt-anslutning som custom roll | Nej | Port 5432 pa `db.xxx.supabase.co` var ej nabar |
| `set_config` utan `SET ROLE` (som postgres) | Nej | `BYPASSRLS` kringgår alla policies |
| Anvanda `authenticated`-rollen | Mojlig | Behovs Supabase client-SDK, inte Prisma |
| Byta till `supabase-js` for RLS-queries | Mojlig | Supabase client kor som `authenticated` |
| Ta bort `BYPASSRLS` fran `postgres` | Nej | Kraver superuser, `postgres` ar inte superuser i Supabase |

**Mest lovande alternativ:** Hybrid -- behall Prisma for mutationer och admin-queries,
anvand `supabase-js` (som kor som `authenticated`) for RLS-skyddade reads.
Alternativt: kontakta Supabase support om att aktivera `SET ROLE` for `postgres`.

## Produktionsskiss: Prisma Client Extension

Om Supabase-begransningarna loses (t.ex. via `SET ROLE` eller dedicated role), sa ar
detta den rekommenderade wrappern:

```typescript
// src/lib/prisma-rls.ts
import { PrismaClient } from '@prisma/client'

export function withRLS(prisma: PrismaClient) {
  return prisma.$extends({
    query: {
      $allOperations({ args, query, operation }) {
        // Only apply to read operations on RLS-protected tables
        if (operation === 'findMany' || operation === 'findFirst' || operation === 'findUnique') {
          // The actual implementation would wrap in $transaction with SET ROLE + set_config
          // Requires providerId from request context (e.g., AsyncLocalStorage)
        }
        return query(args)
      }
    }
  })
}
```

**Pattern for API routes:**

```typescript
// Pseudokod -- kraver att SET ROLE fungerar
const bookings = await prisma.$transaction([
  prisma.$executeRawUnsafe(`SET ROLE rls_app_user`),
  prisma.$queryRawUnsafe(`SELECT set_config('app.provider_id', $1, TRUE)`, providerId),
  prisma.booking.findMany({ where: { status: 'confirmed' } }),
])
await prisma.$executeRawUnsafe(`RESET ROLE`)
```

**OBS:** Prisma ORM-queries (`.findMany()`, `.findFirst()`) i `$transaction` respekterar
`search_path` och `set_config` -- men detta kraver verifiering i en separat spike
(detta spike testade bara `$queryRawUnsafe`).

## VARNING -- Deploy-ordning

**FORCE ROW LEVEL SECURITY far INTE aktiveras i produktion forran en wrapper ar
pa plats som ALLTID kor `set_config` fore varje query.**

Deploy-ordning:

1. **Wrapper forst** -- Prisma Client Extension som kor `SET ROLE` + `set_config` i varje transaktion
2. **FORCE sedan** -- `ALTER TABLE "Booking" FORCE ROW LEVEL SECURITY`
3. **Policy sist** -- `CREATE POLICY booking_provider_read ...`

Om steg 2 kors utan steg 1: **alla Prisma-queries returnerar 0 rader** =
total applikationskrasch. Inga bokningar, inga tjanster, ingenting.

## Rekommendation

### Go -- RLS fungerar med Prisma (lokalt)

RLS + Prisma ar bevisat: `SET ROLE` + `set_config` i `$transaction` ger korrekt
filtrering, ingen lackage, acceptabel prestanda (1.1ms overhead).

### Blockerare -- Supabase-pooler

Supabase-poolern blockerar `SET ROLE` och custom roller. Innan RLS kan deployeas
i produktion maste en av dessa losas:

| Losning | Effort | Risk |
|---------|--------|------|
| Kontakta Supabase support om SET ROLE | Lagt | Kan ta tid, kanske inte mojligt |
| Hybrid: supabase-js for reads, Prisma for writes | Medel | Tva connection-managers |
| Migrera bort fran Supabase pooler (direkt-anslutning) | Medel | Begransat antal connections |
| Bygga eget connection-proxy-lager | Hogt | Overkill for vart behov |

### Nasta steg

1. **Undersok Supabase-pooler**: Kan `SET ROLE` aktiveras? Kontakta support.
2. **Testa Prisma ORM-queries**: Verifiera att `.findMany()` (inte bara raw) fungerar med `SET ROLE` + `set_config`.
3. **Prototypa Prisma Client Extension**: Wrapper som automatiskt injicerar `SET ROLE` + `set_config`.
4. **Bestam approach for Supabase**: Baserat pa support-svar, valj hybrid eller annan losning.
