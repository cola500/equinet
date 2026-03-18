---
title: SwiftUI Pro Code Review
description: Genomlysning av iOS-appen med SwiftUI Pro skill -- deprecated API, prestanda, accessibility, concurrency
category: ios
status: active
last_updated: 2026-03-18
sections:
  - Kritiskt
  - Hog prioritet
  - Medium
  - Lagt
  - Rekommenderad fixordning
tags: [ios, swiftui, review, refactor]
---

# SwiftUI Pro -- Granskningsrapport (2026-03-18)

Genomlysning av alla 50+ Swift-filer i `ios/Equinet/Equinet/` med SwiftUI Pro skill.
Referensfiler: api.md, views.md, data.md, navigation.md, design.md, accessibility.md, performance.md, swift.md, hygiene.md.

---

## KRITISKT (kraschar/sakerhet)

| # | Fil | Rad | Problem |
|---|-----|-----|---------|
| 1 | `CalendarViewModel.swift` | 290, 300, 341, 346, 363, 368 | `UINotificationFeedbackGenerator` utan `#if os(iOS)` -- kraschar pa macOS/visionOS. Alla andra ViewModels har denna guard. |
| 2 | `NativeCalendarView.swift` | 692 | Force-unwrap `calendar.date(byAdding:)!` -- app-krasch pa edge-datum |
| 3 | `CustomerDetailView.swift` | 113 | Force-unwrap pa telefon-URL fran anvandardata -- kraschar vid ogiltigt nummer |
| 4 | `CalendarViewModel.swift` | 400-401 | Ytterligare force-unwraps pa `calendar.date(byAdding:)` |

---

## HOG PRIORITET (prestanda/beteende)

| # | Fil | Rad | Problem |
|---|-----|-----|---------|
| 5 | `KeychainHelper.swift` | 112 | `iso8601Formatter` ar `var` (computed) -- ny `ISO8601DateFormatter` vid varje token-anrop. Byt till `static let`. |
| 6 | `CalendarModels.swift` | 59 | `DateFormatter` allokeras i computed property -- hundratals instanser i kalendervy. Byt till `static let`. |
| 7 | `CustomersViewModel.swift` | 156, 163 | `ISO8601DateFormatter` allokeras inuti `filter`-closure -- O(n) allokeringar vid filtrering |
| 8 | `ExceptionFormSheet.swift` | 148-160 | `DateFormatter` allokeras per anrop i `timeFromString` trots att statisk formatter redan finns |
| 9 | `KeychainHelper.swift` | 123 | `print()` istallet for `AppLogger` -- kanslig keychain-info i konsolloggen |
| 10 | `StarRatingView.swift` | 27 | `onTapGesture` istallet for `Button` -- VoiceOver fungerar inte |
| 11 | `NativeCalendarView.swift` | 304 | `onTapGesture` pa bokningsblock -- manuell `.accessibilityAddTraits(.isButton)` ar en workaround |
| 12 | `WeekStripView.swift` | 70 | Samma: `onTapGesture` med manuell accessibility-trait |

---

## MEDIUM (API-modernisering)

| # | Fil | Rad | Problem |
|---|-----|-----|---------|
| 13 | `AuthenticatedView.swift` | 99, 121 | `DispatchQueue.main.asyncAfter` -- byt till `Task.sleep(for:)` |
| 14 | `NativeBookingsView.swift` | 233 | `DispatchQueue.main.asyncAfter` -- byt till `Task.sleep(for:)` |
| 15 | `CustomerWebView.swift` | 82 | `DispatchQueue.main.asyncAfter` -- byt till `Task.sleep(for:)` |
| 16 | `NativeCalendarView.swift` | 50, 126, 228, 305 | `UIImpactFeedbackGenerator` x4 -- byt till `.sensoryFeedback()` |
| 17 | `NativeTabBar.swift` | 47 | `UIImpactFeedbackGenerator` -- byt till `.sensoryFeedback()` |
| 18 | `NativeLoginView.swift` | 60, 77, 112 | `clipShape(RoundedRectangle(...))` -- byt till `.rect(cornerRadius:)` |
| 19 | `ServiceFormSheet.swift` | 135 | UIKit `UIApplication.sendAction` -- byt till `@FocusState` |
| 20 | `NativeLoginView.swift` | 22 + `SplashView.swift` 15 | Duplicerad brand-farg -- anvand `Color.equinetGreen` |
| 21 | `CustomerWebView.swift` | 134, 143 | "forsok" -- saknar a/o i UI-text |

---

## LAGT (kodstil/konventioner)

| # | Fil | Problem |
|---|-----|---------|
| 22 | 6+ filer | `Date()` istallet for `Date.now` (~20 forekomster) |
| 23 | 5+ filer | `.fontWeight(.bold)` istallet for `.bold()` |
| 24 | `AuthenticatedView.swift` | `offlineBanner`/`reconnectedBanner` computed properties -- byt till `NetworkBannerView` struct + `Label` |
| 25 | `NativeReviewsView.swift`, `NativeServicesView.swift` | Stora `some View`-returnerande funktioner -- byt till View-structs |
| 26 | Flera filer | Button-actions med inline `Task {}` -- byt till extraherade metoder |
| 27 | `ContentView.swift` | `onAppear` med auth-check -- byt till `task()` |
| 28 | `PendingActionStore.swift` | `UserDefaults.standard` hardkodad i `retryAll()` -- bryter test-isolation |

---

## Rekommenderad fixordning

1. **Kritiskt** (#1-4): Fixa force-unwraps och saknad `#if os(iOS)` -- kraschrisker
2. **Prestanda** (#5-8): DateFormatter/ISO8601DateFormatter som `static let` -- direkt matbar skillnad i kalendervy
3. **A11y** (#10-12): `onTapGesture` -> `Button` i StarRating och kalender -- VoiceOver-anvandare kan inte interagera
4. **GCD** (#13-15): `DispatchQueue` -> structured concurrency -- blockerar framtida strict concurrency
5. **Resten**: Modernisering och kodstil i lugn takt

---

## Genomford

- [ ] #1 CalendarViewModel `#if os(iOS)` guard
- [ ] #2 NativeCalendarView force-unwrap
- [ ] #3 CustomerDetailView force-unwrap
- [ ] #4 CalendarViewModel force-unwrap
- [ ] #5 KeychainHelper iso8601Formatter
- [ ] #6 CalendarModels DateFormatter
- [ ] #7 CustomersViewModel ISO8601DateFormatter
- [ ] #8 ExceptionFormSheet DateFormatter
- [ ] #9 KeychainHelper print -> AppLogger
- [ ] #10 StarRatingView onTapGesture -> Button
- [ ] #11 NativeCalendarView onTapGesture -> Button
- [ ] #12 WeekStripView onTapGesture -> Button
- [ ] #13-15 GCD -> Task.sleep
- [ ] #16-17 UIImpactFeedbackGenerator -> sensoryFeedback
- [ ] #18-21 Ovriga medium
- [ ] #22-28 Lag prioritet
