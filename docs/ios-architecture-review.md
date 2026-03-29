---
title: iOS Architecture Review
description: Strukturerad genomlysning av Equinet iOS-appens arkitektur
category: architecture
status: current
last_updated: 2026-03-29
sections:
  - Översikt
  - Lagerstruktur
  - Styrkor
  - Svagheter
  - Hotspots
  - Bedömning
---

# iOS Architecture Review

## Översikt

Equinet iOS-appen är en hybrid WKWebView/native-app med 56 Swift-filer (~12 300 rader kod) och 14 testfiler (~3 500 rader tester, 158 XCTest). Appen är mitt i en gradvis migrering från ren WebView till native SwiftUI-vyer.

**Kodbas-snapshot (2026-03-29):**

| Kategori | Antal filer | Rader |
|----------|------------|-------|
| Views (Native*View, *Sheet) | 22 | ~5 500 |
| ViewModels | 6 | ~1 870 |
| Modeller | 7 | ~760 |
| Infrastruktur (API, Auth, Bridge, Keychain, etc.) | 12 | ~3 200 |
| Tester | 14 | ~3 500 |
| Övrigt (Config, Color, Logger, Widget) | 5 | ~170 |

---

## Lagerstruktur

```
EquinetApp (entry point)
|
+-- ContentView (auth state machine: checking -> login/biometric -> authenticated)
    |
    +-- AuthManager (JWT-token, session cookies, biometrisk inloggning)
    |   +-- KeychainHelper (säkert lagringsabstraktion, KeychainStorable-protokoll)
    |
    +-- AppCoordinator (tab-routing, feature flags, deep linking, äger ViewModels)
    |   +-- CalendarViewModel, BookingsViewModel, CustomersViewModel,
    |   |   ServicesViewModel, ReviewsViewModel, ProfileViewModel
    |   +-- BridgeHandler (JS<->Swift kommunikation)
    |   +-- NetworkMonitor (NWPathMonitor-wrapper)
    |
    +-- AuthenticatedView (TabView med native-flikar)
        |
        +-- NativeDashboardView (ingen ViewModel -- direkt API-anrop)
        +-- NativeCalendarView + CalendarViewModel
        +-- NativeBookingsView + BookingsViewModel
        +-- NativeMoreView (NavigationStack-router)
            +-- NativeCustomersView + CustomersViewModel
            +-- NativeServicesView + ServicesViewModel
            +-- NativeReviewsView + ReviewsViewModel
            +-- NativeProfileView + ProfileViewModel
            +-- MoreWebView (fallback för ej migrerade sidor)
```

### Ansvarsfördelning

| Lager | Ansvar | Exempel |
|-------|--------|---------|
| **App/ContentView** | Livscykel, auth-state, badge-hantering | EquinetApp.swift, ContentView.swift |
| **Coordinator** | Tab-routing, feature flags, pending navigation | AppCoordinator.swift |
| **Views** | Presentation, UI-state (sheets, filter), SwiftUI-layout | Native*View.swift, *Sheet.swift |
| **ViewModels** | Data-laddning, CRUD, optimistisk UI, felhantering | *ViewModel.swift |
| **APIClient** | HTTP-anrop, token-refresh, feltyper | APIClient.swift (singleton) |
| **Auth** | JWT, session cookies, biometrik, login/logout | AuthManager.swift, KeychainHelper.swift |
| **Bridge** | JS<->Swift meddelandehantering (20 meddelandetyper) | BridgeHandler.swift |
| **Data** | App Group UserDefaults, widget-data, cache-TTL | SharedDataManager.swift |

---

## Styrkor

### 1. Konsekvent MVVM med protokoll-baserad DI

Alla ViewModels (utom Dashboard) använder `@Observable` + `@MainActor` och injicerar beroenden via protokoll (`BookingsDataFetching`, `CustomersDataFetching`, etc.). Detta gör ViewModels isolerat testbara -- och det syns i testtäckningen (158 tester).

### 2. Gradvis migrering utan big bang

Appen är designad för inkrementell migrering från WebView till native. `NativeMoreView` kan routa till antingen native vyer eller `MoreWebView` per menyalternativ. Feature flags styr vilka sidor som är nativa. Detta minskar risken drastiskt.

### 3. Optimistisk UI med rollback

Alla mutations-operationer (bokningsstatus, kunddata, tjänster, recensioner) använder samma mönster: spara gammal state -> uppdatera UI direkt -> vid fel: återställ gammal state + haptic error-feedback. Konsekvent implementerat i alla ViewModels.

### 4. Säkerhetsmodell

- JWT i Keychain med `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
- Session cookies med `secure`-flag baserat på miljö
- Origin-validering i Bridge (bara meddelanden från appens domän accepteras)
- Biometrisk auth med graceful fallback
- Kontextmeny och långpress avstängt i WebView

### 5. Offline-kapabilitet

PendingActionStore sparar failade mutationer för retry vid återuppkoppling. CalendarSyncManager synkar bokningar till iOS Calendar med persistent event-mapping. NetworkMonitor ger banners och styr fetch-beteende.

### 6. Testbar arkitektur

6 av 6 ViewModels har motsvarande testfil med mock-implementationer. Auth har `KeychainStorable`-protokoll för DI. BridgeHandler, CalendarSyncManager och PendingActionStore är testade. Total: 158 tester.

---

## Svagheter

### 1. NativeDashboardView saknar ViewModel

Dashboard-vyn (555 rader) gör API-anrop, cache-hantering och UserDefaults-logik direkt i vyn. Bryter mot MVVM-mönstret som alla andra vyer följer. Gör Dashboard otestbar med unit-tester.

### 2. APIClient är för stor och har svag DI

564 rader med ~32 endpoints i en enda fil. Singleton-mönster med hårdkodad `URLSession.shared` -- inte injicerbar för tester. Token-refresh har potentiell race condition vid parallella 401:or (bara en `isRefreshing`-flagga, ingen async lås).

### 3. Fragmenterad token-hantering

AuthManager sparar tokens, APIClient refreshar tokens, SharedDataManager läser tokens, KeychainHelper lagrar tokens. Ingen enskild ägare -- ansvaret är spritt över 4 filer.

### 4. Inga CodingKeys i modeller

Alla ~30 Codable-modeller förlitar sig på att Swift-property-namn matchar exakt mot JSON-nycklar. Ett namnbyte på backend kraschar appen. Ingen buffer för API-evolution.

### 5. Duplicerade modeller

`BookingsListItem` och `NativeBooking` är ~90% identiska men definieras separat för olika endpoints. Ökar risk för divergens.

### 6. String-baserad navigation och routing

Alla deep links, API-paths och tab-routing använder strängar. Inga type-safe routes, inga compile-time-kontroller. Stavfel ger runtime-fel.

---

## Hotspots

Filer med hög komplexitet, många beroenden, eller som ändras ofta:

| Fil | Rader | Risk | Anledning |
|-----|-------|------|-----------|
| **NativeBookingsView.swift** | 746 | HÖG | Största vyn. Många sheet-typer, status-logik, filter. Ändras ofta vid nya bokningsfunktioner. |
| **NativeCalendarView.swift** | 733 | MEDEL | Komplex geometri-beräkning, tidspositionering, scroll-paging. Men väl isolerad från andra. |
| **APIClient.swift** | 564 | HÖG | Alla API-ändringar går genom denna fil. Singleton, svag DI, ingen interceptor. |
| **NativeDashboardView.swift** | 555 | HÖG | Ingen ViewModel, all logik inline. Varje ny dashboard-feature ökar komplexiteten. |
| **CustomerDetailView.swift** | 653 | MEDEL | Tre flikar (översikt, hästar, anteckningar) med CRUD. Komplex men väl delegerad till ViewModel. |
| **AuthManager.swift** | 301 | MEDEL | Kritisk för säkerhet. Token-expiry aldrig validerad. LAContext skapas multipla gånger. |
| **BridgeHandler.swift** | 270 | LÅG-MEDEL | 20 meddelandetyper i switch/case. Ingen payload-validering per typ. Men stabil -- ändringar är sällsynta. |

---

## Bedömning: Är strukturen begriplig för fortsatt utveckling?

**Ja, med reservationer.**

**Vad som fungerar bra:**
- MVVM-mönstret är tydligt och konsekvent (förutom Dashboard)
- Nya native-vyer följer ett etablerat mönster: ViewModel med protokoll-DI + View med state management
- Feature-flag-systemet gör det säkert att migrera fler WebView-sidor till native
- Testinfrastrukturen är på plats -- nya ViewModels får tester "gratis" genom att följa befintliga mocks

**Vad som kräver uppmärksamhet:**
- APIClient behöver brytas upp eller få interceptor-mönster innan fler endpoints läggs till
- Dashboard måste få en ViewModel för att vara testbar och underhållbar
- Modell-duplicering (BookingsListItem/NativeBooking) måste hanteras innan fler bokningstyper läggs till
- Token-hanteringens ansvarsfördelning är förvirrande för nya utvecklare

**Sammanfattning:** Arkitekturen är tillräckligt bra för nuvarande storlek. De största riskerna är inte strukturella utan operativa: Dashboard-hotspoten, APIClient-storleken, och modell-kopplingen till backend.
