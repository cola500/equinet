---
title: E2E Suite Review
description: Genomlysning av nuvarande E2E-testsvit mot playbook-principer
category: testing
status: current
last_updated: 2026-03-29
sections:
  - Övergripande bedömning
  - Smoke-tests
  - Kritiska flöden
  - Regressioner
  - Tester som borde flyttas ned
  - Oklara eller tveksamma tester
  - Troliga flaky-risker
  - Rekommenderad nästa åtgärd
---

# E2E Suite Review

## Övergripande bedömning

35 spec-filer, ~250 tester, serial execution (workers: 1). Sviten täcker bredd men är ojämn i djup. De flesta specs följer bra mönster (seed/cleanup, rate-limit reset, role-selektorer). Huvudproblemen är:

1. **14 av 35 specs använder waitForTimeout()** -- flaky-risk
2. **Några specs testar saker som bättre hör hemma i unit-tester** (security headers, API enforcement, feature flag 404:or)
3. **feature-flag-toggle.spec.ts har 23 tester** -- för brett, testar varje flagga exhaustivt istället för att verifiera mönstret
4. **Offline-specs kräver separat miljö** (OFFLINE_E2E=true) -- dyr att köra, sällan kört

Sviten är **för stor för att köras som standard**, men **rimlig som selektiv verifiering** vid UI-ändringar.

---

## Smoke-tests

| Spec | Tester | Bedömning | Rekommendation |
|------|--------|-----------|----------------|
| `exploratory-baseline.spec.ts` | 10 | Bra smoke: verifierar att alla sidor laddar utan JS-fel. Inkluderar dashboard-knappar och admin-sidor. | BEHÅLL |
| `security-headers.spec.ts` | 7 | Verifierar HTTP-headers, inte UI-flöden. Ren API-kontroll. | FLYTTA NED -- borde vara unit/integration |
| `visual-regression.spec.ts` | 10 | Screenshot-baselines för alla huvudsidor. Bra för att fånga oväntade layoutskift. | BEHÅLL |

---

## Kritiska flöden

| Spec | Tester | Vad det bevisar | Bedömning | Rekommendation |
|------|--------|-----------------|-----------|----------------|
| `auth.spec.ts` | 6 | Registrering + login + logout. Smoke (login fungerar) + kritiskt flöde (registrering skapar konto). | Rätt nivå, dubbel roll. | BEHÅLL |
| `booking.spec.ts` | 8 | Sök -> välj leverantör -> boka -> avboka. Mest kritiska kundflödet. | Rätt nivå. Några waitForTimeout. | BEHÅLL, FÖRBÄTTRA waits |
| `payment.spec.ts` | 8 | Betala bokning, kvitto, fakturanummer, dubbelbetalningsskydd. | Rätt nivå, stabil. | BEHÅLL |
| `provider.spec.ts` | 9 | Dashboard, tjänster CRUD, bokningshantering. Leverantörens kärna. | Rätt nivå, brett men motiverat. | BEHÅLL |
| `calendar.spec.ts` | 10 | Veckovy, tillgänglighet, undantag, bokningsvisning. | Rätt nivå. Flaky-risk: waitForTimeout på 5 ställen. | BEHÅLL, FÖRBÄTTRA waits |
| `reschedule.spec.ts` | 8 | Ombokning: dialog, kalender, max-gräns, leverantörsinställning. | Rätt nivå, flerstegsflöde. | BEHÅLL |
| `no-show.spec.ts` | 5 | Markera uteblivna, badge i kundlista, kalendervisning. | Rätt nivå. | BEHÅLL |
| `manual-booking.spec.ts` | 2 | Manuell bokning med ny kund (ghost user). | Rätt nivå, kort och fokuserad. | BEHÅLL |
| `recurring-bookings.spec.ts` | 14 | Settings, dialog, badges, API enforcement, flaggbeteende. | Rätt nivå men för bred: 14 tester i en spec. | FÖRBÄTTRA -- dela i 2-3 grupper |

---

## Regressioner

| Spec | Tester | Vad det låser | Bedömning | Rekommendation |
|------|--------|---------------|-----------|----------------|
| `accepting-new-customers.spec.ts` | 3 | Toggle + amber banner. Regression: banner syntes inte korrekt. | Rätt nivå, kort. | BEHÅLL |
| `customer-reviews.spec.ts` | 4 | Recensionsflöde: visa knapp, skicka, krav på rating. | Rätt nivå. | BEHÅLL |
| `unsubscribe.spec.ts` | 4 | HMAC-token-validering för email-unsubscribe. | Gränsfall: kunde vara integration-test, men verifierar hel sida. | BEHÅLL |

---

## Tester som borde flyttas ned till lägre nivå

| Spec | Tester | Varför flytta | Rekommendation |
|------|--------|---------------|----------------|
| `security-headers.spec.ts` | 7 | Testar HTTP-response-headers, inte UI. Ren API-kontroll som borde vara route.test.ts. | FLYTTA NED |
| `feature-flag-toggle.spec.ts` (API enforcement-delen) | ~8 av 23 | Testar att API returnerar 404 när flagga är av. Borde vara unit-test per route. | FLYTTA NED (de 8), BEHÅLL resten (~15) |
| `route-announcement-notification.spec.ts` | 4 | Testar backend-logik (notifieringar skapas i DB). Polllar Prisma, inte UI. | FLYTTA NED -- borde vara integration-test |

---

## Oklara / tveksamma tester

| Spec | Tester | Fråga | Rekommendation |
|------|--------|-------|----------------|
| `customer-insights.spec.ts` | 3 | Beror på extern AI-tjänst med 30s timeout. Flaky i CI om tjänsten är långsam. | PARKERA -- kör bara manuellt |
| `business-insights.spec.ts` | 5 | Verifierar att KPI-kort laddar, men inte att siffrorna stämmer. Värdet av E2E här är oklart. | FÖRBÄTTRA -- antingen verifiera siffror eller flytta ned |
| `flexible-booking.spec.ts` | 6 | Täcker nischfunktion (flexibel bokning). Oklart hur ofta det körs i praktiken. | BEHÅLL men lågprioriterad |
| `group-bookings.spec.ts` | 5 | Geo-filter och gruppförfrågningar. Seed via Prisma (inte UI). | BEHÅLL men lågprioriterad |

---

## Troliga flaky-risker

**Specs med waitForTimeout() (14 st):**

| Spec | Antal waitForTimeout | Risk |
|------|---------------------|------|
| `announcements.spec.ts` | 3 (500ms-2000ms) | MEDEL |
| `booking.spec.ts` | 2 (1000-2000ms) | MEDEL |
| `calendar.spec.ts` | 5 (500-2000ms) | HÖG |
| `flexible-booking.spec.ts` | 2 (1000-2000ms) | MEDEL |
| `follow-provider.spec.ts` | 1 (500ms) | LÅG |
| `municipality-watch.spec.ts` | 1 (500ms) | LÅG |
| `route-planning.spec.ts` | 2 (1000-2000ms) | MEDEL |

**Andra flaky-risker:**
- `customer-insights.spec.ts` -- extern AI-tjänst, 30s timeout
- `offline-mutations.spec.ts` -- IndexedDB-polling, 30s timeout
- `offline-pwa.spec.ts` -- Service Worker-beroende
- `visual-regression.spec.ts` -- Screenshot-jämförelse känslig för rendering-skillnader

---

## Rekommenderad nästa åtgärd

### Kort sikt (opportunistiskt)

1. **Flytta security-headers.spec.ts till route-test** -- 7 tester som inte behöver browser. Enklast att göra.
2. **Ersätt waitForTimeout i calendar.spec.ts** -- mest flaky-utsatt spec (5 timeouts). Byt till `waitForResponse()` eller `toBeVisible()`.
3. **Dela recurring-bookings.spec.ts** -- 14 tester i en fil är för mycket. Dela i settings/UI/API-grupper.

### Medellång sikt

4. **Flytta API enforcement-tester från feature-flag-toggle.spec.ts** till route.test.ts. Behåll nav-synlighets-testerna i E2E.
5. **Flytta route-announcement-notification.spec.ts** till integration-test. Prisma-polling i E2E är fel abstraktionsnivå.

### Gör inte nu

- Offline-specs (kräver separat miljö, sällan körda, svåra att fixa)
- Visual regression (fungerar, lågt underhåll)
- customer-insights (extern AI-beroende, parkerad)

---

## Provrunda: Förslag

Kör dessa 6 specs som representativt urval (~45 tester):

**Smoke (2):**
- `exploratory-baseline.spec.ts` (10 tester) -- laddar alla sidor
- `visual-regression.spec.ts` (10 tester) -- screenshot-baselines

**Kritiska flöden (3):**
- `auth.spec.ts` (6 tester) -- login/registrering
- `booking.spec.ts` (8 tester) -- kundbokning
- `provider.spec.ts` (9 tester) -- leverantörsvy

**Flaky-kandidat (1):**
- `calendar.spec.ts` (10 tester) -- mest waitForTimeout, bra stresstest

```bash
npx playwright test \
  e2e/exploratory-baseline.spec.ts \
  e2e/visual-regression.spec.ts \
  e2e/auth.spec.ts \
  e2e/booking.spec.ts \
  e2e/provider.spec.ts \
  e2e/calendar.spec.ts
```

## Provrundan: Utfall (2026-03-29)

Provrunda kördes med 6 specs. Resultat: 47 pass, 24 fail, 13 skip, 8.6 min.

- **auth, booking, calendar, exploratory-baseline:** Alla passerade.
- **visual-regression:** 22 fail -- saknade snapshot-baselines (förväntat, aldrig körts på denna maskin).
- **provider.spec.ts:** 2 fail -- seed-datakollision.

**Root cause provider.spec.ts:** `seedBooking()` skapade två bokningar med samma `(providerId, bookingDate, startTime, endTime)`. `futureWeekday(7)` och `futureWeekday(8)` kan ge samma datum beroende på veckodag. Unique constraint i DB blockerade insert.

**Fix:** Gav de två bokningarna olika tider (10:00-11:00 vs 11:00-12:00). Verifierat grönt: 22 passed, 0 failed (commit `7e45dcbf`).

### Valideringsrunda 2 (4 specs, chromium only, 50.2s)

Kördes för att verifiera kategoriseringen: 25 pass, 0 fail, 2 skip.

- **exploratory-baseline:** Bekräftad som smoke. Snabb, bred, ingen djup interaktion.
- **auth:** Bekräftad som smoke + kritiskt flöde. Login är smoke, registrering är kritiskt flöde (nytt konto i DB).
- **booking:** Bekräftad som kritiskt flöde. Flerstegsflöde med sök -> boka -> avboka.
- **payment:** Bekräftad som kritiskt flöde. Betala, kvitto, dubbelbetalningsskydd.
