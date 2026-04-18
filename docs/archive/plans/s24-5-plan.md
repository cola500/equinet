---
title: "Plan S24-5: iOS cleanup"
description: "Byt Task.detached -> Task, fix force unwrap i AuthManager"
category: plan
status: active
last_updated: 2026-04-12
sections:
  - Filer som ändras
  - Approach
  - Risker
---

# Plan S24-5: iOS cleanup

## Filer som ändras

- `ios/Equinet/Equinet/AuthManager.swift` -- Task.detached -> Task (rad 86), guard let för URL (rad 128)
- `ios/Equinet/Equinet/PushManager.swift` -- Task.detached -> Task (rad 63)

## Approach

### 1. Task.detached -> Task

`Task.detached` skapar en ny task utan att ärva actor-context, vilket kan ge oväntad
concurrency-semantik och göra det svårare att analysera ägandeskap. Enkla fire-and-forget
operationer som dessa (API-anrop) passar bättre med vanlig `Task {}` som ärver context.

**AuthManager.logout() rad 86:**
```swift
// Före:
Task.detached {
    do {
        try await APIClient.shared.unregisterDeviceToken(token)
    } catch { ... }
}

// Efter:
Task {
    do {
        try await APIClient.shared.unregisterDeviceToken(token)
    } catch { ... }
}
```

**PushManager.didRegisterForRemoteNotifications() rad 63:**
```swift
// Före:
Task.detached { ... registerDeviceToken ... }

// Efter:
Task { ... registerDeviceToken ... }
```

### 2. Force unwrap -> guard let (AuthManager rad 128)

```swift
// Före:
let url = URL(string: AppConfig.sessionExchangePath, relativeTo: AppConfig.baseURL)!

// Efter:
guard let url = URL(string: AppConfig.sessionExchangePath, relativeTo: AppConfig.baseURL) else {
    AppLogger.auth.error("Invalid session exchange URL")
    return
}
```

## Risker

Inga -- rent mekaniska byten utan beteendeändring.

## Tester

Kör `EquinetTests/AuthManagerTests` (Nivå 1).
