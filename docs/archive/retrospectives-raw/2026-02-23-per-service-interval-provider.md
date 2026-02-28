# Retrospektiv: Leverantorens aterbesoksintervall per tjanst

**Datum:** 2026-02-23
**Scope:** Utoka HorseServiceInterval fran `[horseId, providerId]` till `[horseId, providerId, serviceId]` sa leverantoren far samma per-tjanst-granularitet som kunden.

---

## Resultat

- 12 andrade filer, 1 ny fil (migration), 1 ny migration
- ~83 nya tester (fran 2314 till 2397), alla TDD, alla grona
- 2397 totala tester (inga regressioner)
- 18/18 E2E due-for-service tester grona
- Typecheck = 0 errors, Lint = 0 errors
- Supabase-migration applicerad fore push
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| Schema | `prisma/schema.prisma` | `serviceId` + Service-relation pa HorseServiceInterval, ny unique constraint |
| Migration | `prisma/migrations/.../migration.sql` | DDL + datamigering (3 steg: add column, migrate data, constraints) |
| API Route | `provider/horses/[horseId]/interval/route.ts` | GET returnerar lista + availableServices, PUT/DELETE kraver `serviceId` |
| API Test | `provider/horses/[horseId]/interval/route.test.ts` | 17 tester (uppdaterade + nya) |
| Domain | `DueForServiceService.ts` | Override map nyckel: `horseId:serviceId` |
| Domain | `DueForServiceLookup.ts` | Override map nyckel: `horseId:serviceId` |
| Domain | `ReminderService.ts` | Compound key: `horseId_providerId_serviceId` |
| Domain Test | `DueForServiceService.test.ts` | 1 nytt test: ignorerar override for annan tjanst |
| Domain Test | `DueForServiceLookup.test.ts`, `ReminderService.test.ts` | Mock-data uppdaterad med serviceId |
| API Route | `provider/due-for-service/route.ts` | Override map nyckel: `horseId:serviceId` |
| API Test | `provider/due-for-service/route.test.ts` | Mock-data uppdaterad med serviceId |
| UI | `horse-timeline/[horseId]/page.tsx` | Lista av per-tjanst-intervall med tjanstval, auto-fill, filtrera anvanda tjanster |

## Vad gick bra

### 1. Konsistent pattern-andring over alla lager
Samma logiska andring (byt nyckel fran `horseId` till `horseId:serviceId`) applicerades konsistent i 3 domain-filer + 2 API routes. Alla foljer samma monster -- inga specialfall.

### 2. Kundsidans monsterkopia
API-routen kopierade framgangsrikt monster fran `customer/horses/[horseId]/intervals/route.ts` -- samma Zod-schema, samma GET-response-format (`{ intervals, availableServices }`), samma upsert/delete-logik. Snabb implementation tack vare befintligt monster.

### 3. TDD fangade threshold-bugg
Det nya testet "ignores provider override for different service" failade initialt pa fel grund -- inte koden utan testdatan. 25 dagar med 6-veckorsintervall = 17 dagars marginal > 14 dagars "upcoming"-threshold = "ok" status som filtreras bort. TDD-cykeln avslojde missforstandet direkt.

### 4. Datamigrering med minimal risk
Migrationen expanderar befintliga rader (1 rad -> N rader, en per tjanst fran bokningshistorik) och tar bort originalet. Rader utan matchande bokningar forsvinner -- acceptabelt da de anda inte paverkar due-for-service-berakningar.

## Vad kan forbattras

### 1. Migrationsordning i SQL
Datamigreringssteget forsakte insertera nya rader innan den gamla unique constrainten `(horseId, providerId)` droppades, vilket gav duplicate key error. Fixades genom att flytta DROP INDEX fore DO-blocket.

**Prioritet:** HOG -- migrationer maste testas i ratt ordning. Alltid tanka pa befintliga constraints fore datamigrering.

### 2. `prisma migrate resolve --applied` fore faktisk SQL-korning
Migrationen markerades som "applied" pa lokala DB:n innan SQL:en faktiskt korts, vilket skapade schema-drift. Maste sedan kora SQL:en manuellt via docker exec.

**Prioritet:** MEDEL -- korn alltid SQL forst, markera sedan.

## Patterns att spara

### Per-service override map pattern
Nar en tabell utvidgas fran `(entityId)` till `(entityId, serviceId)`, andras Map-nyckeln fran `entityId` till `` `${entityId}:${serviceId}` ``. Uppslagningen andras pa exakt samma satt i alla konsumenter. Monstret ar identiskt i DueForServiceService, DueForServiceLookup, och provider due-for-service route.

### Migration med constraint-andring + datamigrering
Ordning: (1) Add nullable column + FK, (2) DROP old constraint, (3) Data migration, (4) SET NOT NULL + CREATE new constraint. Att droppa den gamla constrainten FORE datamigrering ar kritiskt nar nya rader kan krocka med den.

## 5 Whys (Root-Cause Analysis)

### Problem: Migrerings-SQL failade med duplicate key violation
1. Varfor? INSERT failade pa unique constraint `(horseId, providerId)`
2. Varfor? Gamla constrainten var kvar nar datamigreringsblocket korde
3. Varfor? DROP INDEX lag EFTER DO-blocket i SQL-filen
4. Varfor? Migrationen skrevs i "logisk ordning" (add -> migrate -> finalize) utan att tanka pa att constraints maste bort fore expansion
5. Varfor? Ingen checklista for migrationer med constraint-andringar + datamigrering

**Atgard:** Dokumentera migration-ordning i CLAUDE.md: "Vid constraint-andring + datamigrering: ALLTID droppa gamla constrainten FORE datamigreringssteget."
**Status:** Implementerad (i denna retro)

## Larandeeffekt

**Nyckelinsikt:** Vid schema-utvidgning (fran 1-nyckel till N-nycklar) ar andringen mekaniskt enkel men kraver noggrant i tre dimensioner: (1) alla konsumenter av Map-nyckeln, (2) alla compound keys i Prisma-queries, (3) migrationsordningen for constraints. Anvand grep for att hitta alla `overrideMap.get(` och alla `horseId_providerId` fore implementation.
