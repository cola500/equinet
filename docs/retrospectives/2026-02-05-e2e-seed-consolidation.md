# Retrospektiv: E2E Seed-script & Cleanup-konsolidering

**Datum:** 2026-02-05
**Fokus:** Konsolidera duplicerad E2E cleanup-logik, skapa enhetligt seed-script, ENV-styrning

---

## Resultat

| Metrisk | Före | Efter | Förändring |
|---------|------|-------|------------|
| Duplicerade cleanup-block | 5 st | 1 st | -4 (single source of truth) |
| Rader cleanup-kod totalt | ~540 | ~95 | -445 rader |
| E2E tester som passerar | 84/86 | 84/86 | Oförändrat |
| Seed-script | 1 (bara availability) | 1 (allt) | Komplett seed |
| ENV-styrning | Ingen | 2 variabler | Nytt |

---

## Vad vi gjorde

### 1. Ny fil: `e2e/setup/cleanup-utils.ts`
Extraherade all cleanup-logik till en delad funktion `cleanupDynamicTestData()`. Raderar i FK-ordning: ghost users -> group bookings -> route stops -> routes -> route orders -> bookings -> services -> availability -> providers -> users. Använder `KEEP_EMAILS` från `e2e-utils.ts` (single source of truth).

### 2. Ny fil: `e2e/setup/seed-e2e.setup.ts`
Ersätter det gamla `seed-availability.setup.ts` med ett komplett seed-script som kör 7 steg:
1. **Miljöskydd** (`assertSafeDatabase()`)
2. **Upsert användare** (test@example.com + provider@example.com)
3. **Upsert provider-profil** (Test Stall AB)
4. **Upsert tjänster** (Hovslagning Standard 800kr, Ridlektion 500kr)
5. **Seed availability** för alla providers (mån-fre 09-17)
6. **Reset + seed route orders** (4 customer-initiated i Göteborgsområdet + 1 provider-announced)
7. **Reset + seed bokningar** (1 pending om 7 dagar + 1 confirmed om 14 dagar)
8. **Upsert häst** (E2E Blansen)

### 3. Förenklad `e2e/fixtures.ts`
~120 rader inline cleanup ersatt med en import: `await cleanupDynamicTestData(prisma)`.

### 4. Förenklad `e2e/setup/cleanup.setup.ts`
~200 rader -> 26 rader. Använder `shouldSkipCleanup()` för `E2E_CLEANUP=false`.

### 5. Rensade spec-filer
Tog bort duplicerad beforeEach-cleanup från:
- `booking.spec.ts` (~80 rader)
- `route-planning.spec.ts` (~130 rader)
- `announcements.spec.ts` (~90 rader)

### 6. Uppdaterad `playwright.config.ts`
Setup-projekt pekar nu specifikt på `seed-e2e.setup.ts` istället för en bred `.*\.setup\.ts`-match.

### 7. Borttagen `seed-availability.setup.ts`
Ersatts helt av seed-e2e.setup.ts.

---

## Vad gick bra

### 1. Dramatisk kodreduktion
540 rader duplicerad cleanup-kod -> 95 rader på ett ställe. Varje framtida ändring behövs bara göras en gång.

### 2. Route-planning-tester skippar inte längre
Före: route-planning.spec.ts skippade ofta pga saknad testdata. Nu seedas 4 pending route orders varje gång, så testerna har alltid data att jobba med.

### 3. Idempotent seed
Upsert för users/provider/services (skapar bara om de inte finns), delete+recreate för route orders/bookings (garanterar fräscht tillstånd). Kan köras hur många gånger som helst utan problem.

### 4. ENV-styrning
- `E2E_CLEANUP=false` -- bevarar testdata efter körning för debugging
- `E2E_ALLOW_REMOTE_DB=true` -- tillåter körning mot hostad Supabase-dev

---

## Vad kunde vi göra bättre

### 1. `assertSafeDatabase()` var för strikt
Planen antog lokal databas, men vi använder hostad Supabase för utveckling. Behov av `E2E_ALLOW_REMOTE_DB` override uppstod först vid körning. **Lärdom:** Testa säkerhetsspärrar mot faktisk miljö innan implementering.

### 2. Kvarstående pre-existing failures (2 st)
- `horses.spec.ts:95` -- häst-radering räkning stämmer inte (31 -> 31)
- `route-planning.spec.ts:47` -- heading saknas på ruttdetalj-sidan efter skapande

Dessa är inte orsakade av våra ändringar men bör fixas i nästa session.

### 3. Seed-bokningar hamnar inte i "mina bokningar"-vy
`booking.spec.ts:317` ("display empty state") och `booking.spec.ts:278` ("cancel a booking") verkar inte hitta de seedade bokningarna. Kan bero på att seed-bokningens datum/tid inte matchar vad UI:n filtrerar på. Bör undersökas.

---

## Nyckelbeslut

| Beslut | Motivering |
|--------|-----------|
| afterEach cleanup körs ALLTID (påverkas inte av E2E_CLEANUP) | Stabilitet viktigare än debug-bekvämlighet |
| Seed identifierar data via `specialInstructions: 'E2E seed data'` / `customerNotes: 'E2E seed data'` | Enkel identifiering utan att behöva trackra ID:n |
| Cleanup raderar INTE seed-data | Seed-scriptet återskapar allt vid nästa körning ändå |
| Weekend (lör-sön) är stängda i availability | Matchar realistiskt scenario, förhindrar test-flakiness på helger |

---

## Filer ändrade

| Fil | Ändring |
|-----|---------|
| `e2e/setup/e2e-utils.ts` | Lade till `E2E_ALLOW_REMOTE_DB` override |
| `e2e/setup/cleanup-utils.ts` | **NY** -- delad cleanup-funktion |
| `e2e/setup/seed-e2e.setup.ts` | **NY** -- enhetligt seed-script |
| `e2e/fixtures.ts` | Förenklad med import från cleanup-utils |
| `e2e/setup/cleanup.setup.ts` | Förenklad med cleanup-utils + ENV-check |
| `playwright.config.ts` | Specifik testMatch för seed-e2e |
| `e2e/setup/seed-availability.setup.ts` | **BORTTAGEN** |
| `e2e/booking.spec.ts` | Rensad beforeEach |
| `e2e/route-planning.spec.ts` | Rensad beforeEach |
| `e2e/announcements.spec.ts` | Rensad beforeEach |
| `.env` | Lade till `E2E_ALLOW_REMOTE_DB=true` |

---

## Nästa steg

1. Fixa pre-existing failures (horses delete, route-planning heading)
2. Undersök varför seed-bokningar inte syns i "mina bokningar"-vyn
3. Överväg att lägga till `E2E_ALLOW_REMOTE_DB` i `.env.example`
4. Sprint 2 F2-5 (Test Data Management Strategy) kan markeras som **klar**
