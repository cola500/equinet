---
title: "S48-0: iOS auth-desync-fix"
description: "Fixa att WebView cookie-store inte populeras korrekt efter native login"
category: plan
status: active
last_updated: 2026-04-20
sections:
  - Problemanalys
  - Rotorsak
  - Lösning
  - Filer
  - Testplan
---

# S48-0: iOS auth-desync-fix

## Aktualitet verifierad

**Kommandon körda:**
- `grep -n "exchangeSessionForWebCookies\|allHeaderFields" ios/Equinet/Equinet/AuthManager.swift`
- Läste `WebView.swift` (makeUIView), `ContentView.swift`, `AuthenticatedView.swift`, `NativeMoreView.swift`
- Läste `docs/metrics/ios-audit-2026-04-20-messaging-attachments.md`

**Resultat:** Buggen bekräftad. `exchangeSessionForWebCookies()` använder `allHeaderFields as? [String: String]`
som förlorar duplicate `Set-Cookie`-headers (HTTP/2 limitation). Verifierad mot audit-rapport.

**Beslut:** Fortsätt — problemet är fortfarande aktivt.

---

## Problemanalys

S46-3-audit visade att native login (Supabase Swift SDK) leder till att WebView-sidor visar
"Kunde inte ladda"-fel. Rotorsaken är att `exchangeSessionForWebCookies()` i `AuthManager.swift`
inte korrekt läser alla `Set-Cookie`-headers från session-exchange-svaret.

## Rotorsak

`exchangeSessionForWebCookies()` läser cookies via:

```swift
let cookies = HTTPCookie.cookies(withResponseHeaderFields: headerFields, for: responseURL)
```

där `headerFields` hämtas från `httpResponse.allHeaderFields as? [String: String]`.

**Problemet:** I HTTP/2 (Vercel) skickas flera `Set-Cookie`-headers. När de serialiseras till
`[String: String]` mergas dubblettnycklar — bara SISTA `Set-Cookie`-värdet bevaras.

Supabase SSR sätter minst 2 cookies:
- `sb-zzdamokfeenencuggjjp-auth-token.0` (chunk 1)
- `sb-zzdamokfeenencuggjjp-auth-token.1` (chunk 2)

Med `allHeaderFields` bevaras bara en chunk → inkomplett session → WebView autentiseras ej.

## Lösning

`URLSession.shared` parsar ALLA `Set-Cookie`-headers korrekt och lagrar dem i
`HTTPCookieStorage.shared`. Lösningen är att läsa cookies därifrån istället:

```swift
// Ny implementation:
let cookies = HTTPCookieStorage.shared.cookies(for: url) ?? []
for cookie in cookies {
    await cookieStore.setCookie(cookie)
}
```

**Tilläggsförbättringar:**
- Injicera `URLSession` som beroende i `AuthManager` (DI-pattern som `keychain`) för testbarhet
- Lägg till loggning om cookies.isEmpty efter lyckad 200-response

## Filer

| Fil | Ändring |
|-----|---------|
| `ios/Equinet/Equinet/AuthManager.swift` | Fix `exchangeSessionForWebCookies()`, lägg till URLSession DI |
| `ios/Equinet/EquinetTests/AuthManagerTests.swift` | Lägg till test för exchange med URLProtocol-mock |
| `.claude/rules/ios-learnings.md` | Dokumentera allHeaderFields-gotcha + QA-testflöde |

## Testplan

### XCTest (ny)
- `testExchangeSessionForWebCookies_withNoSession_returnsEarly` — guard-condition
- `testExchangeSessionForWebCookies_withSuccessResponse_injectsCookies` — URLProtocol-mock

### Visuell verifiering (mobile-mcp)
- Fresh install → native login → öppna Meddelanden (MoreWebView) → ska visas utan fel
- Befintlig session → app-restart → öppna MoreWebView → ska fungera

### Körordning
1. Skriv tester (RED)
2. Fixa `AuthManager.swift` (GREEN)
3. Kör `AuthManagerTests` för att verifiera
4. Kör mobile-mcp visuell verifiering
