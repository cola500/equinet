---
title: "iOS UX Audit 2026-04-18"
description: "Systematisk UX-granskning av alla 15 native provider-vyer i iOS-appen"
category: retro
status: active
last_updated: 2026-04-18
sections:
  - Sammanfattning
  - Metodik
  - Vyöversikt
  - UX-fynd
  - Direktfixar (samma session)
  - Backloggade stories
  - Lärdomar
---

# iOS UX Audit 2026-04-18

## Sammanfattning

Systematisk visuell och accessibility-audit av alla 15 native SwiftUI-vyer i leverantörsdelen
av Equinet iOS-appen. Screenshots och accessibility trees tagna via mobile-mcp. cx-ux-reviewer
kördes på NativeProfileView, NativeBookingDetailView och NativeLoginView.

**Resultat:** 1 Blocker, 6 Major, 9 Minor. Blockers och enklaste Minors fixades direkt.
Majors backloggades som sprint-stories.

---

## Metodik

- **Verktyg:** mobile-mcp (screenshots + accessibility tree), cx-ux-reviewer subagent
- **Testanvändare:** anna@hastvard-goteborg.se (leverantör, debug-autologin)
- **Screenshots sparade:** `docs/metrics/ios-audit-2026-04-18/` (16 filer)
- **Rotorsak stale Keychain:** Löst via `xcrun simctl uninstall` + ren installation (se S33-0 5 Whys)

---

## Vyöversikt

Alla 15 vyer täckta med screenshot + accessibility tree:

| # | Vy | Fil | Skärmdump | Tillstånd |
|---|-----|-----|-----------|-----------|
| 1 | NativeDashboardView | NativeDashboardView.swift | 03-dashboard.png | Tom (inga bokningar) |
| 2 | NativeBookingsView | NativeBookingsView.swift | 02-bookings.png | Tom + 1 testbokning |
| 3 | NativeCalendarView | NativeCalendarView.swift | 06-calendar.png | Tom |
| 4 | NativeCustomersView | NativeCustomersView.swift | 04-customers.png | Tom |
| 5 | NativeServicesView | NativeServicesView.swift | 05-services.png | Tom |
| 6 | NativeMoreView | NativeMoreView.swift | 13-more-menu.png | Alla menyval synliga |
| 7 | NativeProfileView | NativeProfileView.swift | 07-profile.png | 88% klar (saknar profilbild) |
| 8 | NativeReviewsView | NativeReviewsView.swift | 08-reviews.png | Tom |
| 9 | NativeInsightsView | NativeInsightsView.swift | 09-insights.png | Nollvärden |
| 10 | NativeAnnouncementsView | NativeAnnouncementsView.swift | 10-announcements.png | Tom |
| 11 | NativeDueForServiceView | NativeDueForServiceView.swift | 11-due-for-service.png | Tom |
| 12 | NativeGroupBookingsView | NativeGroupBookingsView.swift | 12-group-bookings.png | Tom |
| 13 | NativeHelpView | NativeHelpView.swift | 14-help.png | Artiklar laddade |
| 14 | NativeLoginView | NativeLoginView.swift | 15-login.png | Login-formulär |
| 15 | NativeBookingDetailView | NativeBookingDetailView.swift | 16-booking-detail.png | 1 testbokning |

---

## UX-fynd

### Blockers

| ID | Vy | Problem | Mätvärde | Fix |
|----|-----|---------|----------|-----|
| B-01 | NativeLoginView | "Glömt lösenord?"-länk för liten tap-target | 113×19pt (min 44pt) | Fixad direkt |

### Major

| ID | Vy | Problem | Mätvärde | Åtgärd |
|----|-----|---------|----------|--------|
| M-01 | NativeProfileView | "Byt bild"-knapp saknar tap-area och padding | 44×15pt | Story S34-x |
| M-02 | NativeProfileView | "Redigera"-knappar i sektionsrubriker under 44pt | 18–19pt | Story S34-x |
| M-03 | NativeProfileView | "Radera konto" saknar native bekräftelsedialog | Destruktiv utan guard | Story S34-x |
| M-04 | NativeBookingDetailView | Telefon-/e-postkontakter för små + e-post inte klickbar | ~19pt, ingen mailto: | Story S34-x |
| M-05 | NativeBookingDetailView | "Uteblev"/"Avboka"-knappar saknar controlSize(.large) | 34pt (min 44pt) | Story S34-x |
| M-06 | NativeLoginView | Felmeddelanden skiljer inte nätverksfel från autentiseringsfel | Opaque error string | Story S34-x |

### Minor

| ID | Vy | Problem | Mätvärde | Fix |
|----|-----|---------|----------|-----|
| m-01 | NativeLoginView | "Email"-etikett på engelska | Inkonsekvent | Fixad direkt ("E-post") |
| m-02 | NativeLoginView | Inloggningsknapp saknar accessibilityHint | Ingen VoiceOver-vägledning | Fixad direkt |
| m-03 | NativeBookingDetailView | "Lägg till anteckning" saknar controlSize(.large) | 33–36pt | Fixad direkt |
| m-04 | NativeBookingDetailView | Badges ("Återkommande", "Manuell") saknar accessibilityLabel | VoiceOver läser bara texten | Fixad direkt |
| m-05 | NativeBookingDetailView | Hästnamn-knapp har ingen visuell knapp-affordance | Osynlig klickbarhet | Backlogg |
| m-06 | NativeProfileView | Settings-fliken saknar error-state | Tom skärm vid fel | Backlogg |
| m-07 | NativeProfileView | linkRow saknar descriptiv accessibilityLabel | Vag VoiceOver-beskrivning | Backlogg |
| m-08 | NativeDashboardView | "Dela min profil"-CTA under 44pt | 120×28pt | Backlogg |
| m-09 | NativeAnnouncementsView | "Skapa annons" empty-state-knapp under 44pt | 116×28pt | Backlogg |

### Avfärdat

| ID | Vy | Notis |
|----|-----|-------|
| - | NativeProfileView | Segmented picker Profil/Inställningar: 32pt men 48pt med padding → OK |
| - | NativeMoreView | Alla menyval 52–53pt → godkänt |
| - | NativeHelpView | Hjälpartiklar 89pt → utmärkt |
| - | NativeLoginView | "Logga in"-knapp 59pt → utmärkt |

---

## Direktfixar (samma session)

Fixade i `feature/s33-1-ios-ux-audit`:

1. **NativeLoginView** — "Glömt lösenord?": `frame(minHeight: 44)` + `.contentShape(Rectangle())` + förbättrad accessibilityLabel
2. **NativeLoginView** — "Email" → "E-post"
3. **NativeLoginView** — "Logga in" fick `accessibilityHint` för VoiceOver
4. **NativeBookingDetailView** — "Lägg till anteckning": `.controlSize(.large)`
5. **NativeBookingDetailView** — Badges: `.accessibilityLabel("Bokningstyp: \(badge)")`

Debug-kod rensat:
- `src/lib/auth-dual.ts`: debug `logger.info` borttagen
- `src/app/api/native/dashboard/route.ts`: debug `logger.error` borttagen
- `src/app/api/test/whoami/route.ts`: temporär fil raderad

---

## Backloggade stories

Följande skapas som sprint-stories för nästa sprint:

**S34-UX-1: Profilvy — tap-targets och bekräftelse**
- M-01: "Byt bild" → minHeight 44 + ikon
- M-02: "Redigera"-knappar → minHeight 44 + contentShape
- M-03: "Radera konto" → native confirmationDialog
- m-06: Settings error-state
- m-07: linkRow accessibilityLabel

**S34-UX-2: Bokningsdetalj — kontakter och knappar**
- M-04: Telefon + e-post → minHeight 44, mailto:-länk
- M-05: "Uteblev"/"Avboka" → controlSize(.large) + role: .destructive på Avboka
- m-05: Hästnamn-knapp → Label med ikon + frame

**S34-UX-3: Felmeddelanden och nätverksdifferentiering**
- M-06: AuthManager + LoginView — differentiera nätverksfel från autentiseringsfel

---

## Lärdomar

- **Stale Keychain** är en vanlig fallgrop vid iOS Simulator-test — alltid uninstall + reinstall vid auth-problem
- **Accessibility tree via mobile-mcp** ger exakta pt-mätvärden direkt utan att läsa Swift-kod
- **cx-ux-reviewer** hittade extra fynd (e-post inte klickbar, hästnamn-knapp) utöver den visuella inspektionen
- **"Alla vyer är tomma"** är ett seed-data-problem — för produktionsliknande audit bör en testbokning seedas automatiskt
- Konsekvent användning av `.controlSize(.large)` på sekundärknappar är ett återkommande mönster att checka vid varje ny vy
