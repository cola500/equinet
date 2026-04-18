---
title: "S32-3: iOS polish-sweep"
description: "Systematisk audit och fix av haptic, loading, empty och error states i alla 15 native-vyer"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Aktualitet verifierad
  - Audit-tabell
  - Prioriterade fixar
  - Implementation
  - Filer
  - Tester
  - Risker
---

# S32-3: iOS polish-sweep

## Aktualitet verifierad

**Kommandon körda:**
```
ls ios/Equinet/Equinet/Native*.swift
grep -n "sensoryFeedback" ios/Equinet/Equinet/Native*.swift
grep -n "isLoading\|ProgressView" ios/Equinet/Equinet/Native*.swift
```

**Resultat:** Alla 15 native-vyer inventerade. Haptic saknas helt i 4 vyer med actions (Profile, Announcements, Insights, GroupBookings). 6 vyer har haptic som bara triggar på data-count (fel trigger, firing på initial load). Loading/Empty/Error är generellt välimplementerade med retry-knappar.

**Beslut:** Fortsätt -- 11 specifika problem identifierade.

---

## Audit-tabell

| Vy | Haptic | Loading | Empty | Error+Retry | Åtgärd |
|----|--------|---------|-------|-------------|--------|
| NativeDashboardView | ⚠️ trigger=count (fel) | ✅ | ✅ | ✅ | Fix haptic trigger |
| NativeBookingsView | ⚠️ .selection on filter only | ✅ | ✅ | ✅ | OK (actions i DetailView) |
| NativeBookingDetailView | ✅ .success/.error on actions | ✅ | ✅ | ✅ | Inget |
| NativeCustomersView | ⚠️ .selection on filter only | ✅ | ✅ | ✅ | OK (actions i DetailView) |
| NativeServicesView | ⚠️ trigger=count, ingen toggle/create | ✅ | ✅ | ✅ | Fixa toggle + create haptic |
| NativeReviewsView | ⚠️ trigger=count (ok för read-only) | ✅ | ✅ | ✅ | Acceptabel |
| NativeProfileView | ❌ ingen haptic på save | ✅ | ⚠️ | ✅ | Lägg till save haptic |
| NativeCalendarView | ✅ | ✅ | ✅ | ✅ | Inget |
| NativeDueForServiceView | ⚠️ trigger=count | ✅ | ✅ | ✅ | Acceptabel (read-only) |
| NativeInsightsView | ❌ ingen haptic på period-byte | ✅ | ✅ | ✅ | Lägg till period haptic |
| NativeHelpView | N/A (statisk) | N/A | ✅ | N/A | Inget |
| NativeMoreView | N/A (navigation) | ✅ | ⚠️ | ✅ | Inget |
| NativeAnnouncementsView | ❌ ingen haptic på avbryt/skapa | ✅ | ✅ | ✅ | Lägg till action haptic |
| NativeGroupBookingsView | ❌ ingen haptic alls | ✅ | ✅ | ✅ | Lägg till refresh haptic |
| NativeLoginView | N/A | N/A | N/A | N/A | Inget |

---

## Prioriterade fixar (≥10 krävs)

### Fix 1: NativeProfileView -- save success/error haptic
**Problem:** `onSavePersonal` och `onSaveBusiness` ger inget haptic vid lyckad/misslyckad sparning. Användaren vet inte om save lyckades.
**Lösning:** Lägg till `@State private var hapticSuccess = false` + `@State private var hapticError = false` + `.sensoryFeedback(.success, trigger:)` och `.sensoryFeedback(.error, trigger:)`. Togglea i varje save-callback baserat på `ok`.

### Fix 2: NativeServicesView -- toggle active haptic
**Problem:** `performToggleActive()` ger ingen direkt haptic. `.sensoryFeedback(.success, trigger: viewModel.services.count)` triggar bara vid count-ändring (alltså aldrig vid toggle).
**Lösning:** Lägg till `@State private var hapticToggle = false` + `@State private var hapticCreate = false`. Togglea `hapticToggle` i `performToggleActive()` + `hapticCreate` i `performCreateService()`.

### Fix 3: NativeServicesView -- createService success haptic
**Problem:** Ingen haptic vid lyckad tjänstskapning. Formuläret stängs men ingen bekräftelse.
**Lösning:** Inkluderase i Fix 2 ovan.

### Fix 4: NativeAnnouncementsView -- cancelAnnouncement haptic
**Problem:** Destructiv action (avbryta annons) ger ingen haptic.
**Lösning:** Lägg till `@State private var hapticCancel = false`. Togglea efter `await viewModel.cancelAnnouncement(id:)` om `ok == true`. `.sensoryFeedback(.warning, trigger: hapticCancel)` (warning = destructiv action).

### Fix 5: NativeAnnouncementsView -- createAnnouncement success haptic
**Problem:** Skapa ny annons ger ingen haptic bekräftelse.
**Lösning:** Lägg till `@State private var hapticCreate = false`. Togglea vid lyckad skapning.

### Fix 6: NativeInsightsView -- period selection haptic
**Problem:** Period-picker (3M/6M/12M) ger ingen haptic vid byte. Picker är interaktiv men tyst.
**Lösning:** `.sensoryFeedback(.selection, trigger: viewModel.selectedPeriod)`.

### Fix 7: NativeDashboardView -- fix haptic trigger
**Problem:** `.sensoryFeedback(.success, trigger: viewModel.dashboard?.todayBookings.count ?? 0)` triggar på bokningantal-ändring, inte på pull-to-refresh-avslut. Kan trigga oväntat.
**Lösning:** Lägg till `@State private var hapticRefreshed = false`. Togglea i `.refreshable { ... hapticRefreshed.toggle() }` efter `await viewModel.refresh()`.

### Fix 8: NativeGroupBookingsView -- refresh haptic
**Problem:** Ingen haptic alls i vyn, inte ens på pull-to-refresh.
**Lösning:** `@State private var hapticRefreshed = false`. Togglea i `.refreshable`. `.sensoryFeedback(.success, trigger: hapticRefreshed)`.

### Fix 9: NativeProfileView -- image upload haptic
**Problem:** `uploadProfileImage()` ger ingen haptic om det lyckas/misslyckas.
**Lösning:** Återanvänd `hapticSuccess`/`hapticError` från Fix 1. Togglea i `uploadProfileImage()` callback.

### Fix 10: NativeReviewsView -- fix haptic trigger
**Problem:** `.sensoryFeedback(.success, trigger: viewModel.reviews.count)` triggar vid initial load + varje ny recension. Bättre att trigga på `isLoading` → `false` transition.
**Lösning:** `.sensoryFeedback(.success, trigger: viewModel.isLoading)` med `.onChange` check -- eller behåll count-trigger som är acceptabel för en read-only vy. **Beslut: Behåll count-trigger, det är acceptabelt.**

### Fix 11: NativeServicesView -- emptyState förbättring
**Problem:** `emptyState` finns men kontrollera att den har ikon + text + CTA-knapp.
**Lösning:** Verifiera och förbättra om nödvändigt.

---

## Implementation

**Strategi:** Ren iOS-vy-layer. Inga ViewModels ändras. Inga API-routes. Inga tester (haptics = tactile/visual, verifieras med mobile-mcp).

**Ordning:**
1. Fix 1+9: NativeProfileView (save + image upload haptic)
2. Fix 2+3: NativeServicesView (toggle + create haptic)
3. Fix 4+5: NativeAnnouncementsView (cancel + create haptic)
4. Fix 6: NativeInsightsView (period haptic)
5. Fix 7: NativeDashboardView (refresh haptic)
6. Fix 8: NativeGroupBookingsView (refresh haptic)
7. Fix 11: NativeServicesView emptyState kontroll

---

## Filer

| Fil | Åtgärd |
|-----|--------|
| `ios/Equinet/Equinet/NativeProfileView.swift` | ÄNDRA (save + upload haptic) |
| `ios/Equinet/Equinet/NativeServicesView.swift` | ÄNDRA (toggle + create haptic, emptyState) |
| `ios/Equinet/Equinet/NativeAnnouncementsView.swift` | ÄNDRA (cancel + create haptic) |
| `ios/Equinet/Equinet/NativeInsightsView.swift` | ÄNDRA (period haptic) |
| `ios/Equinet/Equinet/NativeDashboardView.swift` | ÄNDRA (fix refresh haptic trigger) |
| `ios/Equinet/Equinet/NativeGroupBookingsView.swift` | ÄNDRA (refresh haptic) |

**Inga ändringar i:**
- ViewModels -- haptics är vy-ansvar
- API-routes -- inga backend-ändringar
- Tests -- inga nya tester (haptics testas visuellt/taktilt)

---

## Tester

- **Inga nya unit-tester** -- haptic är UI-beteende utan affärslogik
- **Visuell verifiering:** mobile-mcp screenshots av varje fixad vy
- **Bygg-verifiering:** `xcodebuild test -only-testing:EquinetTests` -- befintliga tester ska vara gröna

---

## Risker

- **sensoryFeedback trigger-semantik:** Bool toggle är det enklaste mönstret (kopierat från NativeBookingDetailView). Risk att trigger-värde inte ändras (om man togglear `false → false`). Fix: ALLTID toggle (`.toggle()`).
- **NativeAnnouncementsView cancel-action:** `_ = await viewModel.cancelAnnouncement(id:)` returnerar Bool. Om den returnerar `false` (API-fel) ska vi trigga hapticError istället för hapticCancel. Implementeras som `if ok { hapticCancel.toggle() } else { hapticError.toggle() }`.
- **Haptic på Upload:** `uploadProfileImage()` är privat asynkron. Returnerar inget värde -- behöver ViewModel-stöd för att detektera framgång. Enklast: `.sensoryFeedback(.success, trigger: viewModel.profileImageUrl)` när URL ändras.
