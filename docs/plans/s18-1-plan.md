---
title: "S18-1: Gruppbokningar native (leverantörssida)"
description: "Native SwiftUI för leverantörens gruppboknings-vy: lista, detalj, matchning"
category: plan
status: wip
last_updated: 2026-04-09
sections:
  - Scope
  - Feature Inventory
  - Approach
  - Filer
  - TDD
  - Risker
---

# S18-1: Gruppbokningar native (leverantörssida)

## Scope

Leverantörens vy för gruppbokningar: se öppna förfrågningar i sitt område, visa detalj med deltagare, matcha och skapa bokningar. Kundsidan förblir WebView.

## Feature Inventory

| Feature | Webb | Native | Beslut |
|---------|------|--------|--------|
| Lista öppna requests | GET /api/group-bookings/available med geo | Native |
| Geo-filter: radius 25/50/100 km | Manuell input + "min position" | CLGeocoder + CoreLocation | Native |
| Kort: serviceType, plats, datum, deltagare | Renderas som kort | SwiftUI List | Native |
| Detalj: fullständig info + deltagare | GET /api/group-bookings/[id] | Native |
| Matchning: välj tjänst + datum + tid | POST /api/group-bookings/[id]/match | Native sheet |
| Tidsslots-förhandsvisning | Beräknas klientside | Beräknas i Swift | Native |
| Feature flag gate | `group_bookings` | NativeMoreView filtrerar | Native |

**Auth:** Befintliga endpoints använder session-auth. Nya native endpoints med Bearer.

## Approach

### 1. Native API endpoints

**GET `/api/native/group-bookings/available`** -- lista öppna requests
- Auth: `getAuthUser()` (Bearer)
- Feature flag: `group_bookings`
- Query params: `lat`, `lng`, `radius` (km)
- Returnerar: requests med avstånd, deltagare-count, serviceType
- Beräknar avstånd med Haversine (befintlig `calculateDistance`)

**GET `/api/native/group-bookings/[id]`** -- detalj med deltagare
- Auth: `getAuthUser()` (Bearer)
- Returnerar: request + participants[] (namn, antal hästar, status)

**POST `/api/native/group-bookings/[id]/match`** -- matcha
- Auth: `getAuthUser()` (Bearer)
- Body: `{ serviceId, bookingDate, startTime }`
- Delegerar till `GroupBookingService.matchRequest()`
- Returnerar: `{ bookingsCreated, message }`

### 2. iOS modeller (GroupBookingModels.swift)

- `GroupBookingRequest`: id, serviceType, locationName, address, lat, lng, dateFrom, dateTo, maxParticipants, status, notes, participantCount, distance
- `GroupBookingDetail`: allt ovan + participants[]
- `GroupBookingParticipant`: id, numberOfHorses, horseName, notes, status, firstName
- `GroupBookingMatchRequest`: serviceId, bookingDate, startTime

### 3. iOS ViewModel (GroupBookingsViewModel.swift)

- `loadAvailable(lat, lng, radius)` -- lista
- `loadDetail(id)` -- detalj
- `match(id, serviceId, bookingDate, startTime)` -- matcha
- CoreLocation integration for "min position"

### 4. iOS vyer

- `NativeGroupBookingsView.swift` -- lista med radius-picker
- Detalj i navigationDestination
- Match-sheet: tjänst-picker, datum, tid, förhandsvisning

### 5. Koppling i NativeMoreView

Byt WebView-fallback till native vy för `/provider/group-bookings`.

## Filer

| Fil | Aktion |
|-----|--------|
| `src/app/api/native/group-bookings/available/route.ts` | Ny |
| `src/app/api/native/group-bookings/available/route.test.ts` | Ny |
| `src/app/api/native/group-bookings/[id]/route.ts` | Ny |
| `src/app/api/native/group-bookings/[id]/route.test.ts` | Ny |
| `src/app/api/native/group-bookings/[id]/match/route.ts` | Ny |
| `src/app/api/native/group-bookings/[id]/match/route.test.ts` | Ny |
| `ios/Equinet/Equinet/GroupBookingModels.swift` | Ny |
| `ios/Equinet/Equinet/GroupBookingsViewModel.swift` | Ny |
| `ios/Equinet/Equinet/NativeGroupBookingsView.swift` | Ny |
| `ios/Equinet/Equinet/GroupBookingDetailView.swift` | Ny |
| `ios/Equinet/Equinet/GroupBookingMatchSheet.swift` | Ny |
| `ios/Equinet/Equinet/APIClient.swift` | Redigera |
| `ios/Equinet/Equinet/NativeMoreView.swift` | Redigera |
| `ios/Equinet/EquinetTests/GroupBookingsViewModelTests.swift` | Ny |

## TDD

Webb (Vitest BDD):
- GET available: 200 med requests, 401, 404 (flagga av)
- GET detail: 200, 401, 404
- POST match: 200 med bookingsCreated, 401, 403, 400

iOS (XCTest):
- `testLoadAvailableSuccess`
- `testLoadDetailSuccess`
- `testMatchSuccess`
- `testDistanceFormatting`

## Risker

- **Geo-beräkning**: Återanvänd befintlig Haversine-modul (`src/lib/geo/distance.ts`)
- **GroupBookingService DI**: matchRequest kräver att servicen instansieras med rätt beroenden
- **CoreLocation permission**: Behöver hantera när användaren nekar platsåtkomst
- **Sequential time slots**: Beräkna N tider baserat på tjänstens duration. Logik finns i webbens match-dialog.
