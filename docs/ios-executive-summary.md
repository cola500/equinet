---
title: Executive Summary - Equinet iOS App
description: Kort sammanfattning av iOS-appens tillstånd, styrkor, risker och rekommenderade åtgärder
category: architecture
status: current
last_updated: 2026-03-29
sections:
  - Övergripande bedömning
  - Styrkor
  - Risker
  - Rekommenderad prioritering
  - Slutsats
---

# Executive Summary -- Equinet iOS App

## Övergripande bedömning

iOS-appen är en hybrid WKWebView/SwiftUI-app med 56 filer (~12 300 rader) och 158 tester. Den är mitt i en gradvis migrering från WebView till native vyer -- och det görs på ett kontrollerat sätt med feature flags.

Arkitekturen är konsekvent och begriplig. Alla skärmar utom en följer MVVM med protokoll-baserad DI, vilket gör dem testbara och lättförståeliga. Kodkvaliteten är jämn: modern Swift concurrency, strukturerad loggning, och bra säkerhetsmönster.

Appen är inte i kris. Den har konkreta förbättringsområden, men inget som kräver akut insats.

## Styrkor

**Testbar MVVM-arkitektur.** 6 av 6 ViewModels använder protokoll-DI och har motsvarande tester (158 XCTest). Nya native-skärmar får testbar struktur "gratis" genom att följa befintliga mönster.

**Säkert migreringsmönster.** Feature flags styr vilka sidor som är native vs WebView. NativeMoreView kan routa till antingen native vyer eller web-fallback per menyalternativ. Ingen big bang-risk.

**Optimistisk UI med rollback.** Alla mutationer följer samma mönster: omedelbar UI-uppdatering, rollback vid fel, haptic feedback. Konsekvent i hela appen.

**Bra säkerhetsgrund.** JWT i Keychain, origin-validering i bridge, biometrisk auth med fallback, session cookies med miljöbaserad secure-flag.

## Risker

**Dashboard saknar ViewModel (555 rader utan tester).** Enda vyn där API-anrop, cache och felhantering ligger direkt i vyn. 0 unit-tester för appens förstasida. Varje ny dashboard-feature ökar risken.

**APIClient är en monolit (564 rader, 32 endpoints).** Otestbar (hårdkodad URLSession), ingen interceptor, potentiell race condition vid token-refresh. Varje ny endpoint ökar storleken.

**Modeller är hårt kopplade till backend-JSON.** Inga CodingKeys -- Swift-propertynamn måste matcha JSON exakt. Duplicerade booking-modeller (BookingsListItem/NativeBooking) ökar risken för divergens vid nya fält.

## Rekommenderad prioritering

### Gör nu (låg insats)

| Åtgärd | Tid | Varför |
|--------|-----|--------|
| R1: Ersätt hårdkodade brand-färger | 5 min | Color.equinetGreen finns redan men används inte i 3 filer |
| R2: KeychainHelper print() -> AppLogger | 10 min | Säkerhetsrelevanta fel bör synas i strukturerad loggning |
| R3: Delad DateFormatters-utility | 30 min | Eliminerar 4+ oberoende kopior av samma formatterare |

### Gör snart (före nästa dashboard-feature)

| Åtgärd | Tid | Varför |
|--------|-----|--------|
| R6: Skapa DashboardViewModel | 2-3h | Gör Dashboard testbar och konsekvent med övrig arkitektur |

### Gör senare (vid nästa stora utvidgning)

| Åtgärd | Tid | Varför |
|--------|-----|--------|
| R8: CodingKeys på kärnmodeller | 1-2h/modell | Säkerhetsnät mot backend-ändringar. Kan göras inkrementellt. |
| R11: Bryt upp APIClient | 1-2 dagar | Nödvändigt för testbarhet och skalbarhet. Inte akut. |

### Rör inte än

R13 (type-safe routing) är relevant först om appen växer väsentligt. Nuvarande string-baserade routing är hanterbart för appens storlek.

## Slutsats

iOS-appen är i gott skick för sin storlek och sitt stadium. Arkitekturen är begriplig, migreringen är kontrollerad, och testinfrastrukturen fungerar.

Det enda som bör prioriteras på kort sikt är att ge Dashboard en ViewModel (R6) -- det är den enda platsen där arkitekturen är inkonsekvent på ett sätt som påverkar testbarhet och underhållbarhet.

Övriga förbättringar (APIClient-uppdelning, CodingKeys, token-ägande) är värda att göra men bör drivas av faktiska behov, inte av perfektionism.

Detaljerad analys finns i:
- [ios-architecture-review.md](ios-architecture-review.md) -- struktur, lager, hotspots
- [ios-code-quality-review.md](ios-code-quality-review.md) -- mönster, testbarhet, felhantering
- [ios-refactoring-opportunities.md](ios-refactoring-opportunities.md) -- 13 prioriterade åtgärder
