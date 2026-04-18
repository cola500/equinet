---
title: "S18-3: Annonsering CRUD native"
description: "Komplettera annonserings-flödet med native skapa-formulär och detaljvy"
category: plan
status: wip
last_updated: 2026-04-09
sections:
  - Scope
  - Approach
  - Filer
  - TDD
  - Risker
---

# S18-3: Annonsering CRUD native

## Scope

Listan och cancel är redan native. Kvar: skapa annons + visa detalj med bokningar + bekräfta/avboka bokningar.

## Approach

### 1. Nya native API endpoints

**POST `/api/native/announcements`** -- skapa annons
- Auth: `getAuthUser()` (Bearer)
- Feature flag: `route_announcements`
- Body: `{ serviceIds, dateFrom, dateTo, municipality, specialInstructions }`
- Validering: Zod, municipality via `isValidMunicipality()`, datum-validering, service-ägande
- Delegerar till samma logik som `handleProviderAnnouncement` i route-orders

**GET `/api/native/announcements/[id]/detail`** -- detalj med bokningar
- Auth: `getAuthUser()` (Bearer)
- Ownership: annonsens providerId = sessionens providerId
- Returnerar: annonsinfo + bokningar med kund/tjänst/häst

**PATCH `/api/native/announcements/[id]/bookings/[bookingId]`** -- uppdatera bokningsstatus
- Auth: `getAuthUser()` (Bearer)
- Body: `{ status: "confirmed" | "cancelled" }`
- Ownership: bokning tillhör annonsens provider

### 2. iOS modeller (utöka AnnouncementModels.swift)

- `AnnouncementDetail`: annonsinfo + bokningar
- `AnnouncementBooking`: id, date, time, status, customer, service, horseName, notes
- `CreateAnnouncementRequest`: serviceIds, dateFrom, dateTo, municipality, specialInstructions

### 3. iOS ViewModel (utöka AnnouncementsViewModel.swift)

- `createAnnouncement()` -- POST
- `loadDetail(id)` -- GET detalj
- `updateBookingStatus(announcementId, bookingId, status)` -- PATCH

### 4. iOS vyer

- `AnnouncementFormSheet.swift` -- .sheet med multi-select tjänster, kommun-sökning, datumintervall, instruktioner
- `AnnouncementDetailView.swift` -- annonsinfo + bokningslista med bekräfta/avboka
- Uppdatera `NativeAnnouncementsView` -- ersätt web-offload med native navigation

### 5. Kommun-data

Porta `SWEDISH_MUNICIPALITIES` (290 kommuner) till Swift som statisk array.
Searchable i formuläret med `.searchable()`.

## Filer

| Fil | Aktion |
|-----|--------|
| `src/app/api/native/announcements/route.ts` | Redigera (lägg till POST) |
| `src/app/api/native/announcements/route.test.ts` | Redigera (lägg till POST-tester) |
| `src/app/api/native/announcements/[id]/detail/route.ts` | Ny |
| `src/app/api/native/announcements/[id]/detail/route.test.ts` | Ny |
| `src/app/api/native/announcements/[id]/bookings/[bookingId]/route.ts` | Ny |
| `src/app/api/native/announcements/[id]/bookings/[bookingId]/route.test.ts` | Ny |
| `ios/Equinet/Equinet/AnnouncementModels.swift` | Redigera |
| `ios/Equinet/Equinet/AnnouncementsViewModel.swift` | Redigera |
| `ios/Equinet/Equinet/APIClient.swift` | Redigera |
| `ios/Equinet/Equinet/NativeAnnouncementsView.swift` | Redigera |
| `ios/Equinet/Equinet/AnnouncementFormSheet.swift` | Ny |
| `ios/Equinet/Equinet/AnnouncementDetailView.swift` | Ny |
| `ios/Equinet/Equinet/SwedishMunicipalities.swift` | Ny |
| `ios/Equinet/EquinetTests/AnnouncementsViewModelTests.swift` | Redigera |

## TDD

Webb (Vitest BDD):
- POST create: 201, 401, 403 (ej provider), 400 (validering), 404 (flagga av)
- GET detail: 200, 401, 403 (ej ägare), 404
- PATCH booking: 200, 401, 400 (ogiltig status)

iOS (XCTest):
- `testCreateAnnouncementSuccess`
- `testLoadDetailSuccess`
- `testUpdateBookingStatusSuccess`

## Risker

- **Kommun-data storlek**: 290 strängar, trivial
- **Service-lista**: Behöver hämta providers tjänster for multi-select -- redan tillgänglig via ServicesViewModel
- **Feature flag**: `route_announcements` -- redan konfigurerad i iOS NativeMoreView
