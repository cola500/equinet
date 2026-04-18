---
title: "S32-2: Native bokningsdetalj-vy"
description: "Plan för att skapa NativeBookingDetailView och wira navigering från bokningslistan"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Aktualitet verifierad
  - Feature Inventory
  - Auth-analys
  - Approach
  - Implementation
  - Filer
  - Tester
  - Risker
---

# S32-2: Native bokningsdetalj-vy

## Aktualitet verifierad

**Kommandon körda:** `ls ios/Equinet/Equinet/Native*.swift`, `grep -n "onNavigateToWeb\|BookingDetailSheet" NativeBookingsView.swift`, `grep -n "onNavigateToBooking" AuthenticatedView.swift`  
**Resultat:** Bekräftat att `NativeBookingDetailView.swift` inte existerar. `NativeBookingsView` har ingen detail-navigation. `BookingDetailSheet` (kalender) navigerar via WebView-fallback.  
**Beslut:** Fortsätt -- problemet är reellt.

## Feature Inventory

**Webb-vy `/provider/bookings` visar (per booking card):**
- Status-badge (väntande/bekräftad/genomförd/avbokad/uteblev)
- Tjänst + pris
- Kund (namn, email, telefon)
- Datum + tid
- Häst (namn, ras, länk till hästtidslinje)
- Leverantörsanteckningar + kundanteckningar
- Avbokningsmeddelande
- Betalningsbadge (betald, fakturanummer)
- Återkommande/Manuell-badges
- Actions: Bekräfta, Avvisa, Genomförd, Uteblev, Avboka, Anteckning, Recensera

**Befintligt i `BookingsListItem`:** ALLA ovanstående fält -- id, bookingDate, startTime, endTime, status, serviceName, servicePrice, customerFirstName/LastName/Email/Phone, horseName, horseId, horseBreed, isPaid, invoiceNumber, isManualBooking, bookingSeriesId, customerNotes, providerNotes, cancellationMessage, customerReview

**Slutsats:** Ingen ny API-route behövs. Detaljvyn återanvänder data som redan hämtas i listan.

## Auth-analys

- `/api/native/bookings` använder `getAuthUser(request)` som stöder Bearer JWT
- `/api/bookings/[id]` (PUT för statusändring) använder `getAuthUser(request)` -- stöder Bearer JWT
- `/api/native/bookings/[id]/review` och `/api/native/bookings/[id]/quick-note` -- Bearer JWT
- **Ingen ny route behövs, ingen auth-ändring behövs**

## Approach

**Strategi:** Layer-by-layer (ren iOS-vy, inga nya webb-routes)

**Ingen ny ViewModel** -- `BookingsViewModel` har alla action-metoder. Detaljvyn tar `BookingsViewModel` som parameter för actions + optimistic UI via befintlig logik.

**Navigation:**
- Lägg `NavigationStack` i `NativeBookingsView` (varje Tab bör äga sin NavigationStack)
- `BookingCard` i listan: card-body är tappbar (utom action-knappar) -> NavigationLink till `NativeBookingDetailView`
- Kalender-flöde: `BookingDetailSheet`'s "Hantera bokning" navigerar via `onNavigateToBooking` callback (redan befintlig) som tar till bookings-tab + highlightar bokning -- OFÖRÄNDRAT för nu

## Implementation

### Fas 1: NativeBookingDetailView (ny fil)

**Sektioner:**
1. Status-badge (stor)
2. Kund: namn (klickbar tel), email
3. Tjänst + pris + datum/tid
4. Häst: namn, ras, länk till hästtidslinje (onNavigateToWeb)
5. Anteckningar: kundmeddelande, leverantörsanteckningar
6. Betalning: betald/obetald, fakturanummer
7. Badges: återkommande, manuell
8. Befintlig kundrecension (om finns)
9. Action-sektion (status-beroende): samma knappar som i card men mer prominent

**Actions (delegeras till BookingsViewModel):**
- pending: Bekräfta, Avvisa
- confirmed: Genomförd, Uteblev, Avboka, Anteckning
- completed: Anteckning, Recensera kund (om ej gjort)
- cancelled/no_show: Anteckning

**Sheets:**
- Återanvänd `CancelBookingSheet` (från NativeBookingsView)
- Återanvänd `ReviewBookingSheet` (från NativeBookingsView)
- Återanvänd `QuickNoteSheet`

**Haptic:** `.sensoryFeedback(.success/.error, trigger:)` på statusändringar

### Fas 2: Uppdatera NativeBookingsView

- Lägg till `NavigationStack` som wrapper för hela vyn
- Lägg till `@State private var selectedBooking: BookingsListItem?` för navigation
- Lägg till `.navigationDestination(for: BookingsListItem.self)` med `NativeBookingDetailView`
- I `bookingsList`: lägg `NavigationLink(value: booking)` som wrapper för `BookingCard` -- men UTAN att blockera action-knapparnas klick. Lösning: action-knappar har `Button(type: .button)` och NavigationLink wrappa bara card-layout utan buttons.

**OBS:** Eftersom BookingCard har inline action-knappar som inte ska trigga navigation, behöver vi en annan approach. Lösning: ta bort inline action-knappar från listan-kortet (förenkla till summary-kort) och flytta dem till detaljvyn. Eller: behåll kortens actions men lägg till en "Öppna"-knapp/chevron.

**Enklast:** Behåll alla actions i kortet men lägg till en chevron/tap-yta längst upp på kortet som navigerar till detail.

### Fas 3: Tester (BookingDetailViewModelTests -- egentligen BookingsViewModel-scenarier)

Skapa `BookingDetailViewModelTests.swift` som testar detaljvy-specifika scenarios via `BookingsViewModel`:
1. confirmBooking -> status uppdateras optimistiskt
2. confirmBooking API-fel -> status återställs, error visas  
3. completeBooking -> status uppdateras
4. completeBooking API-fel -> återställs
5. cancelBooking med meddelande -> status uppdateras
6. cancelBooking API-fel -> återställs
7. markNoShow -> status uppdateras
8. markNoShow API-fel -> återställs
9. submitReview för completed-bokning -> review läggs till
10. saveQuickNote -> providerNotes uppdateras
11. declineBooking -> status -> cancelled
12. declineBooking API-fel -> återställs

## Filer

| Fil | Åtgärd |
|-----|--------|
| `ios/Equinet/Equinet/NativeBookingDetailView.swift` | NY |
| `ios/Equinet/Equinet/NativeBookingsView.swift` | ÄNDRA (NavigationStack + navigation) |
| `ios/Equinet/EquinetTests/BookingDetailViewModelTests.swift` | NY |

**Inga ändringar i:**
- `BookingsModels.swift` -- data räcker redan
- `BookingsViewModel.swift` -- actions finns redan
- `AuthenticatedView.swift` -- navigation-mönster oförändrat
- Webb-kod -- inga ändringar

## Tester

- `BookingDetailViewModelTests.swift`: 12 tester via BookingsViewModel + MockAPIClient
- Kör: `xcodebuild test ... -only-testing:EquinetTests/BookingDetailViewModelTests`

## Risker

- **NavigationLink + inline action-knappar**: SwiftUI List + NavigationLink + Buttons kan ge konflikt. Lösning: ha action-knappar "utanför" NavigationLink med `.simultaneousGesture` eller separat knapp för navigering.
- **NativeBooking vs BookingsListItem**: Kalendervyn använder `NativeBooking`, bokningslistan `BookingsListItem`. Detaljvyn tar `BookingsListItem`. Kalenderfallet navigerar till bokningslistan (befintlig) -- ingen ändring behövs för kalender-flödet nu.
