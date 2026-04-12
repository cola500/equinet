---
title: "S3-2: Push-notiser -- kodforberedelse (utan APNs)"
description: "Koppla ihop befintligt push-system sa det fungerar end-to-end nar APNs-credentials pluggas in"
category: plan
status: wip
last_updated: 2026-04-01
sections:
  - Context
  - Nuvarande tillstand
  - Plan
  - Filer som andras
  - Verifiering
  - Risker och beslut
---

# S3-2: Push-notiser -- kodforberedelse (utan APNs)

## Context

Push-systemet ar nastan helt byggt:
- **Server**: PushDeliveryService, BookingCreatedPushHandler, StatusChangedPushHandler, device-tokens API (POST + DELETE)
- **iOS**: PushManager (permission + token), APIClient (register/unregister), BridgeHandler (message routing)
- **Databas**: DeviceToken-modell med upsert, max 20 per user, auto-cleanup vid 410 Gone
- **Tester**: 13 device-token route + 5 PushDeliveryService + 6 push handler = 24 befintliga tester

**Tre luckor gor att det inte fungerar end-to-end:**

1. Push-permission begars aldrig -- PushManager vantar pa `requestPush` bridge-meddelande som ingen skickar
2. Device tokens rensas aldrig vid logout -- orphaned tokens kvar i databasen
3. PushManager använder `print()` istallet for `AppLogger`

## Nuvarande tillstand

### iOS-flode vid login (vad som saknas)

```
AuthManager.login() -> state = .authenticated -> ContentView renderar AuthenticatedView
                                                  ^ HAR ska push-permission triggas
```

### iOS-flode vid logout (vad som saknas)

```
AuthManager.logout() -> keychain.delete() -> state = .loggedOut
                        ^ HAR ska unregisterDeviceToken() anropas FORE keychain-rensning
```

### Relevant kod

| Komponent | Fil | Status |
|-----------|-----|--------|
| PushManager | `ios/.../PushManager.swift` (75 rader) | Komplett, men `print()` |
| AuthManager.logout() | `ios/.../AuthManager.swift:140` | Saknar token unregister |
| ContentView | `ios/.../ContentView.swift` | Saknar push-trigger |
| PushDeliveryService | `src/domain/notification/PushDeliveryService.ts` | Komplett (5 tester) |
| BookingEventHandlers | `src/domain/booking/BookingEventHandlers.ts` | Komplett (6 push-tester) |
| device-tokens route | `src/app/api/device-tokens/route.ts` | Komplett (13 tester) |
| APIClient | `ios/.../APIClient.swift` | register + unregister finns |

## Plan

### Fas 1: RED -- Tester forst

**1a. AuthManager: logout unregisters device token**
- Fil: `ios/Equinet/EquinetTests/AuthManagerTests.swift`
- Nytt test: `testLogoutUnregistersDeviceToken`
- Verifiera att logout anropar unregister med ratt token FORE keychain-rensning
- Krav: injicera PushManager-beroende for testbarhet (eller mocka `PushManager.shared`)

**1b. ContentView: push permission vid authentication**
- Svart att unit-testa ContentView direkt (SwiftUI view)
- Alternativ: integrationstesta via mobile-mcp screenshot efter login
- Eller: flytta logiken till AppCoordinator (testbar) med metod `onAuthenticated()`

### Fas 2: GREEN -- Implementation

**2a. Trigga push-permission vid login**
- Fil: `ios/Equinet/Equinet/ContentView.swift`
- Lagg till `.onChange(of: authManager.state)` -- nar state blir `.authenticated`:
  ```swift
  .onChange(of: authManager.state) { _, newState in
      if newState == .authenticated {
          PushManager.shared.requestPermission()
      }
  }
  ```
- ContentView ager redan scenePhase side-effects -- naturlig plats

**2b. Token cleanup vid logout**
- Fil: `ios/Equinet/Equinet/AuthManager.swift`
- I `logout()`, FORE keychain-rensning:
  ```swift
  // Unregister device token (fire-and-forget)
  if let token = PushManager.shared.deviceToken {
      Task.detached {
          try? await APIClient.shared.unregisterDeviceToken(token)
      }
  }
  ```
- Fire-and-forget ar OK: om anropet failar (offline) rensas token vid nasta APNs 410 Gone

**2c. Byt print() till AppLogger i PushManager**
- Fil: `ios/Equinet/Equinet/PushManager.swift`
- Lagg till `import OSLog`
- Ersatt alla `print("[Push]...")` med `AppLogger.push.info/error/debug`

### Fas 3: Dokumentation

**3a. APNs setup-guide**
- Ny fil: `docs/operations/apns-setup.md`
- Innehåll:
  1. Skapa Apple Developer-konto (99 USD/ar)
  2. Certificates, Identifiers & Profiles -> Keys -> skapa APNs-nyckel
  3. Ladda ner .p8-filen
  4. Base64-encoda: `base64 -i AuthKey_XXXXXXXXXX.p8`
  5. Lagg till i Vercel env:
     - `APNS_KEY_ID` (10 tecken, fran nyckelnamnet)
     - `APNS_TEAM_ID` (10 tecken, fran Membership)
     - `APNS_KEY_P8` (base64-strang)
     - `APNS_BUNDLE_ID=com.equinet.Equinet`
     - `APNS_PRODUCTION=false` (true for App Store)
  6. Verifiering: se PushDeliveryService-loggar efter deploy

## Filer som andras

| Fil | Ändring | Ny/Befintlig |
|-----|---------|--------------|
| `ios/.../ContentView.swift` | `.onChange` for push-permission vid auth | Befintlig |
| `ios/.../AuthManager.swift` | Token unregister i logout() | Befintlig |
| `ios/.../PushManager.swift` | `print()` -> `AppLogger` | Befintlig |
| `ios/.../AuthManagerTests.swift` | 1-2 nya tester | Befintlig |
| `docs/operations/apns-setup.md` | APNs setup-guide | Ny |
| `docs/sprints/status.md` | S3-2 -> in_progress | Befintlig |

## Verifiering

### iOS-tester (Niva 1)
```bash
xcodebuild test -project ios/Equinet/Equinet.xcodeproj -scheme Equinet \
  -destination 'platform=iOS Simulator,id=<UDID>' \
  -only-testing:EquinetTests/AuthManagerTests
```

### Webb-tester (kontrollera att inget gatt sonder)
```bash
npx vitest run src/domain/notification
npx vitest run src/app/api/device-tokens
npm run typecheck
```

### Visuell verifiering (mobile-mcp)
- Bygg och starta appen i simulator
- Logga in -> verifiera att push-permission-dialog visas
- Logga ut -> verifiera att ingen krasch

## Risker och beslut

| Risk | Mitigering |
|------|-----------|
| `unregisterDeviceToken` failar vid logout (offline) | Fire-and-forget + APNs 410 auto-cleanup. Defense in depth. |
| Push-permission dialog vid varje app-start (biometric unlock) | iOS cachar permission-svar. Andra anropet ar no-op. |
| PushManager ar singleton, svar att testa | Testbarhet via observation av side-effects. Alternativ: protokoll-abstraktion (framtida forbattring). |
