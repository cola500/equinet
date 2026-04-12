---
title: "S13-4: iOS Supabase Swift SDK"
description: "Byt iOS-appens auth fran custom MobileTokenService till Supabase Swift SDK"
category: plan
status: wip
last_updated: 2026-04-04
tags: [ios, supabase, auth, migration]
sections:
  - Oversikt
  - Approach
  - Faser
  - Filer att andra
  - Filer att ta bort
  - Risker
  - Testplan
  - Acceptanskriterier
---

# S13-4: iOS Supabase Swift SDK

## Översikt

**Story:** Som utvecklare vill jag att iOS-appen autentiserar via Supabase Auth
sa att vi har en enda auth-kalla och kan ta bort MobileTokenService.

**Nuvarande system:**
- iOS loggar in via `POST /api/auth/native-login` -> custom HS256 JWT
- JWT lagras i Keychain (App Group), session-cookie injiceras i WKWebView
- APIClient skickar Bearer mobile-token pa alla anrop
- Token refresh via `/api/auth/mobile-token/refresh`
- Biometrisk unlock via LocalAuthentication

**Mal:**
- iOS loggar in via Supabase Swift SDK (`supabase.auth.signIn`)
- SDK:t hanterar session, refresh, lagring
- APIClient använder Supabase access_token som Bearer
- WKWebView far Supabase-cookies (inte NextAuth session-cookie)
- Biometrisk unlock TAS BORT (laggs till senare vid behov)

## Approach

**Full Supabase SDK** -- installera `supabase-swift` via SPM. SDK:t hanterar
login, logout, token refresh, session persistence. iOS-appen slutar anropa
`/api/auth/native-login` och `/api/auth/mobile-token/*`.

**Beslut:**
- Biometrisk unlock skippas (Supabase SDK hailer sessionen vid liv automatiskt)
- App Group Keychain anvands for widget-access
- Befintlig bridge-kommunikation for token-delning tas bort (onodvandigt nar bade
  nativ och web använder Supabase direkt)

## Faser

### Fas 1: SDK-installation och SupabaseManager

1. Installera `supabase-swift` via Swift Package Manager
2. Skapa `SupabaseManager.swift` (singleton med SupabaseClient)
3. Utoka `AppConfig.swift` med `supabaseURL` och `supabaseAnonKey`
4. Skapa `AppGroupKeychainStorage.swift` -- custom `AuthLocalStorage`-adapter
   som wrapprar Keychain med App Group (`group.com.equinet.shared`).
   Supabase SDK:ts default-lagring ar UserDefaults, men widgeten behover
   access via App Group Keychain.
5. Konfigurera SupabaseClient med custom storage-adaptern

**Filer:**
- Ny: `SupabaseManager.swift`
- Ny: `AppGroupKeychainStorage.swift`
- Andrad: `AppConfig.swift`
- Andrad: `Equinet.xcodeproj` (SPM dependency)

### Fas 2: AuthManager -- byt login/logout

1. `login(email:password:)` -> `supabase.auth.signIn(email:password:)`
2. `logout()` -> `supabase.auth.signOut()` + rensa cache
3. `checkExistingAuth()` -> kolla `supabase.auth.session`
4. Ta bort `AuthState.biometricPrompt` (3 states: checking, loggedOut, authenticated)
5. Ta bort `BiometricPromptView` fran ContentView
6. Ta bort `performLogin()` (POST till /api/auth/native-login)
7. Ta bort `authenticateWithBiometric()`

**Filer:**
- Andrad: `AuthManager.swift` (stor ändring)
- Andrad: `ContentView.swift` (ta bort biometric case)
- Borttagen: `BiometricPromptView.swift` (om den finns som separat fil)

### Fas 3: APIClient -- Bearer fran Supabase

1. `performRequest()`: hamta `SupabaseManager.shared.client.auth.session?.accessToken`
2. Ta bort `refreshToken()` metoden (SDK refreshar automatiskt)
3. Ta bort `isRefreshing`-flaggan (SDK hanterar concurrent refresh internt)
4. Vid 401: forsok `supabase.auth.refreshSession()` en gang, sedan logout
5. Ta bort Keychain-token-lasning

**Filer:**
- Andrad: `APIClient.swift`

### Fas 4: WKWebView session-delning via PKCE-redirect

**Approach:** Istallet for att manuellt konstruera Supabase-cookies och injicera
dem i WKWebView (fragilt, cookie-format kan andra), använder vi en
server-side PKCE-exchange endpoint.

**Flode:**
1. Native login via Supabase SDK -> far `access_token` + `refresh_token`
2. Skapa server-endpoint `POST /api/auth/native-session-exchange`
   - Tar emot Supabase access_token som Bearer
   - Verifierar token mot Supabase (`supabase.auth.getUser()`)
   - Satter korrekta `@supabase/ssr`-cookies via `setAll()` i HTTP response
   - Returnerar 200 + redirect-URL
3. WKWebView navigerar till endpointen fore sidladdning
4. Cookies satts av servern -> WKWebView ar autentiserad
5. Ta bort `injectSessionCookie()` NextAuth-varianten i AuthManager
6. Uppdatera cookie-observation i WebView.swift

**Fordel:** Servern ager cookie-formatet. Om `@supabase/ssr` andrar
chunking/encoding behover vi inte uppdatera iOS-appen.

**Filer:**
- Ny: `src/app/api/auth/native-session-exchange/route.ts` (server-endpoint)
- Andrad: `AuthManager.swift` (anropa exchange-endpoint after login)
- Andrad: `WebView.swift` (cookie-observation, ta bort NextAuth-specifikt)

### Fas 5: Cleanup -- ta bort MobileToken-kod (iOS)

1. KeychainHelper: ta bort `mobileTokenKey`, `tokenExpiresAtKey`, session-cookie keys
2. BridgeHandler: ta bort `requestMobileToken`, `mobileTokenReceived/Error`, `refreshTokenIfNeeded()`
3. Ta bort bridge-meddelandetyper som inte langre behovs
4. Uppdatera SharedDataManager: `hasValidToken` kollar Supabase session

**Filer:**
- Andrad: `KeychainHelper.swift`
- Andrad: `BridgeHandler.swift`
- Andrad: `SharedDataManager.swift`

### Fas 6: NativeLoginView-uppdatering

1. NativeLoginView skickar credentials till AuthManager (som nu anropar Supabase SDK)
2. Felhantering: Supabase SDK kastar specifika fel (invalid_credentials, email_not_confirmed)
3. Mappa till svenska felmeddelanden

**Filer:**
- Andrad: `NativeLoginView.swift` (felhantering)
- Andrad: `AuthManager.swift` (error mapping)

### Fas 7: Tester

1. Uppdatera AuthManagerTests (mock SupabaseClient)
2. Uppdatera APIClientTests (mock session.accessToken)
3. Testa: login success, login failure (fel lösenord), logout, session expired
4. Testa: WKWebView cookie-injektion
5. Testa: widget-access till token via App Group

**Filer:**
- Andrad: `AuthManagerTests.swift`
- Andrad: `APIClientTests.swift`
- Eventuellt ny: `SupabaseManagerTests.swift`

## Filer att andra

| Fil | Ändring |
|-----|---------|
| `AppConfig.swift` | Lagg till supabaseURL, supabaseAnonKey |
| `AuthManager.swift` | Byt login/logout till Supabase SDK, ta bort biometric |
| `APIClient.swift` | Bearer fran Supabase session, ta bort refreshToken() + isRefreshing |
| `ContentView.swift` | Ta bort biometricPrompt case |
| `WebView.swift` | Cookie-observation, ta bort NextAuth-specifikt |
| `KeychainHelper.swift` | Ta bort MobileToken/session-cookie keys |
| `BridgeHandler.swift` | Ta bort token-relaterade meddelanden |
| `SharedDataManager.swift` | hasValidToken -> Supabase session |
| `NativeLoginView.swift` | Supabase-specifik felhantering |
| `Equinet.xcodeproj` | SPM: supabase-swift |

### Nya filer

| Fil | Syfte |
|-----|-------|
| `SupabaseManager.swift` | Singleton med SupabaseClient |
| `AppGroupKeychainStorage.swift` | Custom AuthLocalStorage for App Group Keychain |
| `src/app/api/auth/native-session-exchange/route.ts` | PKCE-exchange for WKWebView cookies |

## Filer att ta bort (iOS)

- `BiometricPromptView.swift` (om separat fil)
- Ingen annan fil tas bort -- rensning av backend-filer ar S13-2

## Risker

| Risk | Mitigation |
|------|-----------|
| Supabase SDK storlek (SPM) | SDK:t ar modulart, importera bara Auth |
| Exchange-endpoint sakerhet | Verifiera token mot Supabase, rate limit, kort TTL |
| Widget tappar token-access | App Group Keychain-adapter, testa med widget |
| Session expires under offline | SDK buffrar refresh, testa offline-scenario |
| Befintliga MobileToken-anrop | auth-dual.ts hanterar redan Bearer -> Supabase fallback |

## Testplan

### Manuell verifiering (mobile-mcp)

- [ ] Login med korrekt lösenord -> dashboard visas
- [ ] Login med fel lösenord -> felmeddelande
- [ ] Logout -> login-skarm visas
- [ ] App-restart -> fortfarande inloggad (session persistent)
- [ ] WebView-sidor fungerar (cookie-delning)
- [ ] API-anrop fungerar (Bearer access_token)

### Automatiserade tester (XCTest)

- [ ] AuthManagerTests: login/logout/checkExistingAuth
- [ ] APIClientTests: Bearer token fran Supabase session
- [ ] Minst 10 nya/uppdaterade tester

## Acceptanskriterier

- [ ] iOS-appen loggar in via Supabase Swift SDK (inte /api/auth/native-login)
- [ ] APIClient använder Supabase access_token som Bearer
- [ ] WKWebView-sidor ar autentiserade via PKCE-exchange endpoint
- [ ] Biometrisk unlock borttagen
- [ ] MobileToken-kod borttagen fran iOS-sidan
- [ ] Alla befintliga XCTest-sviter passerar
- [ ] Widget kan fortfarande visa data (App Group)
