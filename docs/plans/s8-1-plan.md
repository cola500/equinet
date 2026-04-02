---
title: "S8-1: Annonsering native iOS"
description: "Plan for migrating the announcements screen from WebView to native SwiftUI"
category: plan
status: wip
last_updated: 2026-04-02
sections:
  - Feature Inventory
  - Beslut
  - Approach
  - Filer som andras/skapas
  - Risker
---

# S8-1: Annonsering native iOS

## Feature Inventory

Webb-sidan `/provider/announcements` har foljande features:

| Feature | Webb | Native | Beslut |
|---------|------|--------|--------|
| Lista egna annonser (open/completed/cancelled) | GET `/api/route-orders?announcementType=provider_announced` | Native lista | **Native** -- enkel lista, passar SwiftUI List |
| Visa status per annons (open/in_route/completed/cancelled) | Badge + fargkodning | Native badge | **Native** -- enkel View-logik |
| Visa bokningsantal per annons | `_count.bookings` | Native text | **Native** -- data fran API |
| Visa tjanstetyp, datum, kommun, specialinstruktioner | Text i varje card | Native VStack | **Native** -- ren data-rendering |
| Skapa ny annons (tjanstevals, kommun, datum, instruktioner) | POST `/api/route-orders`, form med multi-select | WebView offload | **Offload** -- komplex form med MunicipalitySelect + multi-select tjanster + datepicker + validering. Stor implementation for liten vinst. |
| Avbryt annons (confirm-dialog) | PATCH `/api/route-orders/[id]` status: cancelled | Native dialog | **Native** -- enkel bekraftelse + PATCH |
| Visa annonsdetaljer + bokningar | GET `/api/route-orders/[id]/bookings` | WebView offload | **Offload** -- komplex tabell med kundinfo, statusandringar, bekrafta/avbryt-knappar per bokning. Migreras i framtida sprint. |
| Navigera till "Skapa ny" | Link till `/provider/announcements/new` | WebView push | **Offload** -- samma som ovan |
| Navigera till annonsdetalj | Link till `/provider/announcements/[id]` | WebView push | **Offload** -- samma som ovan |

### Auth-verifiering

- GET `/api/route-orders` -- anvander `auth()` (session-cookie). **Behover native endpoint med Bearer JWT.**
- PATCH `/api/route-orders/[id]` -- anvander `auth()`. **Behover native endpoint eller offloada till WebView.**
- Feature flag: `route_announcements` (maste kontrolleras)

## Beslut

1. **Native lista + WebView offload for skapa/detalj** -- Listan ar den primara interaktionen. Skapa och detaljvyer ar komplexa och anvands mer sallan.
2. **Aggregerat API** -- `/api/native/announcements` med Bearer JWT returnerar lista + bokningsantal + statusar i ett anrop.
3. **Avbryt annons native** -- Enkel PATCH, gor native med confirm-dialog.
4. **Avbryt-endpoint** -- `/api/native/announcements/[id]/cancel` med Bearer JWT (enklare an att migrera hela PATCH-routen).
5. **Navigering till WebView** -- "Skapa ny" och detaljklick oeffnar WebView via `pendingMorePath`.

## Approach

### Fas 1: API (BDD dual-loop)
1. RED: Integrations- + unit-tester for `/api/native/announcements` (GET)
2. RED: Integrations- + unit-tester for `/api/native/announcements/[id]/cancel` (POST)
3. GREEN: Implementera endpoints med `authFromMobileToken`, rate limit, Zod, feature flag gate

### Fas 2: iOS modeller + ViewModel
4. Codable structs i `AnnouncementModels.swift`
5. `AnnouncementsViewModel.swift` med DI-protokoll (`AnnouncementsDataFetching`)
6. XCTest for ViewModel (mock-adapter)

### Fas 3: iOS vy + routing
7. `NativeAnnouncementsView.swift` -- lista med status-badges, bokningsantal, avbryt-dialog
8. Koppla in NativeMoreView routing (native vy istallet for WebView)
9. APIClient-metoder: `fetchAnnouncements()`, `cancelAnnouncement(id:)`
10. SharedDataManager-cache (5 min TTL)

### Fas 4: Verifiering
11. `npm run check:all`
12. iOS-tester (ViewModel + eventuell API)
13. Visuell verifiering med mobile-mcp

## Filer som andras/skapas

### Nya filer
- `src/app/api/native/announcements/route.ts` -- aggregerat GET
- `src/app/api/native/announcements/[id]/cancel/route.ts` -- POST cancel
- `src/__tests__/api/native/announcements/route.test.ts`
- `src/__tests__/api/native/announcements/cancel.test.ts`
- `ios/Equinet/Equinet/AnnouncementModels.swift`
- `ios/Equinet/Equinet/AnnouncementsViewModel.swift`
- `ios/Equinet/Equinet/NativeAnnouncementsView.swift`

### Andrade filer
- `ios/Equinet/Equinet/NativeMoreView.swift` -- routing for native vy
- `ios/Equinet/Equinet/APIClient.swift` -- nya metoder
- `ios/Equinet/Equinet/SharedDataManager.swift` -- cache
- `docs/sprints/status.md` -- status

## Risker

1. **Feature flag `route_announcements`** -- maste verifieras att den ar pa i dev. Om inte, gate returnerar 404.
2. **MunicipalitySelect i skapa-form** -- offloadad till WebView, men navigeringen tillbaka till native efter skapa behover testas.
3. **RouteOrder-modellen ar delad** (customer_initiated + provider_announced) -- native endpoint maste filtrera pa `announcementType`.
