---
title: "Retrospektiv: Native iOS Kundhantering"
description: "Steg 4 i native-first rebuild: SwiftUI kundlista, detaljvy, CRUD for kunder/hastar/anteckningar"
category: retrospective
status: current
last_updated: 2026-03-15
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan forbattras
  - Patterns att spara
  - Larandeeffekt
---

# Retrospektiv: Native iOS Kundhantering

**Datum:** 2026-03-15
**Scope:** Native SwiftUI kundhantering -- lista, detalj, CRUD for kunder/hastar/anteckningar + 6 API routes

---

## Resultat

- 17 nya filer, 4 andrade filer, 0 nya migrationer
- 88 nya API-tester + 21 nya iOS-tester (alla TDD, alla grona)
- 3449 totala unit-tester, 116 iOS-tester (inga regressioner)
- Typecheck = 0 errors, Lint = 0 errors
- Simulator-verifierad med mobile-mcp
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| API Routes | 6 route-filer under `src/app/api/native/customers/` | GET/POST kunder, PUT/DELETE kund, GET/POST hästar, PUT/DELETE hast, GET/POST anteckningar, PUT/DELETE anteckning |
| API Tester | 6 test-filer | 88 tester: auth (401), rate limit (429/503), validation (400), IDOR (404), happy path |
| iOS Models | `CustomerModels.swift` | CustomerSummary (Hashable), CustomerHorse, CustomerNote, CustomerFilter, CustomerDetailTab, API response wrappers |
| iOS ViewModel | `CustomersViewModel.swift` | @Observable med DI-protokoll, lokal filtrering+sok, optimistic delete, CRUD for kunder/hastar/anteckningar |
| iOS Listvy | `NativeCustomersView.swift` | .searchable, filter-bar (capsules), List med NavigationLink, empty states, AddCustomerSheet |
| iOS Detaljvy | `CustomerDetailView.swift` | Segmented Picker (Oversikt/Hastar/Anteckningar), CRUD sheets, swipe-to-delete, confirmationDialog |
| iOS APIClient | `APIClient.swift` (andrad) | 12 nya endpoint-metoder for kund-CRUD |
| iOS Integration | `AppCoordinator.swift`, `NativeMoreView.swift`, `AuthenticatedView.swift` (andrade) | customersViewModel ags av coordinator, Kunder -> native vy, navigationDestination for CustomerSummary |
| iOS Tester | `CustomersViewModelTests.swift` | 21 XCTest: loading, filtering, search, CRUD, optimistic UI, reset, model tests |

## Vad gick bra

### 1. /implement-skill effektiviserade hela floden
Planen hade 6 faser. /implement-skillen drev TDD-cykeln fas for fas med automatisk verifiering mellan varje steg. Alla 88 API-tester var grona pa forsta korningen.

### 2. Pattern-ateranvandning fran bokningslistan
BookingsViewModel/NativeBookingsView-monstret kopplades direkt till CustomersViewModel/NativeCustomersView. DI-protokoll, optimistic UI, filter-bar, empty states -- allt ateranvandes. Minimalt nytankande behovdes.

### 3. Parallella utforskningsagenter sparade tid
Tre Explore-agenter laste alla monsterfiler (API routes, iOS views, provider routes) parallellt medan jag vantade. Nar de var klara hade jag full översikt over alla patterns.

### 4. Simulator-verifiering med mobile-mcp
Alla tre tabs (Översikt, Hästar, Anteckningar) verifierades visuellt i simulator. Kundkortet visade korrekt data (namn, senaste bokning, telefon). Empty state for anteckningar med CTA-knapp.

## Vad kan forbattras

### 1. Fas 3+4+5 slogs ihop -- planens fasindelning var for granular
CustomerDetailView behover skapas for att NativeMoreView ska kompilera (navigationDestination refererar den). Planen hade separata faser for listvy (3), detaljvy (4) och integration (5), men i praktiken maste alla tre skrivas tillsammans for att bygget ska ga igenom.

**Prioritet:** LAG -- planens fasindelning var pedagogisk men inte praktisk for iOS dar kompilering kraver alla typer. Nasta plan bor slå ihop "iOS Views" till en fas.

### 2. Security-reviewer missade befintlig rate limiting
Security-reviewern rapporterade "saknad rate limiting pa samtliga sex routes" -- men alla routes HAR `rateLimiters.api()`. Reviewern verkar ha sokt efter specifika rate-limiter-nycklar (t.ex. `nativeCustomersRead`) istallet for att lasa koden. Falskt-positiva soker bort fortroendet for reviewern.

**Prioritet:** MEDEL -- overvagg att forbattra security-reviewer-prompten med instruktion att lasa rate-limit-anropen i koden, inte bara soka efter nyckelnamn.

## Patterns att spara

### CustomersViewModel -- ren kopia av BookingsViewModel-monstret
1. DI-protokoll (`CustomersDataFetching`) med production-adapter (`APICustomersFetcher`)
2. `@Observable @MainActor` med `init(fetcher:)` for testbarhet
3. Lokal filtrering + sok i computed property (ingen debounce behövs)
4. Optimistic delete: spara `oldState`, ta bort fran array, revert vid error
5. In-memory cache (ingen SharedDataManager -- kunder visas inte i widgets)

### CustomerDetailView -- segmented tabs pattern
`Picker(.segmented)` + `switch` pa selectedTab. INTE SwiftUI TabView (krockar med swipe-to-delete). Varje tab ar en `@ViewBuilder` computed property.

### Sheet-hantering med enum
`enum CustomerSheetType: Identifiable` med en enda `.sheet(item:)` modifier. Varje case har egen presentationDetents (.medium for forms, .large for hast-formularet).

### NativeMoreView native-routing
`navigationDestination(for: MoreMenuItem.self)` kollar `item.path == "/provider/customers"` -> visar NativeCustomersView istallet for MoreWebView. Enkel if-else per native-konverterad sida.

## Larandeeffekt

**Nyckelinsikt:** Native Screen Pattern ar nu bevisat pa 4 skarmar (Dashboard, Kalender, Bokningar, Kunder). Monstret ar stabilt: aggregerat API + Codable models + DI ViewModel + SwiftUI vy + coordinator-agande. Nasta skarm (t.ex. Tjänster) kan implementeras pa under en session.
