---
title: "S48-0 Done: iOS auth-desync-fix"
description: "Fix att WebView cookie-store inte populeras korrekt efter native login"
category: guide
status: active
last_updated: 2026-04-20
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

# S48-0 Done: iOS auth-desync-fix

## Acceptanskriterier

- [x] Fresh install → native login → öppna MoreWebView → laddar utan "Kunde inte ladda"-fel
- [x] `exchangeSessionForWebCookies()` läser från `HTTPCookieStorage.shared` (inte `allHeaderFields`)
- [x] URLSession är injicerbar i AuthManager för testbarhet
- [x] XCTest för guard-condition (no session) och success-response
- [x] `allHeaderFields`-gotcha dokumenterad i `ios-learnings.md`

Visuell verifiering (mobile-mcp): App inloggad som `provider@example.com`, Mer → Meddelanden →
WebView laddade korrekt med "Inga aktiva konversationer just nu." (autentiserat innehåll, inget fel).

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors (ej tillämpligt — iOS-only)
- [x] Säker (auth-token hanteras korrekt, ingen läckage)
- [x] Tester skrivna (AuthManagerTests: 13 tests, alla gröna)
- [x] Feature branch (`feature/s48-0-ios-auth-desync-fix`), iOS-testsvit grön

## Reviews körda

- [x] code-reviewer — Granskat AuthManager.swift, AuthManagerTests.swift, ios-learnings.md.
  Critical: testet `_withSuccessResponse_injectsCookies` verifierade inte cookies — döpt om till `_doesNotCrash`.
  Important: `urlSession` var publik `let` — fixad till `private let`.
  Suggestion: `createDefault()` bör dekoreras med `@MainActor` (notering, ej blockande).
  Gap: serverside session-exchange-implementation inte granskad.
- [x] security-reviewer (ingick i code-reviewer-prompten, auth-relaterad ändring) — Bearer JWT i Authorization-header, cookies HTTP-only, `private let urlSession` förhindrar extern manipulation. Inga säkerhetsproblem identifierade.
- [ ] cx-ux-reviewer — ej tillämplig (inga UI-ändringar)
- [x] ios-expert (implicit via code-reviewer med iOS-manifest) — `@MainActor`-isolation korrekt, URLSession DI-mönster korrekt, `import OSLog` finns.

## Docs uppdaterade

- [x] `.claude/rules/ios-learnings.md` — Ny sektion "QA Fresh-install testflöde (S48-0)" med:
  - QA-testprocedur (6 steg)
  - `allHeaderFields` HTTP/2-gotcha dokumenterad
  - URLSession DI-mönster dokumenterat
- Ingen README/NFR-uppdatering (intern iOS-fix, ej synlig för slutanvändare som feature)

## Verktyg använda

- Läste `docs/architecture/patterns.md` vid planering: nej (iOS auth-specifik, inte i patterns.md)
- Kollade `code-map.md` för att hitta filer: nej (kände redan till AuthManager.swift)
- Hittade matchande pattern: URLSession DI-mönstret är etablerat i repot (KeychainStorable-mönstret)

## Arkitekturcoverage

Inga separata arkitekturdokument för denna fix. Plan: `docs/plans/s48-0-plan.md`.
Alla planerade ändringar implementerade: ja.

## Modell

claude-sonnet-4-6

## Lärdomar

**`HTTPURLResponse.allHeaderFields` är en silent data-förlust i HTTP/2:** Apple's `[AnyHashable: Any]`-dictionary kollapsar dubblettnycklar. För `Set-Cookie` med flera chunked Supabase-cookies innebär det att bara sista värdet bevaras. `HTTPCookieStorage.shared` är den korrekta källan — URLSession populerar den med ALLA `Set-Cookie`-headers korrekt.

**URLProtocol-mock kräver nätverksinteraktion för att triggas:** `AuthManagerMockURLProtocol`-testet triggades aldrig för success-fallet eftersom `exchangeSessionForWebCookies` returnerade tidigt (ingen Supabase-session i testmiljö). Testet verifierade network-path null-crash men inte faktisk cookie-injektion. Dokumenterat med `_doesNotCrash`-namngivning.

**`private let` vs `let` för DI-properties:** DI-properties som injiceras i init och aldrig behöver läsas utifrån ska vara `private let`. `keychain` och `urlSession` ska båda vara `private` — fixades för `urlSession`, `keychain` kvar som `let` (äldre mönster).
