# Refaktoreringsplan -- Equinet

> Genererad 2026-02-24 baserat på bred kodanalys.

---

## Kritiskt (hog paverkan, tydlig vinst)

| # | Problem | Var | Detalj |
|---|---------|-----|--------|
| 1 | **Haversine-duplikation 4x** | `lib/distance.ts`, `lib/geo/distance.ts`, `api/providers/route.ts`, `api/route-orders/announcements/route.ts` | Samma avstandsfunktion kopierad 4 ganger. Enkel fix. |
| 2 | **Customers-sida 1268 rader** | `provider/customers/page.tsx` | Blandar kundlista, insikter, anteckningar, kontaktinfo. Bor delas i 3-4 komponenter. |
| 3 | **BookingService 1048 rader** | `domain/booking/BookingService.ts` | Blandar tidsvalidering, overlappskontroll, manuell bokning. Kan delas i `BookingValidationService` + `ManualBookingService`. |
| 4 | **useBookingFlow 302 rader -> 22-prop drilling** | `hooks/useBookingFlow.ts` -> `MobileBookingFlow` + `DesktopBookingDialog` | En hook hanterar 7 state-grupper som leder till 22 props som passas identiskt till tva komponenter. |
| 5 | **Payment-route utan tester (239 rader)** | `api/bookings/[id]/payment/route.ts` | Hanterar pengar -- helt otestad. Hogsta testrisken. |

## Hog prioritet

| # | Problem | Var |
|---|---------|-----|
| 6 | **3 sidor 1000+ rader** | `provider/profile/page.tsx` (1028), `customer/horses/[id]/page.tsx` (1017), `providers/page.tsx` (1013) |
| 7 | **Direkt Prisma i 5+ routes** (bryter repository pattern) | `route-orders/route.ts`, `route-orders/available/route.ts`, `verification-requests/route.ts`, `bookings/[id]/reschedule/route.ts` |
| 8 | **Fetch-pattern duplicerat 12+ ganger** | `useState(data) + useState(loading) + useState(error) + useEffect(fetch)` -- bor anvanda SWR konsekvent |
| 9 | **Error mapping inline** (review/customer-review routes) | Bor folja samma domain-monster som horse/auth/group-booking |
| 10 | **17 API-routes utan tester** | Routes, profile, Fortnox-integration, admin-verification m.fl. |

## Medium prioritet

| # | Problem | Var |
|---|---------|-----|
| 11 | **"use client" overanvandning** | 60 deklarationer -- flera sidor kunde vara Server Components med client-subkomponenter |
| 12 | **Dialog-state duplicerat i 8 komponenter** | 4 `useState(false)` per sida for dialoger -- bor extraheras |
| 13 | **useVoiceWorkLog 232 rader** | 5 state-grupper i en hook |

---

## Detaljerade fynd

### 1. Haversine-duplikation (4 filer)

Samma avstandsberakning finns i:
- `src/lib/distance.ts:5-31` -- huvudimplementation
- `src/lib/geo/distance.ts:16-34` -- kopia med `EARTH_RADIUS_KM` const
- `src/app/api/providers/route.ts:15-38` -- privat funktion
- `src/app/api/route-orders/announcements/route.ts:10-33` -- privat funktion

**Atgard:** Anvand `src/lib/geo/distance.ts` overallt, ta bort ovriga.

### 2. Repository pattern-brott

Karndomaner med repositories (korrekt):
- Booking, Provider, Service, Review, CustomerReview, Horse, Follow

Routes som anvander Prisma direkt for karndomaner:
- `route-orders/route.ts` -- direkt `prisma.provider`, `prisma.service`
- `route-orders/available/route.ts:89` -- direkt `prisma.provider`
- `verification-requests/route.ts:51,63` -- direkt `prisma.provider`
- `bookings/[id]/reschedule/route.ts:60` -- direkt `prisma.booking`
- `service-types/route.ts:18-22` -- direkt `prisma.service`

### 3. Error mapping inte abstraherat

Inline error mappers i:
- `api/reviews/route.ts:16-31`
- `api/customer-reviews/route.ts:15-28`

Bor extraheras till `domain/review/mapReviewErrorToStatus.ts` och `domain/customer-review/mapCustomerReviewErrorToStatus.ts`.

### 4. Stora sidor (1000+ rader)

| Fil | Rader | Problemomraden |
|-----|-------|----------------|
| `provider/customers/page.tsx` | 1268 | Kundlista + insikter + anteckningar + kontakt |
| `domain/booking/BookingService.ts` | 1048 | Tidsvalidering + overlap + manuell bokning |
| `provider/profile/page.tsx` | 1028 | Profilredigering + installningar + tillganglighet |
| `customer/horses/[id]/page.tsx` | 1017 | Hastdetalj + tidslinje + intervall + paminnelser |
| `providers/page.tsx` | 1013 | 20 useState, sok + filter + geo + favoriter |

### 5. Hook/prop-drilling

`useBookingFlow.ts` (302 rader) hanterar 7 state-grupper:
1. Modal: `isOpen`, `selectedService`
2. Bokningsformular: `bookingForm`, `bookingDate`, `startTime`
3. Flexibel bokning: `isFlexibleBooking`, `flexibleForm`
4. Aterkommande: `isRecurring`, `intervalWeeks`, `totalOccurrences`
5. Serieresultat: `seriesResult`, `showSeriesResult`
6. Actions: `openBooking`, `close`, `handleSubmitBooking`

Resulterar i 22 props som passas identiskt till `MobileBookingFlow` + `DesktopBookingDialog`.

**Atgard:** Dela i `useBookingModal()`, `useBookingForm()`, `useFlexibleForm()`, `useRecurringBooking()`, `useBookingSubmit()`.

### 6. Testtackning -- saknade tester

**Hog prioritet (affarslogik):**
- `api/bookings/[id]/payment/route.ts` (239 rader) -- betalningshantering
- `api/routes/route.ts` (210 rader) -- rutthantering
- `api/route-orders/available/route.ts` (133 rader) -- tillgangliga ruttordrar
- `api/routes/[id]/stops/[stopId]/route.ts` (133 rader) -- ruttstopp
- `api/profile/route.ts` (131 rader) -- anvandarprofil
- `api/providers/visiting-area/route.ts` (118 rader) -- besoksomraden
- `api/integrations/fortnox/callback/route.ts` (110 rader) -- OAuth2 callback

**Medium prioritet:**
- `api/route-orders/my-orders/route.ts` (62 rader)
- `api/admin/verification-requests/route.ts` (61 rader)
- `api/provider/onboarding-status/route.ts` (77 rader)
- `api/routing/route.ts` (74 rader)
- `api/geocode/route.ts` (59 rader)

### 7. "use client" overanvandning

60 "use client"-deklarationer i `src/app/`. Flera sidor hamtar data via `useEffect` + `fetch` som kunde goras i Server Components med client-subkomponenter for interaktivitet.

### 8. Dialog-state duplicering

8 komponenter har 3-4 `useState(false)` for dialoghantering. Bor extraheras till `useDialogState()` hook.

---

## Implementation (prioritetsordning)

### Sprint A: Snabba vinster
- [ ] Haversine-duplikation: konsolidera till en import
- [ ] Error mappers: extrahera for review/customer-review
- [ ] Repository-compliance: 5 routes som bryter monstret

### Sprint B: Testtackning
- [ ] Payment-route: fullstandig testsuite
- [ ] Routes-relaterade endpoints: grundlaggande tester
- [ ] Profile-route: tester

### Sprint C: Stora komponenter
- [ ] `provider/customers/page.tsx`: extrahera 3-4 subkomponenter
- [ ] `BookingService.ts`: dela i validering + manuell bokning
- [ ] `provider/profile/page.tsx`: extrahera installningspaneler

### Sprint D: Hook-refaktorering
- [ ] `useBookingFlow`: dela i 5 mindre hooks
- [ ] `MobileBookingFlow` + `DesktopBookingDialog`: minska prop-interface
- [ ] Dialog-state hook: extrahera fran 8 komponenter
