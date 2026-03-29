---
title: iOS Code Quality Review
description: Konkreta exempel på bra och problematiska mönster i Equinet iOS-appen
category: architecture
status: current
last_updated: 2026-03-29
sections:
  - Bra mönster
  - Problematiska mönster
  - Stora eller komplexa filer
  - Networking och error handling
  - State management
  - Testbarhet
---

# iOS Code Quality Review

## Bra mönster

### 1. ViewModel med protokoll-DI (alla ViewModels)

```swift
// BookingsViewModel.swift
protocol BookingsDataFetching: Sendable {
    func fetchBookings(status: String?) async throws -> [BookingsListItem]
    func updateBookingStatus(id: String, status: String) async throws
    // ...
}

@Observable @MainActor
final class BookingsViewModel {
    private let dataFetcher: BookingsDataFetching

    init(dataFetcher: BookingsDataFetching = APIClient.shared) { ... }
}
```

**Varför det är bra:** Varje ViewModel kan testas isolerat med mock-implementation. Alla 6 ViewModels följer detta mönster konsekvent. Testfilerna bekräftar att det fungerar i praktiken.

### 2. Optimistisk UI med rollback (alla mutations)

```swift
// ServicesViewModel.swift - deleteService()
let previousServices = services                    // Spara gammal state
services.removeAll { $0.id == serviceId }          // Optimistisk uppdatering
do {
    try await dataFetcher.deleteService(id: serviceId)
    UINotificationFeedbackGenerator().notificationOccurred(.success)
} catch {
    services = previousServices                     // Rollback vid fel
    UINotificationFeedbackGenerator().notificationOccurred(.error)
    self.error = "Kunde inte ta bort tjänsten"
}
```

**Varför det är bra:** Konsekvent mönster i alla ViewModels. Användaren ser omedelbar respons. Vid fel återgår allt till korrekt state. Haptic feedback förstärker resultatet.

### 3. Auth state machine (AuthManager)

```swift
enum AuthState {
    case checking, loggedOut, biometricPrompt, authenticated(MobileSession)
}
```

**Varför det är bra:** ContentView byter vy baserat på enum-state -- inga flags eller kombinationer. Varje state har tydlig betydelse. Exhaustive switch garanterar att alla states hanteras.

### 4. Feature flag-system med cache (AppCoordinator)

```swift
func loadFeatureFlags() async {
    // Ladda från UserDefaults först (omedelbar)
    if let cached = UserDefaults.standard.dictionary(forKey: "cachedFeatureFlags") as? [String: Bool] {
        self.featureFlags = cached
    }
    // Hämta färskt från server
    if let flags = try? await APIClient.shared.fetchFeatureFlags() {
        self.featureFlags = flags
        UserDefaults.standard.set(flags, forKey: "cachedFeatureFlags")
    }
}
```

**Varför det är bra:** Cache-first ger omedelbar UI. Bakgrundsuppdatering håller det aktuellt. Feature flags styr vilka menyalternativ och sidor som visas -- viktigt för gradvis migrering.

### 5. KeychainStorable-protokoll (AuthManager)

```swift
protocol KeychainStorable {
    static func save(key: String, value: String) -> Bool
    static func load(key: String) -> String?
    static func delete(key: String) -> Bool
}
```

**Varför det är bra:** Gör AuthManager testbar utan att blanda in riktig Keychain. MockKeychainHelper i testerna bekräftar mönstret.

### 6. Strukturerad loggning (AppLogger)

```swift
enum AppLogger {
    static let auth = Logger(subsystem: "com.equinet", category: "auth")
    static let network = Logger(subsystem: "com.equinet", category: "network")
    static let calendar = Logger(subsystem: "com.equinet", category: "calendar")
    // ...
}
```

**Varför det är bra:** Kategoriserade loggar gör filtrering i Console.app effektiv. Konsekvent användning i alla services och ViewModels.

---

## Problematiska mönster

### 1. NativeDashboardView -- all logik i vyn (555 rader)

```swift
// NativeDashboardView.swift -- API-anrop direkt i view
@State private var dashboard: DashboardResponse?
@State private var isLoading = true

private func loadDashboard() async {
    // Cache-logik
    if let cached = SharedDataManager.loadDashboardCache() {
        dashboard = cached
        isLoading = false
    }
    // API-anrop
    do {
        let response = try await APIClient.shared.fetchDashboard()
        dashboard = response
        SharedDataManager.saveDashboardCache(response)
    } catch { ... }
}
```

**Varför det är problematiskt:** Alla andra vyer delegerar till ViewModels. Dashboard gör allt inline: API-anrop, cache, UserDefaults, felhantering. Resultatet: 0 unit-tester för Dashboard-logik. Varje ny dashboard-feature ökar vyns komplexitet ytterligare.

### 2. Hårdkodade brand-färger (3 filer)

```swift
// NativeLoginView.swift
Color(red: 34/255, green: 139/255, blue: 34/255)

// BiometricPromptView.swift
Color(red: 34/255, green: 139/255, blue: 34/255)

// SplashView.swift
Color(red: 34/255, green: 139/255, blue: 34/255)
```

`Color.equinetGreen` definieras i `Color+Brand.swift` men används inte i dessa 3 filer.

### 3. DateFormatter-duplicering (4+ platser)

```swift
// NativeReviewsView.swift
private static let isoFormatter: ISO8601DateFormatter = { ... }()
private static let displayFormatter: DateFormatter = { ... }()

// BookingDetailSheet.swift
private static let dateFormatter: DateFormatter = { ... }()

// ExceptionFormSheet.swift
private static let dateFormatter: DateFormatter = { ... }()
private static let isoFormatter: ISO8601DateFormatter = { ... }()
```

Varje vy skapar sina egna DateFormatters. Samma format (ISO8601, svenskt datum) definieras oberoende på 4+ platser.

### 4. Haptic feedback-duplicering (20+ förekomster)

```swift
// Förekommer i ServicesViewModel, ReviewsViewModel, BookingsViewModel, CustomersViewModel, ProfileViewModel, CalendarViewModel
UINotificationFeedbackGenerator().notificationOccurred(.success)
UINotificationFeedbackGenerator().notificationOccurred(.error)
UIImpactFeedbackGenerator(style: .medium).impactOccurred()
```

Samma rad upprepas i varje mutations-metod i alla ViewModels. Ingen delad hjälpfunktion.

### 5. Error view-duplicering (3 WebView-filer)

Identisk error-vy (retry-knapp, felikon, "Försök igen"-text) definieras separat i `WebViewTab.swift`, `CustomerWebView.swift` och implicit i `MoreWebView`. Ingen delad `ErrorStateView`.

### 6. NSNull i ProfileViewModel

```swift
// ProfileViewModel.swift
var data: [String: Any] = [
    "firstName": firstName,
    "phone": phone.isEmpty ? NSNull() : phone,  // NSNull för nil
    // ...
]
```

Ovanligt Swift-mönster. Använder `NSNull()` för att representera JSON null vid manuell dictionary-serialisering. Borde använda optional-hantering eller Encodable structs.

### 7. LAContext skapas multipla gånger (AuthManager)

```swift
// AuthManager.swift -- skapas på 4 ställen
let context = LAContext()  // rad 58
let context = LAContext()  // rad 117
let context = LAContext()  // rad 201
let context = LAContext()  // rad 213
```

LAContext är billig men mönstret antyder att biometrisk logik borde centraliseras.

---

## Stora eller komplexa filer

| Fil | Rader | Komplexitet | Problem |
|-----|-------|-------------|---------|
| **NativeBookingsView** | 746 | Hög | 6 sheet-typer, 4 filter, statusfärg-logik, context menus. Största vyn. |
| **NativeCalendarView** | 733 | Hög | Geometri-beräkningar, tidspositionering, ScrollView-paging. Men väl isolerad. |
| **CustomerDetailView** | 653 | Medel-hög | 3 flikar (översikt, hästar, anteckningar) med inline-formulär för alla tre. |
| **APIClient** | 564 | Hög | ~32 endpoints, token-refresh, felhantering. För många ansvar i en fil. |
| **NativeDashboardView** | 555 | Hög | Ingen ViewModel, all logik inline. Svårt att testa och underhålla. |
| **WebView** | 470 | Medel | CSS-injektion, cookie-hantering, bridge-setup, feldetektering. Nödvändig komplexitet. |
| **NativeProfileView** | 447 | Medel | 2 flikar (Profil/Inställningar). Toggle-bindings skapar Tasks. Hanterbart. |
| **CustomersViewModel** | 440 | Medel | Hanterar kunder + hästar + anteckningar (3 entiteter). Justifierad storlek. |

### Bedömning

NativeBookingsView och NativeCalendarView är stora men har väl definierade avgränsningar. Det som gör dem hanterbara är att ViewModels tar alla mutationer.

NativeDashboardView och APIClient är de filer som skapar mest friktion vid ändring.

---

## Networking och error handling

### APIClient-mönster

```swift
enum APIError: Error {
    case noToken, unauthorized, networkError(Error), serverError(Int),
         decodingError(Error), rateLimited(retryAfter: Int?), timeout
}
```

**Styrka:** Komplett feltyp-enum som täcker verkliga scenarier.

**Problem:**
- **Token-refresh race condition:** `isRefreshing`-flagga räknar inte med parallella 401:or. Två samtida requests kan båda trigga refresh.
- **Inkonsekvent dekodning:** Ibland wrappas dekodfel i `APIError.decodingError`, ibland propageras de direkt.
- **Ingen retry-strategi för 5xx:** Omedelbar retry vid 401, men ingen backoff för serverfel.
- **Rate limit-info oanvänd:** `retryAfter` sparas men ingen anropare använder den för att vänta.

### ViewModel-felhantering

Konsekvent mönster: catch -> sätt error-string -> visa i UI. Men:
- `detailError` i CustomersViewModel sätts men används inte i CustomerDetailView
- Inga specifika felmeddelanden per feltyp (generisk "Kunde inte X")
- Ingen retry-exponering utom `.refreshable` (pull-to-refresh)

### Keychain-felhantering

```swift
// KeychainHelper.swift -- print() istället för loggning
if status != errSecSuccess {
    print("Keychain save error: \(status)")  // Borde vara AppLogger
    return false
}
```

Keychain-fel loggas med `print()` istället för strukturerad loggning via `AppLogger`. Anropare ignorerar return-värden tyst.

---

## State management

### Bra mönster

- `@Observable` + `@MainActor` genomgående i ViewModels och services
- Ingen `DispatchQueue.main.async` -- modern Swift concurrency throughout
- Auth state machine med enum driver vyval
- Feature flags med cache-first-mönster

### Problematiska mönster

- **Dashboard: @State äger data** -- vyn äger `dashboard: DashboardResponse?` direkt. Alla andra vyer delegerar till ViewModel.
- **Pending navigation via mutabel state** i AppCoordinator: `pendingMorePath`, `pendingBookingId`. Potentiella race conditions om flera djuplänk-events kommer snabbt.
- **Timer-baserade transitions** (0.5s splash, 3s reconnected-banner) med hårdkodade värden. Inte testbara.
- **Binding(get:set:) i NativeProfileView** skapar ny Task vid varje toggle-ändring -- fungerar men är fragilt.

---

## Testbarhet

### Testad kod (158 tester)

| Testfil | Antal | Vad som testas |
|---------|-------|----------------|
| CalendarViewModelTests | 16 | Data-laddning, filtrering, exceptions, cache |
| BookingsViewModelTests | 19 | CRUD, optimistisk UI, rollback, filter |
| CustomersViewModelTests | 21 | CRUD kunder/hästar/anteckningar, filtrering |
| ServicesViewModelTests | 17 | CRUD, toggle, optimistisk UI |
| ReviewsViewModelTests | 16 | Pagination, reply, delete, rollback |
| ProfileViewModelTests | 13 | Laddning, uppdatering, inställningar |
| CalendarModelsTests | 12 | Dekodning, copy-constructors |
| CalendarSyncManagerTests | 7 | EventKit-synk, mapping |
| AuthManagerTests | 7 | Login, logout, token-hantering |
| BridgeHandlerTests | 1 | Grundläggande meddelandehantering |
| PendingActionStoreTests | 5 | Persistens, retry-logik |
| SpeechRecognizerTests | 12 | Init, start/stop, tillstånd |
| MoreMenuTests | 12 | Feature flag-filtrering, menystruktur |

### Otestad kod

| Komponent | Rader | Anledning |
|-----------|-------|-----------|
| NativeDashboardView (logik) | ~100 | Ingen ViewModel att testa |
| APIClient (nätverk) | ~400 | Singleton, hårdkodad URLSession |
| WebView (bridge, CSS) | ~300 | UIKit-beroende |
| SharedDataManager | ~150 | Statisk enum, ingen DI |
| Alla vyer (UI-logik) | ~4000 | SwiftUI vyer är svåra att unit-testa |

### Testbarhetens styrkor

- Alla ViewModels kan testas isolerat tack vare protokoll-DI
- MockKeychainHelper finns för AuthManager
- Testinfrastrukturen är på plats -- nya ViewModels får tester "gratis"

### Testbarhetens svagheter

- APIClient är otestbar utan att extrahera URLSession-beroendet
- SharedDataManager är statisk enum utan DI
- Ingen snapshot-testning för vyer
- BridgeHandler har bara 1 test -- fragilt för 20 meddelandetyper
