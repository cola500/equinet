---
title: "S55-1: iOS Demo Mode"
description: "Filtrera NativeMoreView och NativeProfileView baserat på featureFlags[\"demo_mode\"]"
category: plan
status: active
last_updated: 2026-04-24
sections:
  - Bakgrund
  - Filer som ändras
  - Implementation
  - Verifiering
---

# S55-1: iOS Demo Mode

## Aktualitet verifierad

**Kommandon körda:** Läste `NativeMoreView.swift` och `NativeProfileView.swift` — bekräftade att `featureFlags["demo_mode"]` inte läses i någon av filerna.
**Resultat:** Problemet finns — demo mode ignoreras i iOS.
**Beslut:** Fortsätt.

## Bakgrund

Webb-appen har demo mode (`demo_mode` feature flag) som kraftigt begränsar navigation och synlighet.
iOS-appen skickar redan `featureFlags: [String: Bool]` till alla native views — men läser inte `demo_mode`.

## Filer som ändras

1. `ios/Equinet/Equinet/NativeMoreView.swift` — `visibleSections`
2. `ios/Equinet/Equinet/NativeProfileView.swift` — `settingsTab` + `profileTab`

## Implementation

### NativeMoreView.swift

I `visibleSections`-beräkningen:

```swift
let isDemoMode = featureFlags["demo_mode"] ?? false
if isDemoMode {
    // Visa bara "Min profil"-raden (path == "/provider/profile")
    let profileItems = allMenuSections.flatMap(\.items).filter { $0.path == "/provider/profile" }
    return profileItems.isEmpty ? [] : [(profileItems[0].section, profileItems)]
}
// Annars: befintlig feature flag-filtrering
```

### NativeProfileView.swift

Lägg till `private var isDemoMode: Bool { featureFlags["demo_mode"] ?? false }`.

- `profileTab` → `linksSection` döljs med `if !isDemoMode`
- `settingsTab` → `dangerZoneSection` döljs med `if !isDemoMode`
- `settingsTab` → `rescheduleSection`: villkor `(featureFlags["self_reschedule"] ?? false) && !isDemoMode`
- `settingsTab` → `recurringSection`: villkor `(featureFlags["recurring_bookings"] ?? false) && !isDemoMode`

## Verifiering

- Ingen ny ViewModel-logik → XCTest ej nödvändigt
- Visuell verifiering med mobile-mcp: screenshot Mer-fliken + Inställningar-fliken med `demo_mode = true`
- xcodebuild test EquinetTests (full svit) för att bekräfta inga regressioner
