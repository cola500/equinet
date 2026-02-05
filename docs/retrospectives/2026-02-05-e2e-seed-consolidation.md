# Retrospektiv: E2E Seed-script & Cleanup-konsolidering

**Datum:** 2026-02-05
**Fokus:** Konsolidera duplicerad E2E cleanup-logik, skapa enhetligt seed-script, ENV-styrning

---

## Resultat

| Metrisk | Fore | Efter | Forandring |
|---------|------|-------|------------|
| Duplicerade cleanup-block | 5 st | 1 st | -4 (single source of truth) |
| Rader cleanup-kod totalt | ~540 | ~95 | -445 rader |
| E2E tester som passerar | 84/86 | 84/86 | Oforandrat |
| Seed-script | 1 (bara availability) | 1 (allt) | Komplett seed |
| ENV-styrning | Ingen | 2 variabler | Nytt |

---

## Vad vi gjorde

### 1. Ny fil: `e2e/setup/cleanup-utils.ts`
Extraherade all cleanup-logik till en delad funktion `cleanupDynamicTestData()`. Raderar i FK-ordning: ghost users -> group bookings -> route stops -> routes -> route orders -> bookings -> services -> availability -> providers -> users. Anvander `KEEP_EMAILS` fran `e2e-utils.ts` (single source of truth).

### 2. Ny fil: `e2e/setup/seed-e2e.setup.ts`
Ersatter det gamla `seed-availability.setup.ts` med ett komplett seed-script som kor 7 steg:
1. **Miljoskydd** (`assertSafeDatabase()`)
2. **Upsert anvandare** (test@example.com + provider@example.com)
3. **Upsert provider-profil** (Test Stall AB)
4. **Upsert tjanster** (Hovslagning Standard 800kr, Ridlektion 500kr)
5. **Seed availability** for alla providers (man-fre 09-17)
6. **Reset + seed route orders** (4 customer-initiated i Goteborgsomradet + 1 provider-announced)
7. **Reset + seed bokningar** (1 pending om 7 dagar + 1 confirmed om 14 dagar)
8. **Upsert hast** (E2E Blansen)

### 3. Forenklad `e2e/fixtures.ts`
~120 rader inline cleanup ersatt med en import: `await cleanupDynamicTestData(prisma)`.

### 4. Forenklad `e2e/setup/cleanup.setup.ts`
~200 rader -> 26 rader. Anvander `shouldSkipCleanup()` for `E2E_CLEANUP=false`.

### 5. Rensade spec-filer
Tog bort duplicerad beforeEach-cleanup fran:
- `booking.spec.ts` (~80 rader)
- `route-planning.spec.ts` (~130 rader)
- `announcements.spec.ts` (~90 rader)

### 6. Uppdaterad `playwright.config.ts`
Setup-projekt pekar nu specifikt pa `seed-e2e.setup.ts` istallet for en bred `.*\.setup\.ts`-match.

### 7. Borttagen `seed-availability.setup.ts`
Ersatts helt av seed-e2e.setup.ts.

---

## Vad gick bra

### 1. Dramatisk kodreduktion
540 rader duplicerad cleanup-kod -> 95 rader pa ett stalle. Varje framtida andring behovs bara goras en gang.

### 2. Route-planning-tester skippar inte langre
Fore: route-planning.spec.ts skippade ofta pga saknad testdata. Nu seedas 4 pending route orders varje gang, sa testerna har alltid data att jobba med.

### 3. Idempotent seed
Upsert for users/provider/services (skapar bara om de inte finns), delete+recreate for route orders/bookings (garanterar fraskt tillstand). Kan koras hur manga ganger som helst utan problem.

### 4. ENV-styrning
- `E2E_CLEANUP=false` -- bevarar testdata efter korning for debugging
- `E2E_ALLOW_REMOTE_DB=true` -- tillater korning mot hostad Supabase-dev

---

## Vad kunde vi gora battre

### 1. `assertSafeDatabase()` var for strikt
Planen antog lokal databas, men vi anvander hostad Supabase for utveckling. Behov av `E2E_ALLOW_REMOTE_DB` override uppstod forst vid korning. **Lardom:** Testa sakerhetssparrar mot faktisk miljo innan implementering.

### 2. Kvarstaende pre-existing failures (2 st)
- `horses.spec.ts:95` -- hast-radering rakning stammer inte (31 -> 31)
- `route-planning.spec.ts:47` -- heading saknas pa ruttdetalj-sidan efter skapande

Dessa ar inte orsakade av vara andringar men bor fixas i nasta session.

### 3. Seed-bokningar hamnar inte i "mina bokningar"-vy
`booking.spec.ts:317` ("display empty state") och `booking.spec.ts:278` ("cancel a booking") verkar inte hitta de seedade bokningarna. Kan bero pa att seed-bokningens datum/tid inte matchar vad UI:n filtrerar pa. Bor undersokas.

---

## Nyckelbeslut

| Beslut | Motivering |
|--------|-----------|
| afterEach cleanup kors ALLTID (poverkas inte av E2E_CLEANUP) | Stabilitet viktigare an debug-bekvamlighet |
| Seed identifierar data via `specialInstructions: 'E2E seed data'` / `customerNotes: 'E2E seed data'` | Enkel identifiering utan att behova trackra ID:n |
| Cleanup raderar INTE seed-data | Seed-scriptet aterstar allt vid nasta korning anda |
| Weekend (lor-son) ar stangda i availability | Matchar realistiskt scenario, forhindrar test-flakiness pa helger |

---

## Filer andrade

| Fil | Andring |
|-----|---------|
| `e2e/setup/e2e-utils.ts` | Lade till `E2E_ALLOW_REMOTE_DB` override |
| `e2e/setup/cleanup-utils.ts` | **NY** -- delad cleanup-funktion |
| `e2e/setup/seed-e2e.setup.ts` | **NY** -- enhetligt seed-script |
| `e2e/fixtures.ts` | Forenklad med import fran cleanup-utils |
| `e2e/setup/cleanup.setup.ts` | Forenklad med cleanup-utils + ENV-check |
| `playwright.config.ts` | Specifik testMatch for seed-e2e |
| `e2e/setup/seed-availability.setup.ts` | **BORTTAGEN** |
| `e2e/booking.spec.ts` | Rensad beforeEach |
| `e2e/route-planning.spec.ts` | Rensad beforeEach |
| `e2e/announcements.spec.ts` | Rensad beforeEach |
| `.env` | Lade till `E2E_ALLOW_REMOTE_DB=true` |

---

## Nasta steg

1. Fixa pre-existing failures (horses delete, route-planning heading)
2. Undersok varfor seed-bokningar inte syns i "mina bokningar"-vyn
3. Overvag att lagga till `E2E_ALLOW_REMOTE_DB` i `.env.example`
4. Sprint 2 F2-5 (Test Data Management Strategy) kan markeras som **klar**
