---
title: iOS Native-First Rebuild
description: Inkrementell ombyggnad av hybrid WKWebView-app till native-first SwiftUI med Coordinator Pattern
category: architecture
status: draft
last_updated: 2026-03-12
sections:
  - Kontext
  - Arkitektur
  - Kalender-fix
  - Steg-for-steg-plan
  - iOS Expert Agent
  - Kritiska filer
  - Verifiering
tags: [ios, swiftui, native, coordinator-pattern, calendar]
---

# iOS Native-First Rebuild

## Kontext

Equinets iOS-app ar idag en hybrid WKWebView-app som wrappar Next.js-webappen. Trots att vi byggt flera native features (login, kalender, push, speech, widget) kanns appen fortfarande "webbig":

- **Kalenderns swipe buggar** -- UIPageViewController skapar gesture-konflikter
- **Navigering mellan sidor** ger vita blinkar, inga overgangsanimationer
- **Dialoger ar for stora** pa mobil (t.ex. manuell bokning kraver scrollning)
- **UI-komponenter** ser ut som webbkomponenter, inte native iOS

**Mal:** Bygga om leverantorsflodet till native SwiftUI med Coordinator Pattern, inkrementellt -- ett steg i taget. WebView behalls for sekundara sidor.

---

## Arkitektur: Pragmatisk Coordinator Pattern

### Varfor Coordinator Pattern

1. **Matchar webbens DDD-Light** -- Repository + Service + ViewModel speglar webbens lagerstruktur
2. **Langsiktigt hallbar** -- nar fler vyer gar native skalar arkitekturen
3. **Testbar** -- navigeringslogik och affarslogik kan testas separat

### Appstruktur

```
EquinetApp
  ContentView (auth state machine -- BEHALLS)
    AuthenticatedView (NY)
      AppCoordinator (@Observable)
        TabView (5 flikar)
        |
        |-- CalendarCoordinator
        |     CalendarRepository (protocol)
        |     CalendarViewModel (befintlig, utokad)
        |     CalendarDayView (NY -- SwiftUI scroll-paging)
        |     BookingDetailView (refaktorerad fran sheet)
        |
        |-- BookingsCoordinator
        |     BookingRepository (protocol)
        |     BookingListViewModel
        |     BookingListView
        |     BookingDetailView (delad med kalender)
        |
        |-- CustomersCoordinator
        |     CustomerRepository (protocol)
        |     CustomerListViewModel + CustomerDetailViewModel
        |     CustomerListView + CustomerDetailView
        |
        |-- DashboardCoordinator (WebView-fallback initialt)
        |
        |-- MoreCoordinator (WebView-fallback)
              WebView (befintlig) + BridgeHandler (befintlig)
```

### Coordinator-design (konkreta klasser, inget protokoll)

Varje Coordinator ar en konkret `@Observable @MainActor` klass -- inget gemensamt `Coordinator`-protokoll med `associatedtype` (skapar type-erasure-problem for 5 kanda typer). Varje Coordinator ager sin `NavigationPath` och vet hur man navigerar till detalj-vyer.

```swift
@Observable
@MainActor
class AppCoordinator {
    var selectedTab: Tab = .calendar
    var calendarCoordinator = CalendarCoordinator()
    var bookingsCoordinator = BookingsCoordinator()
    var customersCoordinator = CustomersCoordinator()

    // Agare av delade beroenden
    let authManager: AuthManager
    let bridge: BridgeHandler
    let networkMonitor: NetworkMonitor

    // Push-notification routing
    func handleDeepLink(_ url: URL) {
        // Parse URL -> valj ratt tab + push detalj-vy
    }
}
```

AppCoordinator ager `selectedTab` och koordinerar mellan flikar (t.ex. push-notification -> ratt flik + detalj). Den ager ocksa `BridgeHandler`, `NetworkMonitor` och observerar `AuthManager.state` for global logout-hantering.

### Repository-protokoll (DDD-monster)

```swift
protocol CalendarRepositoryProtocol {
    func fetchDay(date: Date) async throws -> CalendarDay
    func fetchBookingDetail(id: String) async throws -> NativeBooking
}

protocol BookingRepositoryProtocol {
    func fetchBookings(status: BookingStatus?, from: Date?, to: Date?) async throws -> [BookingListItem]
    func confirmBooking(id: String) async throws -> NativeBooking
    func cancelBooking(id: String) async throws
}

protocol CustomerRepositoryProtocol {
    func fetchCustomers(search: String?) async throws -> [CustomerListItem]
    func fetchCustomerDetail(id: String) async throws -> CustomerDetail
}
```

Konkreta implementationer (`APICalendarRepository`, `APIBookingRepository`, etc.) anvander befintliga `APIClient`. Mock-implementationer for tester och previews.

### ViewModel-monster (foljande CalendarViewModels befintliga DI-pattern)

```swift
@Observable
@MainActor
class BookingListViewModel {
    private let repository: BookingRepositoryProtocol
    var bookings: [BookingListItem] = []
    var isLoading = false
    var error: String?
    var statusFilter: BookingStatus?

    init(repository: BookingRepositoryProtocol) {
        self.repository = repository
    }

    func loadBookings() async { ... }
    func confirmBooking(_ id: String) async { ... }
}
```

---

## Kalender-fix: SwiftUI Scroll-Paging

### Problem

Nuvarande implementation anvander `UIPageViewController` via `UIViewControllerRepresentable` (`PagedDayView`). Detta skapar 3 lager: UIPageViewController > UIHostingController > UIScrollView, som leder till gesture-konflikter mellan horisontell swipe och vertikal scroll.

### Losning: iOS 17 ScrollView + scrollTargetBehavior

Nested ScrollViews: yttre horisontell for dag-paging, inre vertikal for tidsrutnat.

```swift
// Yttre: horisontell dag-paging
ScrollView(.horizontal) {
    LazyHStack(spacing: 0) {
        ForEach(dateRange, id: \.self) { date in
            // Inre: vertikal scroll for tidsrutnat (11h * 64pt = 704pt)
            ScrollView(.vertical) {
                DayColumnView(date: date, viewModel: viewModel)
            }
            .refreshable { await viewModel.loadDay(date) }
            .containerRelativeFrame(.horizontal)
        }
    }
    .scrollTargetLayout()
}
.scrollTargetBehavior(.paging)
.scrollPosition(id: $selectedDateId)
```

**Datum-hantering:**
- `dateRange`: Array av `Date` med +/- 30 dagar fran idag (utokningsbar vid behov)
- `selectedDateId`: `Binding<Date?>` som synkar med `viewModel.selectedDate`
- "Idag"-knapp satter `selectedDateId = Date()` for programmatisk scroll
- Pull-to-refresh via `.refreshable {}` pa inre `ScrollView(.vertical)` (ersatter UIRefreshControl)

**Fordelar:**
- 2 tydliga scroll-lager med native gesture-disambiguation (iOS hanterar horisontell vs vertikal automatiskt)
- `LazyHStack` renderar bara synliga dagar (performance)
- `scrollPosition(id:)` synkar med ViewModel
- `containerRelativeFrame` saker att varje dag fyller skarmen
- Inga UIKit-bridging-buggar
- `.refreshable` ger native pull-to-refresh utan UIKit

**Migration:** `PagedDayView.swift` (UIViewControllerRepresentable) ersatts helt. `NativeCalendarView` refaktoreras att anvanda den nya scroll-baserade paging direkt.

---

## Steg-for-steg plan

### Steg 0: iOS Expert Agent (~1 timme)

Skapa `.claude/agents/ios-expert.md` -- en specialiserad agent med kunskap om:
- SwiftUI best practices (iOS 17+)
- Coordinator Pattern for SwiftUI
- WKWebView-bridging
- Equinets specifika iOS-arkitektur

Agenten anvands for code review och teknisk radgivning under alla foljande steg.

### Steg 1: Grundskelett (~2-3 dagar)

**Mal:** Ny arkitektur pa plats, appen fungerar exakt som forut.

- Skapa `AppCoordinator` med `selectedTab`, tab-routing, och agande av `BridgeHandler` + `NetworkMonitor`
- Skapa `AuthenticatedView` med `TabView` (5 flikar: Kalender, Bokningar, Kunder, Dashboard, Mer)
- Migrera overlay-logik fran ContentView (offline-banner, reconnected-banner, progress, splash) till AuthenticatedView
- Varje flik wrappar befintlig `WebView` med ratt URL-path
- Flytta kalender-tab till `CalendarCoordinator` (anvander befintlig `NativeCalendarView` -- annu ej fixad)
- ContentView delegerar till `AuthenticatedView` efter auth
- AppCoordinator observerar `AuthManager.state` for global logout (alla native-vyer dismissas)
- Fixa `print()` i AuthManager -> AppLogger (cleanup)
- Verifiera: bridge, push, speech, auth, widget, offline-banner fungerar som forut

**Notering:** Kunder ar ny flik (nuvarande NativeTabBar har 4: dashboard, kalender, bokningar, mer). Design-review av tab-layouten behovs.

**Kritiska filer:**
- `ContentView.swift` -- restructure, flytta overlay-logik
- `AuthManager.swift` -- print() -> AppLogger cleanup
- Nya: `AppCoordinator.swift`, `AuthenticatedView.swift`, `CalendarCoordinator.swift`, `WebViewTab.swift`

### Steg 1: KLART (session 2026-03-12)

**Resultat:**
- `AppCoordinator.swift` -- NY, ager selectedTab + bridge + networkMonitor + calendarViewModel
- `AuthenticatedView.swift` -- NY, TabView med 4 flikar + overlays
- `WebViewTab.swift` -- NY, WebView-wrapper med onRequestNativeCalendar callback
- `ContentView.swift` -- forenklad, delegerar till AuthenticatedView
- `AuthManager.swift` -- print() -> AppLogger.auth (2 stallen)
- `AppLogger.swift` -- ny `app`-kategori
- `NativeTabBar.swift` -- orphaned (inte refererad langre, kan tas bort)
- 48 tester, 0 failures, bygger utan fel

### Steg 2: Fixa kalendern -- KLART (session 2026-03-12)

**Mal:** Kalender-swipe fungerar smooth med native-kansla.

**Faser:**

#### Fas 1: TDD -- ViewModel-tester for scroll-position
- Lagg till `dateRange` computed property i CalendarViewModel (+/- 30 dagar, normaliserade till `startOfDay`)
- Lagg till `selectedDateId` property (normaliserad Date for scroll-position-synk)
- Tester: dateRange generering, selectedDateId uppdatering, navigateToDay med normalisering

#### Fas 2: Veckoband-komponent
- Ny `WeekStripView` -- 7 cirklar med dag/datum ovanfor tidsrutnat
- Aktiv dag markerad med accentfarg
- Tap pa dag -> direkt navigering (inget swipe kravs)
- UX-feedback: detta ar ett etablerat iOS-monster (Apple Kalender, Google Kalender)

#### Fas 3: SwiftUI scroll-paging (ersatt PagedDayView)
- Yttre ScrollView(.horizontal) + scrollTargetBehavior(.paging)
- Inre ScrollView(.vertical) + .refreshable {} for tidsrutnat
- LazyHStack for performance (renderar bara synliga dagar)
- containerRelativeFrame(.horizontal) for full-bredd per dag
- scrollPosition(id: $selectedDateId) synkar med ViewModel
- **GOTCHA**: Normalisera ALLA datum till startOfDay (Date hashning)
- **GOTCHA**: Debounce onChange(of: selectedDateId) vid snabb swipe
- **GOTCHA**: containerRelativeFrame inkluderar INTE safe area automatiskt
- **GOTCHA**: Programmatisk scroll (Idag-knapp) kraver withAnimation {}
- Ta bort PagedDayView (UIPageViewController) fran NativeCalendarView

#### Fas 4: BookingDetailSheet forbattring
- Fixa deprecated NavigationView -> NavigationStack
- Behall sheet-presentation (UX-feedback: sheet ar bra for snabbkoll)
- Forbattra haptic: .sensoryFeedback istallet for UIImpactFeedbackGenerator i nya vyer

#### Fas 5: Verifiering
- xcodebuild build -- bygger utan fel
- xcodebuild test -- alla tester grona (inklusive nya)
- Smooth horisontell swipe, vertikal scroll, pull-to-refresh
- "Idag"-knapp navigerar korrekt
- Bokningsblock renderas pa ratt tid/position
- Haptic feedback pa dag-byte

**Kritiska filer:**
- `NativeCalendarView.swift` -- stor refaktorering (ta bort PagedDayView, lagg till scroll-paging)
- `CalendarViewModel.swift` -- dateRange, selectedDateId, startOfDay-normalisering
- `BookingDetailSheet.swift` -- NavigationView -> NavigationStack
- Nya: `WeekStripView.swift`
- Tester: utoka `CalendarViewModelTests.swift`

**Agent-feedback att beakta:**
- iOS Expert: scrollPosition + Date kraver startOfDay-normalisering, debounce vid snabb swipe, containerRelativeFrame + safe area
- UX Reviewer: veckoband ovanfor kalender (Apple Kalender-monster), behall sheet for bokningsdetaljer (inte NavigationStack-push)

### Steg 2: KLART (session 2026-03-12)

**Resultat:**
- `NativeCalendarView.swift` -- ScrollView(.horizontal) + scrollTargetBehavior(.paging) ersatter UIPageViewController
- `CalendarViewModel.swift` -- dateRange (+/- 30 dagar), selectedDateId, weekDates, bookingsForDate, scroll-position-synk
- `WeekStripView.swift` -- NY, 7-dagars veckoband ovanfor kalender
- `BookingDetailSheet.swift` -- NavigationView -> NavigationStack, haptic feedback
- `CalendarModels.swift` -- date computed property, withStatus copy-metod, serviceId (optional)
- Tester: 16 CalendarViewModel-tester, 12 CalendarModels-tester (alla grona)

### Steg 2.5: Post-implementation bugfixar (session 2026-03-12)

**Problem:** Manuell testning pa enhet avslojade 4 buggar efter Steg 1+2.

| Bugg | Rotorsak | Fix |
|------|----------|-----|
| Dubbla tab-bars (native + webb) | WebView visar webbens BottomTabBar bredvid SwiftUI TabView | CSS-injektion: `nav[class*="fixed"][class*="bottom-0"] { display: none !important }` |
| Webb-header synlig i WebView-tabs | WebView visar webbens Header-komponent | CSS-injektion: `header.border-b { display: none !important }` |
| "Mer"-tab ger 404 | `/provider/menu` ar en Drawer i webben, inte en route | NativeMoreView.swift -- NavigationStack + List med meny-items, NavigationLink pushar MoreWebView |
| Kalender "serverfel" | `/api/native/calendar` returnerar 404 (dev-server behover restart) | Debug-loggning i APIClient, route finns redan -- trolig Turbopack hot-reload issue |

**Andrade filer:**
- `WebView.swift` -- CSS doljer webbens nav + header, `padding-bottom: 0` (SwiftUI TabView hanterar safe area)
- `NativeMoreView.swift` -- NY, native Mer-meny med NavigationStack + MoreWebView wrapper
- `AppCoordinator.swift` -- `.more.webPath` -> `nil`
- `AuthenticatedView.swift` -- Mer-tab anvandar NativeMoreView istallet for WebViewTab
- `APIClient.swift` -- debug-loggning av HTTP-status + response body for icke-2xx svar

**Key learnings:**
- CSS-injektion i WKWebView for att dolja webbens chrome (nav, header) -- specifika selektorer, `!important`
- NativeMoreView NavigationStack-monster: native meny -> WebView-push for sub-sidor
- Turbopack hot-reload registrerar inte alltid nya route-filer -- kraver dev-server restart

### Steg 3: Bokningslista (~2-3 dagar)

**Mal:** Forsta "helt nya" native-vy i Coordinator-arkitekturen.

- Skapa `BookingRepository` (protocol + API-implementation)
- Skapa `BookingListViewModel` med filter (status, datumintervall)
- Skapa `BookingListView` -- SwiftUI List med sektioner (idag, kommande, tidigare)
- Skapa `BookingsCoordinator` med NavigationPath
- Tap pa bokning -> push `BookingDetailView` (delad med kalender)
- Expandera `APIClient` med `fetchBookings()` endpoint

**Kritiska filer:**
- Nya: `BookingsCoordinator.swift`, `BookingRepository.swift`, `BookingListViewModel.swift`, `BookingListView.swift`, `BookingListItem.swift`
- `APIClient.swift` -- utoka med boknings-endpoints

### Steg 4: Kundhantering (~3-4 dagar)

**Mal:** Tredje native-vyn, bevisar att arkitekturen skalar.

- Skapa `CustomerRepository` (protocol + API-implementation)
- Skapa `CustomerListViewModel` + `CustomerDetailViewModel`
- Skapa `CustomerListView` (sok + lista) och `CustomerDetailView` (hastar, bokningar, anteckningar)
- Skapa `CustomersCoordinator` med NavigationPath
- Expandera `APIClient` med kund-endpoints

**Kritiska filer:**
- Nya: `CustomersCoordinator.swift`, `CustomerRepository.swift`, `CustomerListViewModel.swift`, `CustomerDetailViewModel.swift`, `CustomerListView.swift`, `CustomerDetailView.swift`, `CustomerModels.swift`
- `APIClient.swift` -- utoka med kund-endpoints

### Steg 5+: Polish (fortlopande)

- Overgangsanimationer mellan native-vyer
- **Deep linking:** `AppCoordinator.handleDeepLink(url)` parser URL -> `selectedTab` + push pa ratt coordinators `NavigationPath`. Push-notifikationer (nu via `NotificationCenter.default.post(.navigateToURL)`) omdirigeras till AppCoordinator istallet for WebView.
- Dashboard som native-vy (statistik, idag-oversikt, snabbatgarder)
- **Offline-cache:** Varje Repository far en cache-implementation som foljer `SharedDataManager`-monstret (App Group UserDefaults). Samma pattern som `CalendarCaching`-protokollet i CalendarViewModel.
- Dark mode-verifiering
- Anpassa dialoger (fullskarms-sheet for komplexa formulur)

---

## iOS Expert Agent

Ny agent i `.claude/agents/ios-expert.md`:

**Fokusomraden:**
- SwiftUI arkitektur och best practices (iOS 17+)
- Coordinator Pattern for SwiftUI
- @Observable, NavigationStack, ScrollView APIer
- WKWebView-integration och bridge-monster
- XCTest for SwiftUI (ViewModels, Repositories)
- Equinets specifika monster (AuthManager, APIClient, KeychainHelper)
- Performance: lazy loading, prefetching, caching

**Anvandning:** Code review efter varje steg, teknisk radgivning vid komplexa beslut.

---

## Kritiska filer att modifiera

| Fil | Steg | Andring |
|-----|------|---------|
| `ContentView.swift` | 1 | Delegera till AuthenticatedView |
| `NativeCalendarView.swift` | 2 | Stor refaktorering -- SwiftUI scroll-paging |
| `CalendarViewModel.swift` | 2 | Scroll-position-synk |
| `APIClient.swift` | 2-4 | Utoka med boknings/kund-endpoints |
| `NativeTabBar.swift` | 1 | Ersatts av TabView i AuthenticatedView |
| `BookingDetailSheet.swift` | 2 | Refaktoreras till NavigationStack-push |
| `BridgeHandler.swift` | 1 | Behalls, kopplas till WebViewTab |
| `WebView.swift` | 1 | Behalls, wrappas i WebViewTab |

**Nya filer per steg:**
- Steg 0: `ios-expert.md` (agent)
- Steg 1: ~4 filer (coordinators + views)
- Steg 2: ~2 filer (scroll-komponent + refaktorering)
- Steg 3: ~5 filer (repository + viewmodel + views)
- Steg 4: ~7 filer (repository + viewmodels + views + models)

---

## Verifiering

### Per steg:
1. **TDD obligatoriskt:** Skriv ViewModel- och Repository-tester FORST (Red -> Green -> Refactor). Folj monster fran `CalendarViewModelTests.swift` och `AuthManagerTests.swift`.
2. **Bygger utan fel:** `xcodebuild build -project ... -scheme Equinet`
3. **Befintliga tester grona:** `xcodebuild test ... -only-testing:EquinetTests`
4. **Manuell test:** Navigering, swipe, data-laddning, bridge-kommunikation
5. **Coverage:** Minst 80% pa ny kod. Fokus pa ViewModel-logik och Repository-anrop, inte View-rendering.

### Specifikt for kalender-fix (steg 2):
- Horisontell swipe mellan dagar -- smooth, inga hackar
- Vertikal scroll inuti dag -- oberoende av horisontell swipe
- "Idag"-knapp navigerar korrekt
- Bokningsblock renderas pa ratt tid och position
- Pull-to-refresh laddar om data
- Haptic feedback pa dag-byte

### Integration:
- Push-notifikationer oppnar ratt vy
- Bridge-meddelanden (speech, calendar sync) fungerar
- Auth-flode (login -> biometric -> authenticated) oforandrat
- Widget fortsatter fungera
