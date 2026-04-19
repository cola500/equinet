---
title: "S43-2 Plan: Första batch — flytta 5 specs till integration-nivå"
description: "Migrationsplan för 5 E2E-specs till integration-tester. Commit-strategi, coverage-gaps och process per spec."
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Scope
  - Förutsättningar
  - Korrigering av Discovery-plan
  - Commit-strategi
  - Process per spec
  - Coverage-gap sammanfattning
  - Risker
---

# S43-2 Plan: Första batch — flytta 5 specs till integration-nivå

**Sprint:** S43-2  
**Branch:** `feature/s43-2-first-batch`  
**Datum:** 2026-04-19

---

## Aktualitet verifierad

**Kommandon körda:** Läst E2E-specs, route-filer och pilot-rapport (S43-1, 2026-04-19).  
**Resultat:** S43-1 GO-beslut bekräftat. 5 E2E-specs identifierade som pending. Korrigering av customer-insights målsökväg dokumenterad.  
**Beslut:** Fortsätt

---

## Scope

5 E2E-specs, alla "FLYTTA → integration", temat data-display och CRUD-API:

| E2E-spec | Ny testfil | Rader | Tester i E2E |
|----------|-----------|-------|--------------|
| `due-for-service.spec.ts` | `src/app/api/provider/due-for-service/route.integration.test.ts` | 115 | 3 |
| `customer-due-for-service.spec.ts` | `src/app/api/customer/due-for-service/route.integration.test.ts` | 280 | ~6 |
| `customer-insights.spec.ts` | `src/app/api/provider/customers/[customerId]/insights/route.integration.test.ts` | 120 | 3 |
| `customer-registry.spec.ts` | `src/app/api/provider/customers/route.integration.test.ts` | 129 | 4 |
| `business-insights.spec.ts` | `src/app/api/provider/insights/route.integration.test.ts` | 207 | 5 |

---

## Förutsättningar

- **GO från S43-1 pilot-rapporten** (2026-04-19): Bekräftad. Båda pilots lyckades, mönster etablerade.
- **Etablerade gotchas från S43-1:**
  - `vi.hoisted()` obligatoriskt för mock-objekt ovanför `vi.mock()`
  - `as never` i mock-returvärden
  - Integration-mönster: importera route handler, skapa `NextRequest` direkt, assertera response

---

## Korrigering av Discovery-plan

**customer-insights.spec.ts: fel målsökväg i Discovery**

Discovery-planen angav `src/app/api/customer/insights/route.integration.test.ts` som mål. Men:
- Ingen route existerar på den sökvägen
- Den faktiska routen är `src/app/api/provider/customers/[customerId]/insights/route.ts` (POST)
- Routen har redan ett komplett `route.test.ts` (10 tester: auth, rate limit, caching, AI-svar)
- E2E-specens tester (`test.slow()` x2) testar UI-beteende: knapp-synlighet, laddningstext, VIP-badge-rendering

**Konsekvens för S43-2:**  
- Korrekt mål: `src/app/api/provider/customers/[customerId]/insights/route.integration.test.ts`
- Men eftersom route.test.ts redan täcker API-beteendet fullt ut, är integrationstestets roll att bekräfta att inga E2E-unika scenarios saknas
- UI-laddningsstate ("Analyserar kunddata", VIP-badge rendering) är coverage-gap som noteras i batch-rapporten — dessa bör täckas av component-test i framtida batch, inte integration-test
- E2E-spec tas bort efter att route.test.ts-täckning verifierats som tillräcklig

---

## Commit-strategi

En commit per spec-migration:

```
1. feat(tests): S43-2 migrate due-for-service.spec.ts → integration
2. feat(tests): S43-2 migrate customer-due-for-service.spec.ts → integration
3. feat(tests): S43-2 migrate customer-insights.spec.ts → integration (verifiera route.test.ts)
4. feat(tests): S43-2 migrate customer-registry.spec.ts → integration
5. feat(tests): S43-2 migrate business-insights.spec.ts → integration
6. docs: S43-2 done + batch-rapport
```

**Regel:** Varje commit innehåller BÅDE ny testfil OCH borttagen E2E-spec.  
**check:all** körs MINST efter commit 1, 3, 5 (och helst varje commit).

---

## Process per spec

### 1. due-for-service.spec.ts (3 tester)

**Vad E2E testar:**
- Sidvy med heading, undertext, summary cards, filterknappar
- Förfallen häst visas med korrekt info (horse name, "Försenad", "8 veckor", service name, "dagar försenad")
- Filter "Försenade" / "Alla" togglar

**Vad integration-testet ska täcka:**
- 401 utan auth (provider-auth krävs)
- 404 om provider saknas
- Feature flag OFF → 404
- Tom lista om inga completed bookings med horseId
- Häst returneras som overdue när senaste completed booking är äldre än intervalWeeks
- `filter=overdue` returnerar bara overdue-hästar
- `filter=all` returnerar alla

**Route:** `src/app/api/provider/due-for-service/route.ts`  
**Mönster:** `withApiHandler({ auth: "provider", featureFlag: "due_for_service" })` — mock `withApiHandler` eller använd hoisted mocks för auth + prisma.  
**OBS:** Routen använder `withApiHandler` med `featureFlag: "due_for_service"` — verifiera hur feature-flag-mockingen ska ske (jämför mot liknande route.integration.test.ts-filer).

**Coverage-gap:** Sidrendering (heading, summary cards, filterknappar) är UI-specifikt — stannar som gap.

---

### 2. customer-due-for-service.spec.ts (6 tester)

**Vad E2E testar:**
- Overdue-badge på häst-listan (UI)
- Interval-flik på hästdetalj-sidan (UI + tab-navigering)
- Skapa serviceintervall (combobox + dialog + API-POST)
- Uppdatera serviceintervall (dialog + API-PUT)
- Ta bort serviceintervall (window.confirm + API-DELETE)

**Viktigt:** Intervall-CRUD-testerna (skapa/uppdatera/ta bort) testar UI-dialog-interaktioner men underliggande API är `/api/customer/horses/[horseId]/intervals`.

**Vad integration-testet ska täcka:**
- GET `/api/customer/due-for-service` — 401, 403, feature flag OFF → tom lista, items med overdue-status
- GET `/api/customer/due-for-service?horseId=xxx` — 400 ogiltigt ID, 404 häst ej hittad, items för häst

**Coverage-gap:**
- Interval CRUD (POST/PUT/DELETE `/api/customer/horses/[horseId]/intervals`) — UI-dialogen täcks inte av integration-test. API-beteendet kan testas separat i framtida batch eller via befintliga unit-tester för DueForServiceService. Notera i batch-rapporten.
- Overdue-badge och flik-rendering är UI-specifika — stannar som gap.

---

### 3. customer-insights.spec.ts (3 tester, 2x test.slow())

**Korrigering noterad ovan.**

**Vad E2E testar:**
- "Visa insikter"-knapp synlig i expanderat kundkort (UI)
- Klick → laddningstext "Analyserar kunddata" → "AI-insikter" heading (UI + API-anrop)
- VIP-badge (VIP/Stamkund/Normal) + "Vanligaste tjänster" (UI-rendering av API-data)

**Vad integration-testet ska bekräfta:**
- route.test.ts täcker redan: 401, 403, 429, 403 no customer relation, 400 no data, 200 happy path, 500 AI fail, 404 provider not found, cache hit, cache store, force refresh
- **Inga E2E-unika API-scenarios saknas** — route.test.ts-täckning är tillräcklig för API-beteendet
- Skapa `route.integration.test.ts` som en minimal smoke: 200 happy path (kopiera relevant scenario från route.test.ts) för att följa batch-processen konsekvent

**Coverage-gap:**
- Knapp-synlighet i CustomerCard (UI-komponent) — bör täckas av component-test i framtida batch
- Laddningstext "Analyserar kunddata" — UI-state, framtida component-test
- VIP-badge rendering — UI-rendering av API-data, framtida component-test

---

### 4. customer-registry.spec.ts (4 tester)

**Vad E2E testar:**
- Kundlista-sida med heading, undertext, sökfält, filterknappar
- Kunder visas från completed bookings (Test Testsson + email + booking count)
- Sökning på namn (träff + ingen träff)
- Expandera kundkort → telefon, antal bokningar, hästar

**Vad integration-testet ska täcka:**
- 401 utan auth
- 404 provider saknas
- GET utan params → returnerar customers-lista med korrekt struktur (id, firstName, lastName, email, bookingCount, horses)
- GET ?q=Test → filtrerar på namn (hittar)
- GET ?q=nonexistent → tom lista
- GET ?status=active vs inactive → korrekt filtrering
- Manuellt tillagd kund (via ProviderCustomer) ingår i svaret

**Coverage-gap:**
- Expanderbar kundkort-UI (klick → expandering) — UI-komponent, framtida component-test
- Mobile/desktop-layout skillnader (booking count hidden on mobile) — UI-specifikt

---

### 5. business-insights.spec.ts (5 tester)

**Vad E2E testar:**
- Sida med heading + period-knappar (3/6/12 mån), default 6 mån aktiv (CSS-klass)
- KPI-kort laddas med etiketter (Avbokningsgrad, No-show-grad, etc.)
- Chart-sektioner synliga (Populäraste tjänster, tider, Kundretention)
- Byt period → ny API-anrop verifieras (`waitForResponse`)
- Info-popovers — **redan skip:at** med selectorproblem!

**Vad integration-testet ska täcka:**
- 401 utan auth
- 403 utan providerId
- 404 provider saknas
- GET ?months=6 → returnerar insights-struktur (cancellationRate, noShowRate, avgBookingValue, etc.)
- GET ?months=12 → returnerar data för 12-månadsperiod (annan datamängd)
- GET ?months=3 → returnerar data för 3-månadsperiod
- Cache hit: returnerar cached data
- Cache miss: beräknar och cachar

**Coverage-gap:**
- KPI-etikett-rendering (Avbokningsgrad etc.) — UI-rendering av API-data
- Chart-rendering — visuellt, ej testbart via API
- Info-popover-interaktion — redan skip:at, ignoreras
- Aktiv-knapp CSS-klass — UI-specifikt

---

## Coverage-gap sammanfattning

| Spec | Coverage-gap (ej täckt efter migration) |
|------|-----------------------------------------|
| due-for-service | Heading/undertext/summary-cards/filterknappar-rendering (UI) |
| customer-due-for-service | Interval CRUD-dialogen (UI), overdue-badge (UI), flik-navigering (UI) |
| customer-insights | Knapp-synlighet, laddningstext, VIP-badge rendering (alla UI-komponentnivå) |
| customer-registry | Expanderbar kundkort (UI), mobile layout |
| business-insights | KPI-etiketter/chart-rendering (UI), info-popovers (redan skip) |

**Åtgärd:** Alla coverage-gaps noteras i batch-rapporten. Inga ska tas om hand i S43-2 — scope är API-integration, inte component-tester.

---

## Risker

1. **`withApiHandler`-mocking:** due-for-service och customer-registry använder `withApiHandler`. Verifiera om befintliga integration-tester mockar det eller anropar route direkt (se `group-bookings/route.integration.test.ts` som jämförelse).

2. **DueForServiceCalculator-timing:** `calculateDueStatus` beräknar dagar baserat på `new Date()`. Integration-testet behöver seed en bokningsdatum som är tillräckligt gammalt relativt testets testkörning. Använd relativa datum (subDays(new Date(), 90)).

3. **customer-insights identitetsfel:** Routen är en DYNAMISK route `[customerId]`. NextRequest-konstruktionen i test måste inkludera customerId i URL. Se befintligt route.test.ts för korrekt mönster.

4. **business-insights cache:** Route cachar med `getCachedProviderInsights`. Mocka cache-modulen med `vi.hoisted` eller `vi.mock` för att undvika Redis-beroende.
