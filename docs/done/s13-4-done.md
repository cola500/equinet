---
title: "S13-4 Done: iOS Supabase Swift SDK"
description: "iOS-appen autentiserar via Supabase Swift SDK istallet for custom MobileTokenService"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lardomar
---

# S13-4 Done: iOS Supabase Swift SDK

## Acceptanskriterier

- [x] iOS-appen loggar in via Supabase Swift SDK (inte /api/auth/native-login)
- [x] APIClient använder Supabase access_token som Bearer
- [x] WKWebView-sidor autentiseras via PKCE-exchange endpoint
- [x] Biometrisk unlock borttagen
- [x] MobileToken-kod borttagen fran iOS-sidan
- [x] Alla befintliga XCTest-sviter passerar (16 tester, 0 failures)
- [x] Widget kan fortfarande visa data (App Group Keychain via SDK)

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (Bearer token verifierad, rate limiting, svenska felmeddelanden)
- [x] Tester skrivna: 6 webb (exchange endpoint) + 16 iOS (AuthManager + APIClient)
- [x] Feature branch, alla tester grona

## Reviews

- Kordes: code-reviewer (inbyggt i implement-flode)
- security-reviewer: manuell security-check pa exchange endpoint (auth, rate limit, logging OK)
- cx-ux-reviewer: ej relevant (ingen UI-ändring, login-vyn oforandrad)
- tech-architect: plan granskad av tech lead fore implementation

## Avvikelser fran plan

1. **AppGroupKeychainStorage inte skapad** -- Supabase SDK:ts inbyggda
   `KeychainLocalStorage(accessGroup:)` stodjer App Group direkt, ingen custom
   adapter behovdes.
2. **Fas 6 (NativeLoginView) krävde ingen ändring** -- Vyn delegerar redan till
   AuthManager.login() som nu har Supabase-felhantering.
3. **BiometricPromptView borttagen helt** -- Planen sa "om separat fil",
   den var separat och togs bort.
4. **SharedDataManager.hasValidToken borttagen** -- Ingen anropade den.
   Att lagga till Supabase-import i SharedDataManager hade brutit widget-target.
5. **APIClient.testAccessToken** -- Lagt till #if DEBUG test-override for att
   undvika att behova riktig Supabase-session i XCTests.

## Lardomar

- **Supabase Swift SDK KeychainLocalStorage** har inbyggt App Group-stod via
  `accessGroup`-parameter. Dokumentationen ar inte tydlig om detta, men det
  fungerar. Sparar arbete med custom adapters.
- **PBXFileSystemSynchronizedRootGroup** i Xcode-projekt auto-upptacker nya
  .swift-filer, sa SupabaseManager.swift behövde inte laggas till manuellt i
  pbxproj Sources.
- **Widget extension och Supabase SDK**: SharedDataManager delas med widget via
  membershipExceptions. Lagg ALDRIG till Supabase-import i filer som delas med
  widget-target -- widgeten har inte SPM-beroendet.
- **AuthState.biometricPrompt borttagen**: Nar Supabase SDK hanterar session-
  persistence behovs inte biometric unlock for att "lasa upp" cached tokens.
  SDK:t refreshar automatiskt.
