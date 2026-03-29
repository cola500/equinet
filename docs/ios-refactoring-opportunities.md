---
title: iOS Refactoring Opportunities
description: Prioriterade förbättringsmöjligheter för Equinet iOS-appen
category: architecture
status: current
last_updated: 2026-03-29
sections:
  - Låg insats hög effekt
  - Medel insats hög effekt
  - Stor insats strategisk betydelse
---

# iOS Refactoring Opportunities

## Låg insats / Hög effekt

### R1. Ersätt hårdkodade brand-färger med Color.equinetGreen

- **Problem:** `Color(red: 34/255, green: 139/255, blue: 34/255)` definieras manuellt i NativeLoginView, BiometricPromptView och SplashView. `Color.equinetGreen` finns redan i `Color+Brand.swift` men används inte.
- **Varför det spelar roll:** Vid framtida dark mode eller brand-ändring måste 3 filer ändras istället för 1.
- **Var:** NativeLoginView.swift rad ~22, BiometricPromptView.swift rad ~15, SplashView.swift rad ~15
- **Åtgärd:** Ersätt RGB-värdena med `Color.equinetGreen` (3 ställen).
- **Risk:** Minimal. Ren kosmetisk ändring.
- **När:** Nu. Tar < 5 minuter.

### R2. Flytta print() till AppLogger i KeychainHelper

- **Problem:** KeychainHelper använder `print()` för felloggar istället för `AppLogger.keychain`.
- **Varför det spelar roll:** Keychain-fel är säkerhetsrelevanta och bör synas i strukturerad loggning, inte bara i Xcode-konsolen.
- **Var:** KeychainHelper.swift (3-4 print-satser)
- **Åtgärd:** Ersätt `print()` med `AppLogger.keychain.error()`.
- **Risk:** Minimal.
- **När:** Nu. Tar < 10 minuter.

### R3. Extrahera delad DateFormatters-utility

- **Problem:** ISO8601DateFormatter och svenskt DateFormatter definieras oberoende i 4+ filer (NativeReviewsView, BookingDetailSheet, ExceptionFormSheet, WeekStripView, CalendarModels).
- **Varför det spelar roll:** Duplicering ökar risk för inkonsekvent datumformatering. Nya vyer måste "hitta" rätt format.
- **Var:** Skapa `DateFormatters.swift` med statiska egenskaper.
- **Åtgärd:** Centralisera till en fil, uppdatera 4-5 filer att använda den.
- **Risk:** Låg. Rena statiska formatterare.
- **När:** Nu eller nästa tillfälle.

### R4. Extrahera ErrorStateView-komponent

- **Problem:** Identisk error-vy (ikon + felmeddelande + retry-knapp) definieras separat i WebViewTab, CustomerWebView och implicerat i MoreWebView.
- **Var:** WebViewTab.swift, CustomerWebView.swift
- **Åtgärd:** Skapa en delad `ErrorStateView(message:onRetry:)`.
- **Risk:** Låg.
- **När:** Nästa tillfälle WebView-filer ändras.

### R5. Centralisera haptic feedback

- **Problem:** `UINotificationFeedbackGenerator().notificationOccurred(.success/.error)` och `UIImpactFeedbackGenerator(style:).impactOccurred()` upprepas 20+ gånger i 6 ViewModels.
- **Varför det spelar roll:** Duplicering, och `#if os(iOS)`-guards glöms ibland bort.
- **Var:** Alla ViewModels + NativeCalendarView.
- **Åtgärd:** Skapa `HapticFeedback.success()`, `.error()`, `.impact(.medium)` hjälpfunktioner.
- **Risk:** Låg.
- **När:** Opportunistiskt, nästa gång en ViewModel ändras.

---

## Medel insats / Hög effekt

### R6. Skapa DashboardViewModel

- **Problem:** NativeDashboardView (555 rader) är enda vyn utan ViewModel. API-anrop, cache-hantering, UserDefaults-logik och felhantering ligger direkt i vyn. Det finns 0 unit-tester för Dashboard-logik.
- **Varför det spelar roll:** Dashboard är "förstasidan" för leverantörer. Nya dashboard-features (KPI:er, prioritetsåtgärder) ökar vyns komplexitet. Utan ViewModel är det omöjligt att testa edge cases.
- **Var:** NativeDashboardView.swift -> ny DashboardViewModel.swift
- **Åtgärd:** Extrahera data-laddning, cache-logik och felhantering till DashboardViewModel med `DashboardDataFetching`-protokoll. Följ exakt samma mönster som BookingsViewModel.
- **Risk:** Låg-medel. Ren extraktion, ingen ny logik.
- **När:** Före nästa dashboard-feature. Bör prioriteras.

### R7. Konsolidera BookingsListItem och NativeBooking

- **Problem:** Två modeller som är ~90% identiska men definieras separat för olika API-endpoints (/api/native/bookings vs /api/native/calendar). Risk för divergens när nya fält läggs till.
- **Varför det spelar roll:** Ett nytt fält på booking-modellen måste läggas till på två ställen. Om ett missas fungerar appen delvis -- svårt att hitta.
- **Var:** BookingsModels.swift, CalendarModels.swift
- **Åtgärd:** Antingen: (a) en gemensam basmodell med optionella fält, eller (b) explicita CodingKeys så båda kan dekodas från olika JSON. Utred vilken som är enklast.
- **Risk:** Medel. Krav: granska alla konsumenter (BookingsViewModel, CalendarViewModel, vyer).
- **När:** Nästa gång booking-modellen utvidgas.

### R8. Lägg till CodingKeys på kärnmodeller

- **Problem:** Alla ~30 Codable-modeller förlitar sig på att Swift-property-namn matchar JSON-nycklar exakt. Ett backend-namnbyte kraschar appen utan förvarning.
- **Varför det spelar roll:** Kopplingen är osynlig -- inget i koden signalerar att `customerPhone` MÅSTE heta exakt så i JSON. Säkerhetsnät mot API-evolution.
- **Var:** Börja med BookingsModels, CalendarModels, CustomerModels (mest använda).
- **Åtgärd:** Lägg till `enum CodingKeys: String, CodingKey` i varje modell med explicita mappningar.
- **Risk:** Låg om det görs inkrementellt per modell. Varje modell är oberoende.
- **När:** Opportunistiskt, modell för modell.

### R9. Extrahera ReplySheet från NativeReviewsView

- **Problem:** NativeReviewsView (417 rader) innehåller `ReplySheet` som inline-struct (rad ~334-415). Gör filen onödigt lång.
- **Var:** NativeReviewsView.swift
- **Åtgärd:** Flytta ReplySheet till egen fil.
- **Risk:** Minimal.
- **När:** Nästa gång Reviews-funktionalitet ändras.

### R10. Extrahera BrandLogoView

- **Problem:** Logo-sektion (bild + text) är duplicerad i NativeLoginView, BiometricPromptView och SplashView med smärre variationer.
- **Var:** 3 filer
- **Åtgärd:** Skapa delad `BrandLogoView` med konfigurerbar storlek.
- **Risk:** Låg.
- **När:** Opportunistiskt.

---

## Stor insats / Strategisk betydelse

### R11. Bryt upp APIClient eller lägg till interceptor-mönster

- **Problem:** APIClient (564 rader, ~32 endpoints) är en monolit. All nätverkslogik, token-hantering, och dekodning i en fil. Hårdkodad `URLSession.shared` gör den otestbar. Token-refresh har potentiell race condition vid parallella 401:or.
- **Varför det spelar roll:** Varje ny endpoint ökar filen. Ingen del av nätverkslagret har unit-tester. Race condition vid token-refresh kan ge "unauthorized"-krasch i produktion.
- **Var:** APIClient.swift
- **Åtgärd (alternativ):**
  - (a) **Interceptor-mönster:** Lägg till request/response-interceptors för logging, auth, error-mapping. Behåll en fil men med tydligare lager.
  - (b) **Modul-uppdelning:** Dela i APIClient (bas-request + auth) + APIEndpoints (specifika endpoints).
  - Oavsett: gör URLSession injicerbar för tester.
- **Risk:** Medel-hög. Alla ViewModels och services beror på APIClient. Kräver noggrann migrering.
- **När:** Senare. Inte akut, men bör planeras före nästa stora feature-utvidgning.

### R12. Förena token-ägande till en enda manager

- **Problem:** Token-ansvaret är spritt: AuthManager sparar tokens efter login, APIClient refreshar vid 401, SharedDataManager läser för widget, KeychainHelper lagrar fysiskt. 4 filer rör samma token.
- **Varför det spelar roll:** Förvirrande för nya utvecklare. Risk för inkonsekvent token-state om en av fyra filer ändras.
- **Var:** AuthManager, APIClient, SharedDataManager, KeychainHelper
- **Åtgärd:** Definiera `TokenProvider`-protokoll som kapslar load/save/refresh. AuthManager ägare, andra konsumenter använder protokollet.
- **Risk:** Medel. Krav: granska alla token-användare, säkerställ att widget-access fungerar.
- **När:** Senare. När auth-systemet nästa gång behöver ändras.

### R13. Type-safe routing

- **Problem:** Alla deep links, API-paths och navigering använder strängar. Stavfel ger runtime-fel, inte kompileringsfel.
- **Varför det spelar roll:** Relevant först när appen växer. Just nu är det hanterbart men skalar inte.
- **Var:** AppCoordinator, NativeMoreView, APIClient
- **Åtgärd:** Definiera route-enum för navigation och endpoint-enum för API. Stegvis migrering.
- **Risk:** Medel-hög. Stor yta, men kan göras inkrementellt.
- **När:** Senare, om appen växer väsentligt.

---

## Sammanfattning

| ID | Åtgärd | Insats | Effekt | När |
|----|--------|--------|--------|-----|
| R1 | Brand-färger | 5 min | Låg | Nu |
| R2 | KeychainHelper logging | 10 min | Låg | Nu |
| R3 | DateFormatters-utility | 30 min | Medel | Nu |
| R4 | ErrorStateView | 20 min | Låg | Snart |
| R5 | Haptic feedback helper | 30 min | Medel | Snart |
| R6 | DashboardViewModel | 2-3h | **Hög** | **Prioritera** |
| R7 | Konsolidera booking-modeller | 2-3h | Medel | Vid nästa utvidgning |
| R8 | CodingKeys på kärnmodeller | 1-2h per modell | Medel | Inkrementellt |
| R9 | Extrahera ReplySheet | 15 min | Låg | Snart |
| R10 | BrandLogoView | 30 min | Låg | Opportunistiskt |
| R11 | APIClient-uppdelning | 1-2 dagar | **Hög** | Planera |
| R12 | Token-ägande | 1 dag | Medel | Senare |
| R13 | Type-safe routing | 2-3 dagar | Medel | Senare |
