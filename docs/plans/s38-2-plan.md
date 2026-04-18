---
title: "S38-2: Fixa messaging-blockers (deep-link + NativeMoreView)"
description: "Åtgärdar de 2 blockers som hittades i S38-0-audit"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Aktualitet verifierad
  - Approach
  - Fix 1 - Deep-link URL
  - Fix 2 - NativeMoreView
  - Tester
  - Risker
---

# S38-2: Fixa messaging-blockers

## Aktualitet verifierad

**Kommandon körda:**
- `grep -n "deepLink" src/domain/conversation/ConversationService.ts` → linje 134 innehåller `/provider/bookings/${id}/messages` (fel URL)
- `grep -n "messaging" ios/.../NativeMoreView.swift` → 0 träffar (messaging saknas)

**Resultat:** Båda blockers bekräftade på main post-merge S38-0.
**Beslut:** Fortsätt

## Approach

Två isolerade fixar i oberoende filer. TDD för Fix 1 (TypeScript, testbar). Fix 2 är en ren Swift-tilläggsrad.

## Fix 1 — Deep-link URL i ConversationService.ts

**Fil:** `src/domain/conversation/ConversationService.ts:134`
**Ändring:** `/provider/bookings/${input.booking.id}/messages` → `/provider/messages/${input.booking.id}`

**Befintligt test:** `src/domain/notification/MessageNotifier.test.ts:48` — uppdateras från `/provider/bookings/booking-1/messages` → `/provider/messages/booking-1`

**Ev. ConversationService-test:** Kolla om det finns integrationstester som verifierar deepLink-värdet.

## Fix 2 — NativeMoreView: lägg till Meddelanden

**Fil:** `ios/Equinet/Equinet/NativeMoreView.swift:38-39`
**Ändring:** Lägg till `MoreMenuItem` för messaging i sektionen "Dagligt arbete" efter "Mina tjänster":

```swift
MoreMenuItem(label: "Meddelanden", icon: "message", path: "/provider/messages", section: "Dagligt arbete", featureFlag: "messaging"),
```

Placering: mellan "Mina tjänster" och "Logga arbete" (alfabetiskt/logiskt). Alternativt sist i "Dagligt arbete" — välj det som matchar ProviderNav-ordningen.

**ProviderNav-ordning (webb):** Meddelanden är andra länken i desktop-nav (efter Kalender). I BottomTabBar ligger den som fjärde. Välj "Dagligt arbete" eftersom det är kommunikation per bokning.

## Tester

- **Fix 1:** RED → uppdatera befintligt test i `MessageNotifier.test.ts` (ändra förväntad URL) + ev. `ConversationService`-test → GREEN → kör fix
- **Fix 2:** Inga unit-tester (Swift menyobjekt är deklarativ konfiguration, testar via visual verification med mobile-mcp)

## Risker

- NativeMoreView feature-flag: `featureFlag: "messaging"` — appen hämtar flags via `AppCoordinator.fetchFeatureFlags()`. Lokalt defaultar messaging till `true` (API returnerar true). Verifieras visuellt.
- iOS-bygg krävs för Fix 2 — DerivedData kan behöva rensas.
