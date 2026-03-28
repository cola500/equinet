---
title: Kodkvalitetsgenomgång
description: Konkret analys av kodkvalitet -- mönster, duplicering, typsäkerhet, testbarhet, felhantering
category: architecture
status: current
last_updated: 2026-03-28
sections:
  - Övergripande bedömning
  - Bra mönster
  - Problematiska mönster
  - Stora och komplexa filer
  - Duplicering
  - Naming och läsbarhet
  - Testbarhet
  - Felhantering
  - Typsäkerhet
  - State-hantering
  - Demo/test/prod-blandning
---

# Kodkvalitetsgenomgång -- Equinet

> Genomförd 2026-03-28. Baserad på faktisk kod, mätningar och stickprov.

---

## Övergripande bedömning

**Kodbasen är i gott skick för sin storlek (~930 filer, ~3700 tester).** DDD-mönstren följs konsekvent, testtäckningen är hög, och säkerhet är genomtänkt. De största kvalitetsproblemen handlar om boilerplate-duplicering i API-routes och inkonsekvent klientloggning -- inte om strukturella brister.

**Betyg per dimension:**

| Dimension | Betyg | Motivering |
|-----------|-------|------------|
| Arkitektur | Stark | DDD-Light med ren lagerdelning |
| Testtäckning | Stark | 98.7% av routes har tester, 306 testfiler |
| Säkerhet | Stark | Rate limiting, select-first, Zod, RBAC |
| Typsäkerhet | Bra | Få `any` i prod (7 st), 8 motiverade suppressions |
| Felhantering | Bra | 9 domänspecifika error-mappers |
| Duplicering | Svag punkt | Massiv boilerplate i API-routes |
| Loggning | Svag punkt | 77 console.*-anrop i klientkod |

---

## Bra mönster

### 1. Repository pattern med DI och factories

```
domain/booking/BookingService.ts
  -> IBookingRepository (interface)
    -> PrismaBookingRepository (prod)
    -> MockBookingRepository (test)
  -> createBookingService() (factory med DI)
```

Alla kärndomäner (Booking, Provider, Auth, Follow, GroupBooking, Stable, CustomerReview) följer detta mönster. 52 repository-filer, 18 factory-funktioner.

**Varför det är bra**: Testbarhet, lös koppling, tydliga kontrakt.

### 2. Result<T, E> istället för exceptions

`src/domain/shared/types/Result.ts` implementerar ett Rust-inspirerat Result-mönster. Domänservices returnerar `Result<Value, DomainError>` istället för att kasta exceptions.

9 error-mappers (`mapBookingErrorToStatus.ts` etc.) översätter domänfel till HTTP-statuskoder i API-lagret.

**Varför det är bra**: Explicit felhantering, ingen implicit kontrollflödesändring, typsäkra felscenarion.

### 3. Select-first Prisma-queries

510 `select:`-användningar vs 8 `include:`-användningar i repositories och API-routes.

**Varför det är bra**: Minimerar data som lämnar databasen, förhindrar oavsiktlig exponering av känsliga fält, bättre prestanda.

### 4. Rate limiting med fail-closed

`src/lib/rate-limit.ts` (421 LOC) med 15 separata limiters, Upstash Redis i prod, in-memory i dev. Vid Redis-fel kastas `RateLimitServiceError` -> 503 (tjänsten tillgänglig), inte genomsläpp.

**Varför det är bra**: Defense-in-depth. Systemet blir restriktivt vid infrastrukturfel, inte permissivt.

### 5. Feature flag dual gating

Varje feature flag har:
- Server-side: `isFeatureEnabled()` -> 404 i API-route
- Client-side: `useFeatureFlag()` -> villkorlig rendering
- Defense in depth: service-level check i domain services

**Varför det är bra**: Flera lager av gating förhindrar att en miss i ett lager exponerar otillgänglig funktionalitet.

### 6. Konsekvent felmeddelande-standard

Svenska felmeddelanden med standardiserad ordlista: "Ej inloggad" (401), "Atkomst nekad" (403), "Ogiltig JSON" (400), "Valideringsfel" (400), "Internt serverfel" (500), "Tjänsten är tillfälligt otillgänglig" (503).

---

## Problematiska mönster

### 1. API-route boilerplate (HUVUDPROBLEM)

Varje API-route repeterar samma 10-20 rader:

```typescript
// Denna sekvens finns i ~120+ routes:
const session = await auth()
if (!session) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })

const clientIp = getClientIP(request)
const isAllowed = await rateLimiters.api(clientIp)
if (!isAllowed) return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })

let body
try { body = await request.json() }
catch { return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 }) }

const parsed = schema.safeParse(body)
if (!parsed.success) return NextResponse.json({ error: "Valideringsfel" }, { status: 400 })
```

**Konsekvens**: Session 106 visade att 78% av routes saknade en null-check -- inkonsistensen upptäcktes sent och krävde uppdatering av 87 filer.

**Filer**: Alla under `src/app/api/`

### 2. Klient-logging via console.error

77 `console.error/warn/log`-anrop i produktionskod. Projektet har `clientLogger` (`src/lib/client-logger.ts`), men den används inte konsekvent.

**Värst drabbade filer:**
- `src/app/providers/[id]/page.tsx` -- 4 console.error
- `src/app/provider/route-planning/page.tsx` -- 5 console.error
- `src/app/provider/dashboard/page.tsx` -- 3 console.error
- `src/app/provider/group-bookings/page.tsx` -- 4 console.error
- `src/app/provider/announcements/page.tsx` -- 3 console.error

**Konsekvens**: Inga felmeddelanden från klientkod fångas av Sentry eller annan felspårning.

### 3. Inline Zod-schemas i routes

De flesta API-routes definierar Zod-schemas inline istället för att importera från centrala definitioner. Bara 2 centraliserade schema-filer finns (`lib/validations/stable.ts`, `lib/validations/auth.ts`).

**Konsekvens**: Samma validering (t.ex. booking-datum, provider-profil) kan ha subtilt olika regler i olika routes.

### 4. Stora page-komponenter med fetch-logik

Flera page-komponenter gör sina egna fetch-anrop med `useEffect` + `useState` istället för att använda dedikerade hooks:

- `src/app/provider/dashboard/page.tsx` -- 3 separata fetch-anrop i useEffect
- `src/app/provider/group-bookings/page.tsx` -- 2 fetch + geolocation
- `src/app/providers/[id]/page.tsx` -- 4 fetch-anrop

**Konsekvens**: Inkonsekvent med resten av kodbasen som använder SWR-hooks.

---

## Stora och komplexa filer

### Produktion (icke-test):

| Fil | LOC | Bedömning |
|-----|-----|-----------|
| `src/lib/email/templates.ts` | 1,012 | Inline HTML-templates. Svår att underhålla. |
| `src/domain/booking/BookingService.ts` | 968 | Stor men välstrukturerad. Kandidat för uppdelning. |
| `src/app/admin/testing-guide/page.tsx` | 901 | Admin-verktyg. Acceptabelt. |
| `src/infrastructure/persistence/booking/PrismaBookingRepository.ts` | 850 | 6 select-block. Nödvändig komplexitet. |
| `src/components/calendar/ManualBookingDialog.tsx` | 752 | Komplex formulärlogik. Kandidat för uppdelning. |
| `src/components/provider/customers/CustomerCard.tsx` | 660 | Mycket ansvar i en komponent. |
| `src/app/provider/verification/page.tsx` | 651 | Verifieringsflöde. Acceptabelt. |
| `src/hooks/useProviderCustomers.ts` | 624 | Stor hook. Bör granskas. |
| `src/app/api/route-orders/route.ts` | 480 | Två distinkta flöden (kund + leverantör). |
| `src/lib/email/notifications.ts` | 474 | Notifieringsbyggare. |
| `src/lib/rate-limit.ts` | 421 | 15 limiters. Välstrukturerad trots storlek. |

### Testfiler (stora men acceptabla):

| Fil | LOC |
|-----|-----|
| `domain/booking/BookingService.test.ts` | 1,561 |
| `app/api/bookings/route.test.ts` | 1,204 |
| `app/api/providers/[id]/availability-exceptions/route.test.ts` | 1,098 |

---

## Duplicering

### Hög duplicering

| Mönster | Förekomster | Plats |
|---------|-------------|-------|
| Auth-check + 401 | ~123 | Alla autentiserade routes |
| Rate-limit-check + 429 | ~182 | Alla routes |
| JSON-parse try-catch + 400 | ~80 | POST/PUT/PATCH routes |
| Feature flag check + 404 | ~50 | Feature-gated routes |

**Total uppskattad duplicerad boilerplate**: ~2,000 LOC som kunde reduceras till ~50 LOC med wrapper-funktioner.

### Låg duplicering

- Error-mappers är centraliserade (9 filer, ingen kopiering)
- Repository-mönstret är konsekvent (interface -> impl -> mock)
- Factory-funktioner förhindrar duplicerad service-initiering

---

## Naming och läsbarhet

### Styrkor

- **Konsekvent domänterminologi**: Booking, Provider, Service, Horse, Route genomgående
- **Svenska felmeddelanden**: Standardiserad ordlista (session 106)
- **Filnamnkonvention**: `PascalCase` för klasser/komponenter, `camelCase` för utils, `kebab-case` i routes
- **Hook-prefix**: Alla hooks börjar med `use` (46 filer)

### Svagheter

- `route.ts`-filer har inget eget namn -- man måste navigera mappar för att förstå vilken route det är
- Vissa domäner har inkonsekvent namngivning: `CustomerReview` (leverantörens recension av kund) vs `Review` (kundens recension av leverantör) -- förvirrande

---

## Testbarhet

### Styrkor

- **98.7% route-testtäckning**: 157/159 routes har tester
- **Mock-repositories**: Alla kärndomäner har MockRepository för isolerade tester
- **Factory DI**: `createBookingService(deps)` gör det enkelt att injicera mocks
- **Inga globala mocks**: Varje testfil deklarerar sina egna mocks explicit

### Svagheter

- **SlotCalculator saknar tester**: `src/lib/utils/slotCalculator.ts` (147 LOC) -- kritisk affärslogik för tillgängliga tider
- **E-post templates otestad**: `src/lib/email/templates.ts` (1,012 LOC) -- ingen verifiering av genererad HTML
- **Page-komponenter har få tester**: Sidor som gör egna fetch-anrop (dashboard, group-bookings) saknar komponenttester

---

## Felhantering

### Server-side (stark)

- `Result<T, E>` i domänlagret -- explicit felhantering
- 9 error-mappers -- konsekvent översättning domänfel -> HTTP
- `logger.error()` konsekvent i 242 API-routes
- Rate limiter fail-closed -- 503 vid Redis-fel
- Strukturerad loggning via `src/lib/logger.ts`

### Klient-side (svag)

- 77 `console.error`-anrop utan strukturerad loggning
- Ingen centraliserad felrapportering från klient (Sentry konfigurerat för server, OKLART om klient-Sentry är aktiverat)
- Inkonsekvent felvisning: vissa sidor visar toast, andra inline-fel, vissa loggar bara

---

## Typsäkerhet

### Siffror (produktionskod, exklusive tester)

| Mätpunkt | Antal | Bedömning |
|----------|-------|-----------|
| `as any` | 7 | Utmärkt -- minimalt |
| `@ts-expect-error` / `@ts-ignore` | 8 | Bra -- alla motiverade |
| Strict mode | Aktiverat | Korrekt |

### Detalj om type suppressions

Alla 8 suppressions i produktionskod är motiverade:
- 5 st: Prisma `$transaction` callback-typning (känd begränsning)
- 2 st: Dynamisk fältkonstruktion
- 1 st: Next.js config-typing

**Bedömning**: Typsäkerheten är stark. Projektet använder strict mode och har minimala escape hatches.

---

## State-hantering

### Mönster

| Mönster | Användning | Plats |
|---------|-----------|-------|
| `useState` | 556 förekomster | Lokal komponentstate |
| SWR hooks | 7 dedikerade hooks | `useBookings`, `useHorses` etc. |
| Context | 1 provider | FeatureFlagProvider |
| Server Components | Majoriteten av sidor | Data hämtas server-side |

### Bedömning

Projektet är **server-drivet by design**. Minimal klient-state, ingen Redux/Zustand. Detta är korrekt för applikationstypen.

**Inkonsistens**: Vissa page-komponenter (dashboard, group-bookings) gör egna fetch-anrop med `useEffect` + `useState` istället för att använda SWR-hooks som resten av kodbasen. Detta skapar duplicerad fetch/loading/error-hantering.

---

## Demo/test/prod-blandning

### Demo-läge

`src/lib/demo-mode.ts` (41 LOC) -- kontrollerat och välskiljt:
- `isDemoMode()` kollar `NEXT_PUBLIC_DEMO_MODE=true`
- Begränsat till 6 tillåtna routes
- Villkorlig rendering i dashboard/verification/settings

**Bedömning**: Rent implementerat. Inget demo-läge läcker till produktionslogik.

### Test-endpoints

`/api/test/reset-rate-limit` -- guarded med `NODE_ENV === 'production'` check. Returnerar 404 i prod.

**Bedömning**: Acceptabelt. Men bör verifieras att `NODE_ENV` faktiskt sätts korrekt i alla deploy-miljöer.

### Test-data i kod

`data-testid` attribut i komponenter -- standard E2E-praxis, inget problem.

Ingen test-data eller mock-data hittades i produktionskod utanför dedikerade seed/test-filer.
