---
title: "S49-1: Auth-robusthet — done"
description: "Done-fil för S49-1: JWT-rotation, retry, mock-tester"
category: plan
status: done
last_updated: 2026-04-21
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Docs uppdaterade
  - Verktyg använda
  - Arkitekturcoverage
  - Modell
  - Lärdomar
---

## Acceptanskriterier

- [x] **JWT-rotation-observer**: `WebView.Coordinator` lyssnar på `SupabaseManager.client.auth.authStateChanges`. Vid `.tokenRefreshed` anropas `exchangeSessionForWebCookies` igen med WebView:ens cookieStore. `authStateTask` sparas och cancellas vid deinit.
- [x] **Retry-logik**: `exchangeSessionForWebCookies` försöker upp till 3 gånger (initial + 2 retries) med konfigurerbar `retryDelay` (default 1s, 0 i tester).
- [x] **`webCookieExchangeFailed`-flagga**: Sätts `true` efter alla försök misslyckas, `false` vid success. Observable via `@Observable`-makrot.
- [x] **`tokenProvider` injectable**: Kringgår `SupabaseManager.client.auth.currentSession` i tester.
- [x] **`cookieStorage` injectable**: Kringgår `HTTPCookieStorage.shared` i tester.
- [x] **Tester**: 4 nya tester verifierar nätverksanrop, retry-count, flaggsättning, och true→false-transition. 23/23 AuthManagerTests gröna.
- [x] **`@MainActor` på observer**: `startAuthStateObserver` och dess Task är `@MainActor` för säker åtkomst till WKWebView-properties.

## Definition of Done

- [x] Inga TypeScript/Swift-kompileringsfel
- [x] Säker (error handling, inga nya säkerhetsrisker)
- [x] Tester skrivna FÖRST (TDD RED→GREEN verifierat), coverage ≥70%
- [x] `check:all` inte tillämplig (ren iOS-story) — iOS-tester 23/23 gröna

## Reviews körda

- [x] code-reviewer — Hittat: `break` → `continue` i observer (loop dör vid nil), TODO-kommentar på `webCookieExchangeFailed`, saknat true→false-test. Alla fixade.
- [x] ios-expert — Hittat: `@MainActor` saknas på `startAuthStateObserver` och dess Task (WKWebView-åtkomst ej main-thread-säker). Fixat.
- [ ] security-reviewer — ej tillämplig (inga nya API-endpoints, inga autentiseringsändringar — bara retry-logik och intern observability)
- [ ] cx-ux-reviewer — ej tillämplig (inga UI-ändringar)

## Docs uppdaterade

Ingen docs-uppdatering (intern auth-robusthet, ingen användarvänd ändring i denna story. `webCookieExchangeFailed` har TODO-kommentar för framtida UI-surface).

## Verktyg använda

- Läste patterns.md vid planering: ja
- Kollade code-map.md för att hitta filer: nej (kände redan till filerna)
- Hittade matchande pattern? nej (ny iOS-specifik logik)

## Arkitekturcoverage

Designdokument: `docs/plans/s49-1-auth-robustness-plan.md`

Alla numrerade beslut implementerade:
- D1 (tokenProvider injectable): [x] implementerat
- D2 (cookieStorage injectable): [x] implementerat
- D3 (webCookieExchangeFailed observable): [x] implementerat
- D4 (retry-logik, 2 retries, 1s delay): [x] implementerat
- D5 (JWT-rotation-observer i WebView.Coordinator): [x] implementerat

## Modell

sonnet

## Lärdomar

- `@MainActor`-annotation på `Task {}` i Coordinator-metoder är nödvändig när tasken berör WKWebView-properties — iOS-expert review fångade detta omedelbart.
- `break` vs `continue` i AsyncStream-loopar: `break` vid nil weak ref dödar loopen permanent, `continue` överlever vy-rekonstruktioner. Viktigt mönster för Supabase SDK's authStateChanges.
- `retryDelay: 0` som injectable testparameter undviker all `Task.sleep`-overhead utan att kompromissa med logiken — elegant och enkelt.
- `defer { AppLogger.auth.warning(...) }` i AsyncStream-Task fångar oväntad stream-terminering utan extra kod.
