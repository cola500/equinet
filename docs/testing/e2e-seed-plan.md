# Plan: Stabilt E2E seed-script med kontrollerad cleanup

## Sammanfattning

Skapa ett enhetligt seed-script som Playwright kör automatiskt, konsolidera duplicerad cleanup-logik till en delad funktion, och lägg till ENV-styrning + miljöskydd.

## Nuläge (problem)

- Cleanup duplicerad i **5 ställen**: fixtures.ts afterEach, cleanup.setup.ts, booking/route-planning/announcements beforeEach
- Route orders seedas **manuellt** (inte automatiserat) - tester skippar ofta pga saknad data
- `seed-test-users.ts` skapar bokningar med `Date.now()+1` som blir inaktuella
- Ingen ENV-kontroll för cleanup, inget miljöskydd
- `keepEmails`-array hårdkodad på 5 ställen

## Nya/ändrade filer

### 1. `e2e/setup/e2e-utils.ts` (NY) - REDAN SKAPAD
Delad utility med:
- `assertSafeDatabase()` - kastar fel om DATABASE_URL ser ut som produktion (`.supabase.co` utan localhost)
- `shouldSkipCleanup()` - returnerar true om `E2E_CLEANUP=false`
- `KEEP_EMAILS` - `['test@example.com', 'provider@example.com']` (single source of truth)
- `futureDate(days)` / `pastDate(days)` - datumhjälpare

### 2. `e2e/setup/seed-e2e.setup.ts` (NY - ersätter seed-availability.setup.ts)
Enhetligt seed-script som kör som Playwright setup-projekt. Steg:

1. **Miljöskydd**: `assertSafeDatabase()`
2. **Upsert användare**: test@example.com (kund) + provider@example.com (leverantör)
3. **Upsert provider-profil**: "Test Stall AB", Stockholm
4. **Upsert tjänster**: "Hovslagning Standard" (800kr/60min), "Ridlektion" (500kr/45min)
5. **Seed availability**: Alla providers (från prisma/seed.ts också), mån-fre 09-17
6. **Reset + seed route orders**: Ta bort befintliga E2E route stops/routes/orders, skapa 4 nya med status `pending` i Göteborgsområdet + 1 provider-announced annons
7. **Seed bokningar**: Ta bort befintliga E2E-bokningar, skapa:
   - 1x pending (om 7 dagar) - för avbokningstester
   - 1x confirmed (om 14 dagar) - för betalningstester
8. **Seed häst**: Upsert "E2E Blansen" kopplad till testkunden

Alla seed-bokningar markeras med `horseName` som börjar med `E2E` eller `customerNotes: 'E2E seed data'` för identifiering.

Route orders identifieras via `specialInstructions: 'E2E seed data'` eller adressmönster.

### 3. `e2e/setup/cleanup-utils.ts` (NY)
Extraherar cleanup-logik till en delad funktion `cleanupDynamicTestData(prisma)`:
- Raderar i FK-ordning: ghost users, group bookings, route stops, routes, route orders, bookings, services, availability, providers, users
- Använder `KEEP_EMAILS` från e2e-utils.ts
- Raderar INTE E2E seed-data (bara dynamisk data från tester som auth.spec.ts)

### 4. `e2e/fixtures.ts` (ÄNDRA)
Ersätt ~120 rader inline cleanup med:
```typescript
import { cleanupDynamicTestData } from './setup/cleanup-utils'
await cleanupDynamicTestData(prisma)
```
afterEach kör **alltid** (påverkas inte av E2E_CLEANUP).

### 5. `e2e/setup/cleanup.setup.ts` (ÄNDRA)
Förenkla till:
```typescript
import { cleanupDynamicTestData } from './cleanup-utils'
import { shouldSkipCleanup } from './e2e-utils'
if (!shouldSkipCleanup()) await cleanupDynamicTestData(prisma)
```
Styrs av `E2E_CLEANUP=false` - hoppar över slutrensning för debugging.

### 6. `playwright.config.ts` (ÄNDRA)
Uppdatera setup-projekt:
- `testMatch: /seed-e2e\.setup\.ts/` (specifik match istället för bred `.*\.setup\.ts`)
- Behåll cleanup-projekt oförändrat

### 7. Ta bort `e2e/setup/seed-availability.setup.ts` (TA BORT)
Ersätts av steg 5 i seed-e2e.setup.ts.

### 8. Rensa beforeEach i spec-filer (ÄNDRA)
Ta bort duplicerad cleanup från:
- `e2e/booking.spec.ts` (rad ~5-86) - behåll bara login
- `e2e/route-planning.spec.ts` (rad ~5-136) - behåll bara login
- `e2e/announcements.spec.ts` (rad ~5-97) - behåll bara login

Dessa är redundanta nu när fixtures afterEach + seed-script sköter allt.

## Implementationsordning

1. Skapa `e2e/setup/e2e-utils.ts` (KLAR)
2. Skapa `e2e/setup/cleanup-utils.ts` (extrahera befintlig logik)
3. Uppdatera `e2e/fixtures.ts` att använda cleanup-utils
4. Uppdatera `e2e/setup/cleanup.setup.ts` att använda cleanup-utils + ENV-check
5. Skapa `e2e/setup/seed-e2e.setup.ts`
6. Uppdatera `playwright.config.ts`
7. Ta bort `e2e/setup/seed-availability.setup.ts`
8. Rensa beforeEach i booking/route-planning/announcements spec-filer
9. Kör hela E2E-sviten - verifiera grönt
10. Kör med `E2E_CLEANUP=false` - verifiera att data finns kvar efter körning

## Verifiering

1. `npx playwright test` - alla tester ska passera
2. `E2E_CLEANUP=false npx playwright test` - data ska finnas kvar efteråt
3. `npx playwright test` igen direkt - ska fortfarande vara stabilt
4. Route-planning tester ska INTE skippa (seed ger pending orders varje gång)
5. Booking cancel-test ska ha bokningar att avboka
6. `npm run typecheck` ska passera

## Nyckelprinciper

- **Idempotent seed**: upsert för users/providers/services, delete+recreate för route orders/bookings
- **E2E_CLEANUP=false** påverkar bara global teardown, INTE afterEach (stabilitet)
- **Miljöskydd**: assertSafeDatabase() i alla destruktiva operationer
- **Single source of truth**: KEEP_EMAILS definierat en gång i e2e-utils.ts
- **Befintliga konventioner**: Återanvänder @example.com-mönstret, E2E-prefix, Göteborg-adresser
