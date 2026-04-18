---
title: "S34-3: Felmeddelanden -- nätverks- vs autentiseringsfel"
description: "Differentiera felmeddelanden i inloggning: nätverksfel vs felaktiga credentials vs serverfel"
category: plan
status: active
last_updated: 2026-04-18
sections:
  - Aktualitet verifierad
  - Filer
  - Design
  - Approach
  - Risker
---

# S34-3: Plan

## Aktualitet verifierad

**Kommandon körda:** Läste AuthManager.swift och NativeLoginView.swift.
**Resultat:** Bekräftat -- `login()` catch-block är generiskt. URLError hamnar i `catch { loginError = "Något gick fel." }`. Ingen differentiering. NativeLoginView visar bara Text(error) utan ikon.
**Beslut:** Fortsätt

## Filer

- `ios/Equinet/Equinet/AuthManager.swift` (enum + mapURLError + loginErrorType)
- `ios/Equinet/Equinet/NativeLoginView.swift` (visa ikon + differentierat meddelande)
- `ios/Equinet/EquinetTests/AuthManagerTests.swift` (4 nya tester)

## Design

**LoginError-enum** (definieras i AuthManager.swift):
```swift
enum LoginError: Equatable {
    case invalidCredentials  // Fel lösenord/email
    case networkUnavailable  // Ingen internet
    case serverError         // 5xx-svar
    case unknown             // Oväntade fel
}
```

**AuthManager-ändringar:**
- Ny publik `loginErrorType: LoginError?`
- Ny intern `mapURLError(_ error: URLError) -> LoginError` (testbar)
- Utöka catch-block: `catch let urlError as URLError` FÖRE generic catch

**NativeLoginView-ändringar:**
- Ersätt `Text(error)` med `Label(error, systemImage: icon)` baserat på `loginErrorType`

**Testbara fall:**
- URLError(.notConnectedToInternet) → .networkUnavailable
- URLError(.timedOut) → .networkUnavailable
- URLError(.cancelled) → .networkUnavailable
- URLError(.unknown) → .unknown

## Approach

1. TDD: Skriv 4 röda tester i AuthManagerTests FÖRST
2. Definiera LoginError enum + mapURLError (GREEN)
3. Lägg till loginErrorType i AuthManager
4. Utöka catch-block i login()
5. Uppdatera NativeLoginView med ikon
6. Kör AuthManagerTests (alla ska vara gröna)

## Risker

- `AuthError` från Supabase SDK är redan tagen -- namnge vår enum `LoginError`
- URLError-catch MÅSTE komma FÖRE generic `catch` -- annars fångas de aldrig
