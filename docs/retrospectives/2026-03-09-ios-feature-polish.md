---
title: "Retrospektiv: iOS Feature Polish -- Push, Speech, Kalender"
description: "UX-polish av push-notiser, taligenkänning och native kalendervy"
category: retrospective
status: active
last_updated: "2026-03-09"
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan förbättras
  - Patterns att spara
  - Lärandeeffekt
---

# Retrospektiv: iOS Feature Polish -- Push, Speech, Kalender

**Datum:** 2026-03-09
**Scope:** UX-polish av tre iOS-features: push deep-link + haptics, speech audio levels + confidence, kalender inline-actions + filter

---

## Resultat

- 14 ändrade filer, 0 nya filer, 0 nya migrationer
- 6 nya tester (3 TS speech, 2 TS calendar API, 1 TS push), alla TDD, alla gröna
- 3175 totala TS-tester + 24 iOS-tester (inga regressioner)
- Typecheck = 0 errors, Lint = 0 errors
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| iOS Push | AppDelegate.swift | Haptic feedback (success/error), deep-link till /provider/bookings, felnotis vid misslyckad action, badge-hantering |
| iOS Push | ContentView.swift | Badge reset vid app active |
| iOS Speech | SpeechRecognizer.swift | RMS audio level beräkning (10 Hz throttle), confidence score från segments |
| iOS Bridge | BridgeHandler.swift | speechAudioLevel meddelandetyp, confidence i speechTranscript payload |
| iOS Kalender | CalendarViewModel.swift | updateBookingStatus med optimistisk UI, offline fallback, tjänstefilter |
| iOS Kalender | NativeCalendarView.swift | Context menu (bekräfta/avvisa), filter-pills, recurring-ikon, loading overlay, onNavigateToWeb callback |
| iOS Kalender | BookingDetailSheet.swift | Action-knappar för pending, anteckningar, recurring badge, visa-i-appen |
| iOS Modeller | CalendarModels.swift | serviceId, bookingSeriesId, customerNotes, providerNotes fält + withStatus() |
| API | route.ts (native/calendar) | 4 nya fält i select-block och response mapping |
| TS Hook | useSpeechRecognition.ts | audioLevel state, confidence state, speechAudioLevel bridge-hantering |
| Domain | BookingEventHandlers.ts | Rikare push body med häst + tid, hiddenPreviewsBodyPlaceholder |

## Vad gick bra

### 1. Fas-för-fas verifiering fångade fel tidigt
CalendarViewModel.swift saknade `import UIKit` för `UINotificationFeedbackGenerator` -- fångades direkt av xcodebuild mellan faserna, fixades på 10 sekunder.

### 2. Bakåtkompatibla modelländringar
Genom att göra `serviceId` optional (`String?`) i CalendarModels kunde alla 24 befintliga iOS-tester passera utan ändringar -- cachad data utan nya fält fungerar fortfarande.

### 3. Effektiv parallellisering av iOS + TS
Varje fas verifierades med rätt verktyg: `xcodebuild build` för Swift, `npm run test:run` för TS, typecheck emellan. Inga cross-layer-regressioner.

### 4. Callback-pattern istället för tight coupling
`onNavigateToWeb` closure i NativeCalendarView undviker att exponera `showNativeCalendar` state-binding -- ContentView äger navigeringslogiken.

## Vad kan förbättras

### 1. AppLogger saknas på main
Session 86 skapade `AppLogger.swift` på en branch som aldrig mergades. Nuvarande iOS-kod på main använder fortfarande `print()` -- inkonsekvent med CLAUDE.md:s loggningsregel.

**Prioritet:** MEDEL -- ska fixas vid nästa iOS-session, antingen genom att merga session 86-ändringar eller genom att återskapa AppLogger.

### 2. Inga iOS-tester för nya features
CalendarViewModel.updateBookingStatus(), filter-logik och BookingDetailSheet action-knappar saknar XCTest-coverage. Svårt att testa utan dependency injection i CalendarViewModel (APIClient.shared).

**Prioritet:** MEDEL -- CalendarViewModel behöver DI-refaktorering (liknande AuthManager-mönstret från session 87) innan tester kan skrivas.

## Patterns att spara

### Optimistisk UI-uppdatering i Swift
```swift
let oldBookings = bookings
if let index = bookings.firstIndex(where: { $0.id == bookingId }) {
    bookings[index] = bookings[index].withStatus(newStatus)
}
// ... async API call ...
// On failure: bookings = oldBookings
```
Kräver `withStatus()` copy-metod på Codable struct (alla fält explicit).

### Audio level från AVAudioEngine
```swift
inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
    // Throttle till ~10 Hz med CACurrentMediaTime()
    guard let channelData = buffer.floatChannelData?[0] else { return }
    let rms = sqrt(sum / Float(frameLength))
    let normalized = min(1.0, rms * 5.0)  // 0.01-0.3 -> 0-1
}
```

### Context menu för inline-actions
`contextMenu` är enklare än `swipeActions` i en ZStack-baserad kalendervy (swipe krockar med TabView page-swipen). Ger native long-press-meny med haptic.

## Lärandeeffekt

**Nyckelinsikt:** Vid modelländringar som berör cachad data (SharedDataManager, IndexedDB) -- gör nya fält optionella för bakåtkompatibilitet. API:t skickar alltid nya fält, men sparad data kan sakna dem. Alternativet (migrera cachad data) är oproportionerligt komplext för en kalender-cache med kort livslängd.
