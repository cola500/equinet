---
title: Arkitekturgenomgång
description: Strukturerad genomlysning av Equinets arkitektur -- domäner, lager, beroenden, styrkor och risker
category: architecture
status: current
last_updated: 2026-03-28
sections:
  - Övergripande struktur
  - Domäner och affärsområden
  - Ansvarsfördelning mellan lager
  - Beroenden mellan delar
  - Styrkor
  - Svagheter och otydliga gränser
  - Områden som är svåra att förändra
  - Arkitekturrisker
---

# Arkitekturgenomgång -- Equinet

> Genomförd 2026-03-28. Baserad på faktisk kod, inte dokumentation.

---

## Övergripande struktur

Projektet är en Next.js 16 App Router-applikation med DDD-Light-arkitektur:

```
src/
├── app/              # Pages + API routes (415 filer)
│   ├── api/          # 159 route.ts-filer
│   ├── provider/     # Leverantörssidor
│   ├── customer/     # Kundsidor
│   ├── admin/        # Administratörspanel
│   └── (auth)/       # Inloggning, registrering
├── domain/           # Affärslogik (114 filer, 20 domäner)
├── infrastructure/   # Repositories, events (78 filer)
├── components/       # React-komponenter (174 filer)
├── hooks/            # React hooks (46 filer)
├── lib/              # Utilities (99 filer)
└── types/            # Globala TypeScript-typer
```

**Totalt**: ~930 TypeScript-filer i `src/`.

---

## Domäner och affärsområden

### Kärndomäner (repository + service)

| Domän | Filer | Huvudkomponenter |
|-------|-------|------------------|
| booking | 14 | BookingService (968 LOC), BookingSeriesService, BookingEventHandlers, TravelTimeService |
| auth | 7 | AuthService, GhostMergeService, MobileTokenService |
| stable | 9 | StableService, StableInviteService |
| horse | 3 | HorseService |
| customer-review | 3 | CustomerReviewService |
| review | 3 | ReviewService |
| follow | 3 | FollowService |
| group-booking | 3 | GroupBookingService |
| subscription | 6 | SubscriptionService (Stripe) |

### Stöddomäner (service utan eget repository)

| Domän | Filer | Beskrivning |
|-------|-------|-------------|
| notification | 7 | Notifieringar, domänhändelser |
| due-for-service | 6 | Serviceintervaller per häst |
| reminder | 4 | Påminnelseschemaläggning |
| voice-log | 4 | AI-tolkad röstloggning |
| accounting | 4 | Fortnox-integration |
| municipality-watch | 3 | Bevakning av kommuner |
| customer-insight | 2 | Kundanalys |
| payment | 6 | Betalningshantering |

### Delad domäninfrastruktur (`domain/shared/`)

- `AggregateRoot<T>` -- domänhändelser på aggregat
- `Entity<T>` -- bas-entitet med ID
- `ValueObject<T>` -- immutabla värdeobjekt
- `Result<T, E>` -- explicit felhantering (Rust-inspirerat)
- `Guard<T>` -- valideringsklausuler
- `Location`, `TimeSlot` -- domänspecifika värdeobjekt

---

## Ansvarsfördelning mellan lager

### API-lager (`app/api/`)

159 route-handlers. Ansvarar för:
- HTTP-hantering (request/response)
- Auth-kontroll (session eller Bearer JWT)
- Rate limiting
- JSON-parsing + Zod-validering
- Delegering till domain services
- Felöversättning (domänfel -> HTTP-statuskod)

**Standardordning** (konsekvent i ~90% av routes):
```
auth() -> rate limit -> JSON parse -> Zod validate -> service call -> response
```

### Domänlager (`domain/`)

28 domain services med ren affärslogik. Inga HTTP- eller databeroenden -- arbetar via injicerade repositories.

Felhantering via `Result<T, E>` och 9 dedikerade error-mappers (`mapXErrorToStatus.ts`).

### Infrastrukturlager (`infrastructure/`)

52 repositories organiserade per domän:
- `I{X}Repository` -- interface (definierat i domänlagret)
- `Prisma{X}Repository` -- implementation
- `Mock{X}Repository` -- för tester

18 factory-funktioner (`create{X}Service()`) för dependency injection.

### UI-lager (`components/` + `app/` pages)

174 komponenter. Ingen direkt åtkomst till Prisma eller domänservices. All data hämtas via API-anrop eller SWR-hooks.

---

## Beroenden mellan delar

### Beroendeflöde (korrekt riktning)

```
UI (components/pages)
  -> hooks (useBookings, useProviderCustomers etc.)
    -> API routes (fetch)
      -> domain services (affärslogik)
        -> repositories (interface)
          -> Prisma (implementation)
```

**Verifierat**: 0 fall av server-imports i klientkod. Inga cirkulära beroenden hittade.

### Databasmodell

41 Prisma-modeller. Viktigaste relationerna:

```
User --1:1--> Provider
Provider --1:N--> Service
Provider --1:N--> Booking
Booking --N:1--> Service
Booking --N:1--> Horse (optional)
Booking --N:1--> BookingSeries (optional)
Provider --1:N--> Route --1:N--> RouteStop
User --1:N--> Horse
Horse --N:1--> Stable (optional)
Provider --1:N--> GroupBookingRequest
```

Index-strategi: geo-index på User/Provider, composite index på `[providerId, bookingDate, status]`, unique constraints för att förhindra dubbletter.

### Extern integrations-karta

| Integration | Koppling | Filer |
|------------|----------|-------|
| Supabase (PostgreSQL) | Prisma ORM | schema.prisma, alla repositories |
| Stripe | Betalningar + prenumerationer | webhooks/stripe, subscription/* |
| Upstash Redis | Rate limiting | lib/rate-limit.ts |
| Resend/SendGrid | E-post | lib/email/* |
| Sentry | Felspårning | next.config.ts, instrumentation |
| OSRM | Ruttoptimering | provider/route-planning |
| Fortnox | Bokföring | api/integrations/fortnox/* |
| APNs | Push-notiser (iOS) | lib/push/* |
| Anthropic | AI (röstloggning) | domain/voice-log |

---

## Styrkor

### 1. Konsekvent DDD-implementation

Kärndomäner har fullständig lagerdelning: interface -> implementation -> mock -> factory. Domänlogik läcker inte upp i API-routes. 28 services + 52 repositories visar disciplin.

### 2. Hög testtäckning

157 av 159 API-routes har tester (98.7%). 306 testfiler totalt. Test-till-källa-ratio: 33%. De två som saknar tester är Fortnox-integration och test-endpointen.

### 3. Säkerhet som förstaklassig concern

- Rate limiting på 15 separata nivåer (login, booking, AI, geocode etc.)
- Fail-closed vid Redis-fel (503 istället för att släppa igenom)
- `select` över `include` (510 vs 8 användningar) -- minimerar dataläckage
- CSP-headers, RBAC-middleware, Zod-validering
- ProviderId/customerId från session, aldrig från request body

### 4. Ren separation av auth-lager

Edge-kompatibel `auth.config.ts` för middleware, full `auth.ts` med Prisma/bcrypt för server. Separat mobiltoken-flöde (JWT) för iOS-appen. Ingen sammanblandning.

### 5. Feature flags med dual gating

17 flaggor med konsekvent server-side (404) + client-side gating. Prioritetsordning: env > databas > kod-default. 30s server-cache, 60s klient-polling.

### 6. Offline PWA-arkitektur

Fullt offline-stöd med service worker, IndexedDB-cache, mutation queue med exponentiell backoff, circuit breaker och tab-koordinering. Ambitiöst och välimplementerat.

---

## Svagheter och otydliga gränser

### 1. Massiv boilerplate i API-routes

123 routes har identisk auth-check, 182 har identisk rate-limit-check. Samma 10-15 rader repeteras i varje handler. Ingen middleware-wrapper eller decorator-pattern extraherar detta.

**Konsekvens**: Vid ändring av auth-mönstret (t.ex. session 106 auth null-check sweep) behövdes 87 filer uppdateras manuellt.

### 2. Två parallella auth-system utan gemensamt lager

Session-auth (`auth()`) för webb och Bearer JWT (`authFromMobileToken()`) för iOS-appen hanteras helt separat. 20 native routes använder mobile auth utan tests som verifierar att båda systemen ger samma behörighet.

### 3. Email-templates som monolitisk HTML-fil

`src/lib/email/templates.ts` (1,012 LOC) och `notifications.ts` (474 LOC) innehåller hårdkodad HTML med inline CSS. Svårt att underhålla, testa eller ändra design.

### 4. SlotCalculator utan tester

`src/lib/utils/slotCalculator.ts` (147 LOC) är en utility som beräknar tillgängliga tidsslots. Kunde inte hitta dedikerade tester för den. Kritisk affärslogik.

### 5. Klientloggning via console.error

77 `console.error/warn/log`-anrop i produktionskod (främst i page-komponenter). Projektets regel säger `clientLogger` ska användas, men det följs inte i ~30 filer.

---

## Områden som är svåra att förändra

### 1. BookingService (968 LOC)

Största domänservicen. Hanterar: skapande, statusändringar, reschedule, travel time, validering av stängda dagar, manuella bokningar. Alla bokningsrelaterade ändringar måste gå igenom denna fil.

### 2. PrismaBookingRepository (850 LOC)

6 separata `select`-block som måste hållas synkroniserade vid nya fält. Dokumenterat i CLAUDE.md som känd gotcha.

### 3. Middleware/auth-flöde

`middleware.ts` (102 LOC) med hårdkodade rollbaserade rutter. Varje ny rollrestriktion kräver ändring här. Ingen dynamisk konfiguration.

### 4. Feature flag-spridning

Att lägga till en ny feature flag kräver ändringar i: definitions.ts, varje API-route (server gate), varje UI-sida (klient gate), nav-komponenter, E2E-config. 6-7 filer minimum.

### 5. Prisma-schema (41 modeller)

Välindexerat men tätt kopplat. Schemaändringar kräver: migration, repository-uppdatering, select-block audit, mapper-uppdatering, test-uppdatering.

---

## Arkitekturrisker

### Risk 1: API-route boilerplate skapar inkonsistens

**Sannolikhet**: Hög (redan dokumenterat i session 106)
**Påverkan**: Medel

Utan centraliserad auth/rate-limit-hantering är varje route en potentiell avvikelse. Session 106 hittade att 78% av auth-routes saknade null-check. Ny boilerplate-ändring kräver sweep av 159 filer.

### Risk 2: BookingService som single point of complexity

**Sannolikhet**: Medel
**Påverkan**: Hög

968 LOC med ~10 publika metoder. Reschedule-logik (130+ LOC), travel time-validering, och manuell bokning är tätt kopplade. Bugg i en del kan påverka andra.

### Risk 3: next-auth på beta (v5.0.0-beta.30)

**Sannolikhet**: Medel
**Påverkan**: Medel

Beta-API kan ändras vid final release. Auth berör hela applikationen: middleware, API-routes, session-hantering, mobiltoken-integration.

### Risk 4: Offline-komplexitet

**Sannolikhet**: Låg (väl testad)
**Påverkan**: Hög vid regression

19 filer i `lib/offline/` med circuit breaker, mutation queue, sync engine, tab-koordinering, quota recovery. Mycket sofistikerat men svårt att felsöka vid edge cases.

### Risk 5: Dubbla auth-system (session + JWT) utan gemensamma tester

**Sannolikhet**: Medel
**Påverkan**: Medel

Webb-routes (`auth()`) och native-routes (`authFromMobileToken()`) ger inte garanterat samma behörighetssvar. En ändring i behörighetslogik måste appliceras på båda ställena manuellt.
