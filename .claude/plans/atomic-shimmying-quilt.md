# Plan: E2E-tester för offline mutations

## Kontext

Offline mutations (Fas 2) implementerades nyss med 58 unit-tester. Alla passerar, men vi har inte verifierat att flödet fungerar end-to-end i en riktig browser med service worker. Vi behöver Playwright E2E-tester som testar:
1. Mutation köas vid offline + optimistic UI visas
2. Sync sker vid online-återgång
3. Data stämmer med servern efteråt

## Scope

Utöka befintlig `e2e/offline-pwa.spec.ts` med en ny `test.describe('Offline Mutations')` sektion. Testerna kräver `OFFLINE_E2E=true` (production build med aktiv service worker).

## Ändrade filer

| Fil | Ändring |
|-----|---------|
| `e2e/offline-pwa.spec.ts` | Ny `Offline Mutations` describe-block med 3 tester |

## Testplan

Alla tester:
- `test.skip(!process.env.OFFLINE_E2E, ...)` -- körs bara via `npm run test:e2e:offline`
- Seedar data i `beforeAll` med `seedBooking()` + `seedRoute()` + `SPEC_TAG = 'offline-mut'`
- Loggar in som provider i `beforeEach`
- Rensar i `afterAll` med `cleanupSpecData()`

### Test 1: Bokning markeras genomförd offline med optimistic UI

```
1. Login som provider, gå till /provider/bookings, vänta på networkidle
2. context.setOffline(true)
3. Klicka "Markera som genomförd" på seedad confirmed-bokning
4. Verifiera: toast "sparas offline", badge "Väntar på synk" visas
5. Verifiera: bokningens status visas som "Genomförd" (optimistic)
6. context.setOffline(false)
7. Vänta på sync (banner "synkade" eller badge försvinner)
8. Ladda om sidan -- status är fortfarande "Genomförd" (persisterad)
```

### Test 2: Ruttstopp markeras klart offline

```
1. Login som provider, gå till /provider/routes/[id], vänta på networkidle
2. context.setOffline(true)
3. Klicka "Påbörja besök" eller "Markera som klar"
4. Verifiera: optimistic update + badge
5. context.setOffline(false)
6. Vänta på sync
7. Ladda om -- status persisterad
```

### Test 3: Deduplicering -- dubbel mutation köas inte

```
1. Login, gå till /provider/bookings, offline
2. Klicka "Markera som genomförd"
3. Klicka samma knapp igen (eller liknande trigger)
4. Verifiera: toast "redan sparad offline"
5. Online, sync, verifiera bara 1 mutation synkad
```

## Seed-data

```typescript
const SPEC_TAG = 'offline-mut'

// beforeAll:
await seedBooking({ specTag: SPEC_TAG, status: 'confirmed', daysFromNow: 3 })
await seedRoute(SPEC_TAG)  // Skapar rutt med 2 pending stopp
```

## Befintliga patterns att följa

- Import `{ test, expect }` från `./fixtures` (dismissar cookie notice)
- `page.request.post('/api/test/reset-rate-limit').catch(() => {})` i `beforeEach`
- `context.setOffline(true/false)` för nätverkskontroll
- `page.waitForLoadState('networkidle')` för att pre-populera cache
- `test.skip(!process.env.OFFLINE_E2E, 'Requires production build...')` på describe-nivå

## Köra testerna

```bash
npm run test:e2e:offline
```

Detta bygger PWA automatiskt, startar på port 3001, och kör `offline-chromium` projektet.

## Verifiering

- Alla nya tester gröna med `npm run test:e2e:offline`
- Befintliga offline-tester fortfarande gröna
- `npm run typecheck` passerar (inga TS-ändringar)
