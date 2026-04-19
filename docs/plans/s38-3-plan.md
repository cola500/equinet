---
title: "S38-3: Messaging-knapp i native bokningsdetalj"
description: "Lägg till feature-flag-gated Meddelanden-knapp i NativeBookingDetailView"
category: plan
status: active
last_updated: 2026-04-19
sections:
  - Aktualitet verifierad
  - Approach
  - Filer som ändras
  - Risker
---

# S38-3: Messaging-knapp i native bokningsdetalj

## Aktualitet verifierad

**Kommandon körda:**
- `grep -n "featureFlags" NativeBookingDetailView.swift` → 0 träffar (featureFlags saknas idag)
- `grep -n "NativeBookingDetailView" NativeBookingsView.swift` → bekräftat: skapas utan featureFlags
- `grep "messaging" NativeBookingDetailView.swift` → 0 träffar

**Beslut:** Fortsätt — gap bekräftat.

## Approach

Tre filer berörs (prop drilling av `featureFlags`):

1. **`NativeBookingDetailView.swift`** — lägg till `featureFlags: [String: Bool]` + messaging-knapp
   - Knappen visas när `featureFlags["messaging"] == true`
   - Knappen döljs för cancelled/no_show (messaging blockeras av API för dessa statusar)
   - Navigerar till `/provider/messages/{bookingId}` via `onNavigateToWeb`
   - Placeras sist i `actionsSection`, efter noteButton

2. **`NativeBookingsView.swift`** — lägg till `featureFlags: [String: Bool]` param + skicka vidare till detail view

3. **`AuthenticatedView.swift`** — skicka `coordinator.featureFlags` till `NativeBookingsView`

## Filer som ändras

| Fil | Ändring |
|-----|---------|
| `ios/Equinet/Equinet/NativeBookingDetailView.swift` | +featureFlags param, +messagingButton() |
| `ios/Equinet/Equinet/NativeBookingsView.swift` | +featureFlags param, vidarebefordra till detail |
| `ios/Equinet/Equinet/AuthenticatedView.swift` | skicka coordinator.featureFlags till NativeBookingsView |

Inga schema-ändringar. Inga API-ändringar. Inga testfils-ändringar behövs (trivial UI-ändring, feature-flag-gated).

## Risker

- Prop drilling av `featureFlags` är ett känt mönster i projektet (samma som NativeMoreView → NativeMoreItemView)
- `onNavigateToWeb` callback finns redan — navigation fungerar om WebView är aktiv
- Messaging-knapp i detail ≠ native messaging UI (WebView-navigering, ingen ny domänkod)
