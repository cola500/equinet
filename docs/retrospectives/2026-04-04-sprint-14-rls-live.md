---
title: "Retrospektiv: Sprint 14 -- RLS Live"
description: "28 RLS-policies, 3 route-migreringar till Supabase-klient, 24 bevistester"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan forbattras
  - Patterns att spara
  - 5 Whys
  - Larandeeffekt
---

# Retrospektiv: Sprint 14 -- RLS Live

**Datum:** 2026-04-04
**Scope:** Aktivera RLS (Row Level Security) pa alla karndomaner, bevisa att det fungerar, och migrera 3 GET-routes fran Prisma till Supabase-klient.

---

## Resultat

- 17 andrade/nya filer, 2 nya migrationer
- 44 nya tester (24 RLS-bevis + 20 migration-validering)
- 3968 totala tester (inga regressioner)
- Typecheck = 0 errors, Lint = 0 errors
- 4 stories (S14-5, S14-2, S14-3, S14-4) i en session
- 28 RLS-policies totalt pa Supabase (13 SELECT + 15 WRITE)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Migration | `20260404130000_rls_write_policies/migration.sql` | 15 WRITE-policies pa 6 tabeller |
| Test (RLS-bevis) | `src/__tests__/rls/rls-proof.integration.test.ts` | 24 tester mot Supabase (alla 7 tabeller) |
| Test (helpers) | `src/__tests__/rls/supabase-test-helpers.ts` | Seed, cleanup, klient-factories |
| Test (migration) | `prisma/migrations/__tests__/rls-write-policies.test.ts` | 20 SQL-valideringstester |
| API Route | `src/app/api/bookings/route.ts` | Provider GET bytt till Supabase-klient |
| API Route | `src/app/api/services/route.ts` | GET bytt till Supabase-klient |
| API Route | `src/app/api/notifications/route.ts` | GET bytt till Supabase-klient |
| Test | 3 route.test.ts | Mock bytt fran Prisma till Supabase |
| Docs | 4 done-filer, 2 planer, status.md | Sprint-dokumentation |

## Vad gick bra

### 1. RLS-bevistesterna avslojde att migration inte var deployad
Testerna failade omedelbart (12/24) -- inte pga buggar i testkoden utan for att S14-1 migration aldrig applicerats pa Supabase. Utan dessa tester hade vi trott att RLS var aktivt nar det inte var det. Testerna ar vart varje minut av investering.

### 2. Mekanisk migrering efter etablerat monster
S14-2 tog langst tid (etablerade PostgREST select-syntax, mock-monster, beteendeandring fran 404 till tom lista). S14-3 (Services + Notifications) var copy-paste pa 15 minuter. S14-4 (write-policies) foljde S14-1:s migration-validering-monster. Investering i S14-2 betalade sig direkt.

### 3. Subagent-reviews fangade schema-fel i planen
Tech-architect hittade 1 blocker (CustomerReview saknade bookingId), 2 majors (Payment faltnamn, JWT-claim check). Alla fixades innan implementation. Utan reviews hade seedningen kraschat och kravt debugging.

### 4. Snabb feedback-loop med Supabase
Hela cykeln (skapa testanvandare -> seed -> query -> verifiera -> cleanup) tog ~7 sekunder. Snabbare an E2E, bevisar mer an unit-tester. Bra sweet spot for sakerhetstestning.

## Vad kan forbattras

### 1. Migration-deployment saknar automatisering
S14-1 var mergad till main men aldrig deployad till Supabase. Vi upptackte det bara for att S14-5 testade mot live. Det borde finnas en deploy-checklista eller CI-steg som verifierar att migrationer ar applicerade.

**Prioritet:** HOG -- en migration som aldrig deployas kan ge falsk sakerhetskanstand.

### 2. Provider/customers-route kunde inte migreras
GET /api/provider/customers använder 5 Prisma-queries med groupBy och komplex aggregering. PostgREST stodjer inte detta. Behover antingen Supabase RPC (server-side function) eller behallas pa Prisma.

**Prioritet:** LAG -- defense-in-depth genom RLS read-policies racker. Route-migrering ar bonus.

### 3. Supabase MCP autentisering misslyckades
Tva forsoek att autentisera Supabase MCP-verktygen lyckades inte. Migrationer applicerades via manuellt script med Prisma $executeRawUnsafe istallet. Fungerade men ar inte idealt.

**Prioritet:** MEDEL -- MCP-integration borde vara smidigare.

## Patterns att spara

### Supabase RLS test-monster
```
1. seedTestData() med service_role (kringgår RLS)
2. signInWithPassword() for autentiserade klienter
3. verifyJwtClaims() som guard mot falska grona
4. Deterministiska b0-prefix UUIDs for enkel cleanup
5. try/catch i cleanup for att undvika maskering av testfel
```
Ateranvandbart for alla framtida RLS-tester.

### PostgREST select med relationer
```typescript
supabase.from("Booking").select(`
  id, ...,
  customer:User!customerId(firstName, lastName),   // FK-hint
  payment:Payment(id, status)                      // Auto-detect
`)
```
Forward relations: `Table!column`. Reverse relations: auto-detect.

### vi.mock for Supabase-klient i Vitest
```typescript
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}))
// I test:
vi.mocked(createSupabaseServerClient).mockResolvedValue({
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [...], error: null }),
    }),
  }),
} as never)
```
Kedja from().select().order() med vi.fn().mockReturnValue.

## 5 Whys (Root-Cause Analysis)

### Problem: S14-1 migration var mergad men inte deployad till Supabase
1. Varfor? Migrationen var bara lokalt -- aldrig kopplad till Supabase.
2. Varfor? Vi har ingen automatisk deploy av SQL-migrationer till Supabase.
3. Varfor? Prisma migrate deploy kopplar till lokal Docker, inte Supabase.
4. Varfor? Supabase-projektet har ingen CI/CD-pipeline for migrationer.
5. Varfor? Migrationsdeployment har behandlats som manuellt steg utan verifiering.

**Åtgärd:** Lagg till ett CI-steg eller npm-script som jamfor lokala migrationer med Supabase (`_prisma_migrations`-tabell). `npm run migrate:status` finns redan men kors inte automatiskt.
**Status:** Att gora

### Problem: ENABLE ROW LEVEL SECURITY saknades pa 2 tabeller
1. Varfor? BookingSeries och CustomerReview hade policies men RLS var inte aktiverat.
2. Varfor? S14-1 skapade policies men koerde inte ALTER TABLE ENABLE RLS.
3. Varfor? PoC (S10) hade aktiverat RLS pa 5 tabeller men inte de 2 som lades till i S14-1.
4. Varfor? S14-1 planen antog att RLS redan var aktiverat pa alla tabeller.
5. Varfor? Ingen verifiering av `pg_tables.rowsecurity` i testsviten.

**Åtgärd:** RLS-bevistesterna (S14-5) fangar nu detta. Aven: lagg till ENABLE RLS i framtida migrations om nya tabeller laggs till.
**Status:** Implementerad (S14-5 tester bevisar)

## Larandeeffekt

**Nyckelinsikt:** RLS-tester mot live infrastruktur ar det enda sattet att bevisa sakerhet. Lokala tester (migration-validering, spike-script) fanger syntax och logik, men missar deployment-gap. De 24 RLS-bevistesterna avslojde tva kritiska problem (saknad deployment + saknad ENABLE RLS) som ingen annan testtyp kunde hitta.
