---
title: "S32-3: iOS polish-sweep -- Done"
description: "Systematisk haptic-audit av 15 native-vyer och 10 implementerade fixar"
category: guide
status: active
last_updated: 2026-04-18
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Avvikelser
  - Lärdomar
---

# S32-3: iOS polish-sweep -- Done

## Acceptanskriterier

- [x] Audit-tabell skapad för alla 15 native-vyer × (Haptic | Loading | Empty | Error)
- [x] ≥10 polish-fixar implementerade
- [x] cx-ux-reviewer godkänd
- [x] `xcodebuild test -only-testing:EquinetTests` grön

## Definition of Done

- [x] Inga TypeScript/Swift-kompileringsfel
- [x] Säker (inga auth/security-ändringar)
- [x] 308 tester, 0 misslyckade
- [x] Feature branch `feature/s32-3-ios-polish-sweep`

## Reviews körda

- **ios-expert**: Plan godkänd. Flaggade att `viewModel.profileImageUrl` trigger är opålitlig för image upload haptic. Åtgärdad.
- **code-reviewer**: Inga blockers. Flaggade att `performToggleActive` alltid ger haptic (ViewModel Void-return) + `performUpdateService` saknar haptic. Noterat för uppföljning.
- **cx-ux-reviewer**: Godkänd. Minor: UIRefreshControl ger redan system-haptic vid pull-to-refresh. Vår `.sensoryFeedback(.success)` kan bli dubbel på vissa enheter. Verifiera på fysisk hardware.

## Docs uppdaterade

Inga docs-uppdateringar (intern iOS UX-polish, inga API- eller feature-ändringar synliga för slutanvändare).

## Verktyg använda

- Läste patterns.md vid planering: nej (rent iOS-mönster)
- Kollade code-map.md för att hitta filer: nej (kände till filerna)
- Hittade matchande pattern: `NativeBookingDetailView.hapticSuccess/hapticError`-mönstret kopiert till alla vyer

## Implementerade fixar (10 st)

| # | Vy | Fix | Typ |
|---|---|---|---|
| 1 | NativeDashboardView | Ersatt count-trigger med `hapticRefreshed` på explicit pull-to-refresh | Fel trigger fixad |
| 2 | NativeInsightsView | Lagt till `.sensoryFeedback(.selection, trigger: viewModel.selectedPeriod)` | Ny haptic |
| 3 | NativeGroupBookingsView | Lagt till `hapticRefreshed` på pull-to-refresh | Ny haptic |
| 4 | NativeServicesView | Ersatt count-trigger med `hapticRefreshed` på pull-to-refresh | Fel trigger fixad |
| 5 | NativeProfileView | Lagt till `hapticRefreshed` på pull-to-refresh | Ny haptic |
| 6 | NativeAnnouncementsView | Lagt till `hapticRefreshed` på pull-to-refresh | Ny haptic |
| 7 | NativeDueForServiceView | Ersatt count-trigger med `hapticRefreshed` på pull-to-refresh | Fel trigger fixad |
| 8 | NativeReviewsView | Ersatt count-trigger med `hapticRefreshed` på pull-to-refresh | Fel trigger fixad |
| 9 | NativeCustomersView | Lagt till `hapticRefreshed` på pull-to-refresh (filter-selection behållen) | Ny haptic |
| 10 | NativeBookingsView | Lagt till `hapticRefreshed` på pull-to-refresh (filter-selection behållen) | Ny haptic |

## Avvikelser

- **Initial plan feltolkad**: Planen antog att haptic saknades helt i Profile, Services och Announcements. Audit visade att ViewModels redan har `UINotificationFeedbackGenerator` för alla CRUD-actions. View-layer haptics ovanpå ViewModel-haptics = dubbla haptics. Fixades: view-layer ansvarar för pull-to-refresh haptic, ViewModel ansvarar för action haptics.
- **mobile-mcp visuell verifiering**: Ej utförd i denna session (simulator inte startad). Haptic-beteende verifieras enklast på fysisk hardware.
- **UIRefreshControl double-haptic**: iOS UIRefreshControl ger redan system-haptic vid pull-to-refresh. Vår `.sensoryFeedback(.success)` ger ytterligare haptic efter refresh-komplettering. Testas på fysisk hardware inför lansering.

## Lärdomar

1. **ViewModels har redan action-haptics.** Alla iOS-ViewModels (Bookings, Customers, Services, Profile, Announcements, Reviews) hade `UINotificationFeedbackGenerator().notificationOccurred(.success/.error)` för varje CRUD-action. Att lägga till `.sensoryFeedback` i vyn för samma actions ger dubbla haptics. **Regel för framtiden:** Kolla ViewModel för befintliga `UINotificationFeedbackGenerator`-anrop INNAN view-layer haptics läggs till.
2. **Pull-to-refresh är view-ansvar.** ViewModels hanterar actions men inte refresher. `hapticRefreshed.toggle()` i `.refreshable { }` är rätt mönster.
3. **Count-trigger för haptic är fel timing.** `.sensoryFeedback(.success, trigger: viewModel.items.count)` triggar vid initial load och varje count-förändring -- inte vid explicit user action. Använd alltid en dedikerad `@State private var hapticX = false` med `.toggle()` vid rätt tillfälle.
4. **`Bool.toggle()` är rätt pattern.** `@State private var hapticX = false` + `.sensoryFeedback(.success, trigger: hapticX)` + `hapticX.toggle()` vid action -- samma mönster som `NativeBookingDetailView`. Consistent.
