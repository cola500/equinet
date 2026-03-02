---
title: "Vecka 2 Februari: Features"
description: "Kundrecensioner, E2E seed, kundregister, mobil-först och svenska felmeddelanden"
category: retro
tags: [customer-reviews, e2e, mobile-first, serverless, i18n]
status: active
last_updated: 2026-03-02
sections:
  - Sammanfattning
  - Nyckelmetriker
  - Viktiga Learnings
  - Features Byggt
  - Patterns som Sparades
  - Gotchas & Lärdomar
  - Nästa Steg (Prioriterat)
  - Kodkvalitet denna Vecka
  - Session-sammanfattning per Dag
  - Impact på Produktion
  - Dokument & Referenser
---

# Vecka 2 Februari: Features (2026-02-05 -- 2026-02-09)

> Konsoliderad sammanfattning av 8 retrospectives: kundrecensioner, E2E seed, kundregister, leverantörsanteckningar, mobil-först redesign, Vercel/Supabase performance, E2E seed-fixar, och svenska felmeddelanden.

---

## Sammanfattning

| Datum | Ämne | Resultat |
|-------|------|----------|
| 2026-02-05 | Kundrecensioner (Provider -> Kund) | 23 nya tester, 1331 rader, immutabel modell, TDD-pattern |
| 2026-02-05 | E2E Seed-konsolidering | -445 rader duplicerad cleanup, ny enhetlig `seed-e2e.setup.ts` |
| 2026-02-06 | Kundregister revisit | 44 nya tester, 3 stories (kundlista, intervall, due-for-service) |
| 2026-02-06 | Leverantörsanteckningar | 12 nya tester, `providerNotes` på Booking, timeline-synlighet |
| 2026-02-08 | Mobil-först bokningsflöde | 20 nya tester, hook-extrahering, 52% radminskning i page.tsx |
| 2026-02-08 | Vercel Serverless Performance | Region-flytt fra1 + connection pooling, dubbel-fetch-fix |
| 2026-02-09 | E2E seed-data skips | 6 skips fixade (13 -> 7), `futureWeekday()`, `seedRoute()` helper |
| 2026-02-09 | Svenska felmeddelanden | 42 API-routes, 22 testfiler, konsekvent ordlista, geo-fix |

---

## Nyckelmetriker

| Metrisk | Värde |
|---------|-------|
| **Unit-tester (totalt)** | 1318 (session start 1213 -> end 1318) |
| **Nya tester denna vecka** | ~125 tester (kundrecensioner, kundregister, mobil, E2E) |
| **E2E test status** | 95 pass, 7 skip, 1 fail |
| **Regressioner** | 0 (alla sessioner gröna) |
| **Typecheck errors** | 0 |
| **Tid (totalt)** | ~5 sessioner |

---

## Viktiga Learnings

### 1. **Immutabla modeller förenklar MVP**
- kundrecensioner utan PUT/DELETE = halverad API-yta, färre tester, enklare UI
- Rätt val för MVP -- redigering kan läggas till senare om behövs

### 2. **Befintliga DDD-patterns skalar exponentiellt**
- kundrecensioner från customer-reviews togs från plan till kod på en session genom att kopiera review-mönstret
- Ny domän (CustomerReview) tog bråkdel av tiden vs review (pilot)

### 3. **Hook-extrahering för UI-refactoring är kraftfullt**
- Extrahera all logik till hook -> två UI-skal (mobil/desktop) -> sida blir limkod
- Resultatet: 52% radminskning, inga regressioner, varje plattform får optimal UX

### 4. **Serverless-performance är infrastruktur, inte bara kod**
- Region-mismatch (Virginia -> Frankfurt) gav 30x högre latens per query
- `connection_limit=1` för serverless är obligatoriskt
- Commit -> push -> migration -> deploy är den rätta ordningen

### 5. **E2E seed-data kräver djup rotorsaksanalys**
- Skips beror sällan på en orsak -- ofta kombination av: seed-data, API-filter, CSS-selektorer, UI-flödesordning
- `futureWeekday()` och `seedRoute()` helpers eliminerar helg-flakiness och UI-beroenden

### 6. **Språkkonsekvens är teknisk skuld**
- Svenska felmeddelanden från dag 1 är billigare än att fylla på senare
- Logger på engelska (för utvecklare), responses på svenska (för användare)

### 7. **`select`-pattern skyddar kundsidan**
- Medveten exkludering av data från repositories förhindrar dataläckor
- Passport-route som public API -- måste exkludera privata fält

### 8. **Strict Zod-schema blockerar IDOR-försök**
- `.strict()` avvisar extra fält i request body
- `providerId` från session (aldrig från body) är enda säkra approachen

---

## Features Byggt

### Core Domains (Repository-mönster)
- **CustomerReview**: Immutabel, inga PUT/DELETE, review i kundägare
- **HorseServiceInterval**: Junction-tabell för override-logik per häst+leverantör
- **ProviderNotes**: Field på Booking, villkorlig timeline-synlighet

### Infrastructure
- **E2E Utilities**: `cleanup-utils.ts` (enhetlig cleanup), `seed-e2e.setup.ts` (komplett seed), `futureWeekday()`, `seedRoute()`
- **Vercel Config**: Region-matchning (fra1), connection pooling
- **Feature**: Responsive dialogs (mobil Drawer + desktop Dialog bakom gemensamt API)

### API Routes
- `POST/GET /api/customer-reviews`
- `PUT /api/provider/horses/[horseId]/interval`
- `GET /api/provider/customers`, `/api/provider/due-for-service`
- `PUT /api/provider/bookings/[id]/notes`
- 42 routes + alla med svenska felmeddelanden

### UI
- Mobile-first booking flow (3-stegs Drawer)
- Customer list med hästar (expanderbara kort)
- Due-for-service vista (statusbadges, färgkodade)
- Provider notes textarea i booking-detaljer

---

## Patterns som Sparades

| Pattern | Beskrivning | Använd när |
|---------|-------------|-----------|
| **Immutable + Result** | Ingen PUT/DELETE, Result-pattern för errors | MVP-features utan redigering |
| **Hook + UI-skal** | Extrahera logik -> två UI-komponenter | Mobile-first redesign behövs |
| **Junction-tabell för overrides** | `[FK1, FK2]` unique constraint + upsert | N:M relationer med override-behov |
| **Villkorlig timeline-synlighet** | `isProvider`-flagga i domain layer | Data synlig bara för viss user-typ |
| **futureWeekday() helper** | Avoidar helger vid seedning | E2E seed med arbetsdag-tillgänglighet |
| **seedRoute() helper** | Skapar Route+RouteStops direkt | Tester behöver pre-existerande rutter |
| **Oversättningstabell** | Order för felmeddelanden | Språkbyte i felresponser |

---

## Gotchas & Lärdomar

### API-säkerhet
- `providerId` från session, aldrig request body
- `select` i repository skyddar kundsidan från dataläckor
- Passport-route måste exkludera privata fält

### E2E
- CSS-selektorer på shadcn komponenter är brakliga -- migrera till `data-slot` eller `getByRole`
- Helgdatum gör tester flaky -- använd `futureWeekday()`
- Iterate genom multi-match elements istället för att anta `.first()` är rätt

### Infrastruktur
- Vercel MÅSTE matcha Supabase-region (fra1 för eu-central-2)
- `connection_limit=1` för serverless-databas
- Commit innan deploy -- Vercel och git-historik måste vara synkade

### Databas
- Nytt fält på befintlig modell = audit ALLA select-block + mappings + public-vyer
- Passport-route är public API -- exkludera `providerNotes`, `customerNotes` etc
- RLS-aktivering på nya tabeller via `get_advisors(type: "security")`

---

## Nästa Steg (Prioriterat)

### HÖG Prioritet
1. **Dubbla formulärkomponenter** (mobil/desktop booking) -- extrahera form-fragments
2. **CSS-selektor-migration** (E2E specs) -- ersätt `.border.rounded-lg` med `data-slot`
3. **Rate limiting på kundrecensioner** -- lägg till `rateLimiters.api` på POST-endpoint

### MEDEL Prioritet
4. **Kvarvarande E2E skips** (booking 2, calendar 1, flexible-booking 2, provider 2) -- fixas via seed/UI-flodesuppdateringar
5. **Intervall-UI** (provider ser häst-intervall från kundvyn) -- API finns, UI kvar
6. **Aggregerat kundbetyg** (snitt per kund för leverantörer)

### LÅG Prioritet
7. Kund-notifikation vid kundrecension (avvakta MVP-feedback)
8. Audit trail för providerNotes-ändringar
9. Paginering på kundlista (MVP-skalan <500 users är OK)

---

## Kodkvalitet denna Vecka

| Aspekt | Status |
|--------|--------|
| Unit-tester | ✅ 1318 totalt, TDD-first för all business logic |
| E2E-tester | 📊 95 pass, 7 skip, 1 fail -- skips minskat från 13 |
| Typecheck | ✅ 0 errors |
| Lint | ✅ Från förra sprinten 0 varningar |
| Säkerhet | ✅ `.strict()` Zod, `select`-pattern, IDOR-guard |
| Språk | ✅ Svenska felmeddelanden konsekvent (42 routes) |

---

## Session-sammanfattning per Dag

### **Onsdag 2026-02-05** (Kundrecensioner + E2E Seed)
- ✅ Kundrecensioner helt testa+implementerat (23 tests, 1 session)
- ✅ E2E seed konsoliderat (-445 rader duplicerad kod)
- Befintliga patterns förväxlar -- DDD-Light skalat bra

### **Torsdag 2026-02-06** (Kundregister + Leverantörsanteckningar)
- ✅ Kundregister 3 stories klara (44 tests, kundlista + intervall + due-for-service)
- ✅ Leverantörsanteckningar integrerade (12 tests, villkorlig timeline-synlighet)
- 🚨 **Gotcha: Select-block audit missades på passport-route** -- dokumenterat i CLAUDE.md

### **Lördag 2026-02-08** (Mobil-först + Performance)
- ✅ Mobile booking flow hook-extraherad (20 tests, 52% radminskning)
- ✅ Vercel serverless fixed (region fra1 + connection pooling)
- 🚨 **Gotcha: Deploy utan commit först** -- processförbättring planerad

### **Söndag 2026-02-09** (E2E Fixar + Svenska)
- ✅ E2E seed-data 6 skips fixade (13 -> 7, futureWeekday + seedRoute)
- ✅ Svenska felmeddelanden konsekvent (42 routes, 22 testfiler)
- 🚨 **Gotcha: shadcn CSS-selektorer trasiga** -- migrering planerad

---

## Impact på Produktion

- **kundrecensioner**: Leverantörer kan nu bedöma kundkvalitet (immutabel, review-based)
- **kundregister + intervall**: Leverantörer kan planera återbesök per häst + se när besök är förfallna
- **mobil-först**: Bokningsflödet är nu optimerat för mobilappar (Drawer-steg)
- **serverless**: Production latency reducerad från ~900ms till ~50ms per request (region + pooling)
- **E2E stabilitet**: Skips från 13 -> 7, helgrobusthet via futureWeekday()

---

## Dokument & Referenser

- **Patterns**: Se CLAUDE.md "Repository Pattern", "Domain Patterns", "Refactoring Guidelines"
- **Feature Flags**: `offline_mode`, `stripe_subscriptions` (från senare sessioner)
- **Testning**: `.claude/rules/testing.md` för TDD-guidelines
- **API-säkerhet**: `.claude/rules/api-routes.md` för select-pattern + Zod-validation
- **Källdokument**: [docs/archive/retrospectives-raw/](../archive/retrospectives-raw/)

---

**Vecka 2 Februari är avslutad. Total progress: 8 sessioner, ~125 nya tester, 4 nya features, 3 infrastruktur-förbättringar.**

