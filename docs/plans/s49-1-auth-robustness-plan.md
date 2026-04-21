---
title: "S49-1: Auth-robusthet — JWT-rotation, retry, mock-tester, QA"
description: "Plan för fyra robusthetsförbättringar i iOS auth-flödet"
category: plan
status: done
last_updated: 2026-04-21
---

## Aktualitet verifierad

**Kommandon körda:** Läste AuthManager.swift (rad 207: `SupabaseManager.client.auth.currentSession`), WebView.swift (rad 193: `exchangeSessionForWebCookies`), Supabase SDK `AuthClient.swift` (onAuthStateChange + authStateChanges AsyncStream).
**Resultat:** JWT-rotation-observer saknas. `webCookieExchangeFailed` finns inte. Retry-logik saknas. `tokenProvider` finns inte.
**Beslut:** Fortsätt

## Berörda filer

- `ios/Equinet/Equinet/AuthManager.swift`
- `ios/Equinet/Equinet/WebView.swift`
- `ios/Equinet/EquinetTests/AuthManagerTests.swift`

## Approach

### 1. `tokenProvider` + `cookieStorage` injectables (testbarhet)

`exchangeSessionForWebCookies` läser `SupabaseManager.client.auth.currentSession` direkt → kan inte testas utan riktig Supabase-session.

Fix: Lägg till `tokenProvider: (() -> (accessToken: String, refreshToken: String)?)?` och `cookieStorage: HTTPCookieStorage` som init-parametrar. Default: nil/`.shared`. Tester injicerar fake tokens + ephemeral session storage.

### 2. Retry-logik + `webCookieExchangeFailed`

Idag: om exchange failar loggas det och AuthState förblir `.authenticated`. Användaren ser "Kunde inte ladda"-fel.

Fix: Upp till 2 retries med 1s delay. Efter alla misslyckanden: sätt `webCookieExchangeFailed = true` (observable). WebView kan visa en banner via denna property.

### 3. JWT-rotation-observer i WebView.Coordinator

Supabase roterar access token var ~60 min. WebView läser cookies satta vid login — dessa löper ut utan re-exchange.

Fix: I `makeUIView`, starta en `Task` som itererar `SupabaseManager.client.auth.authStateChanges` (AsyncStream). Vid `.tokenRefreshed`: kalla `exchangeSessionForWebCookies` igen med WebView:ens cookieStore. Spara `Task`-referens för cancel vid WebView-deinit.

### 4. Staging-QA

Manuell verifiering: kör mot staging, kolla AppLogger cookie-count. Dokumenteras i done-filen.

## TDD-ordning

1. RED: 3 nya tester (tokenProvider-makesRequest, retryFails-setsFlag, success-clearsFlag)
2. GREEN: tokenProvider + cookieStorage + retry + webCookieExchangeFailed i AuthManager
3. RED: kompileringstest att WebView.Coordinator har authStateTask
4. GREEN: JWT-rotation-observer i WebView.swift
5. VERIFY: check:all + iOS-tester
