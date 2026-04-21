---
title: "S49-0 done: Säkerhetspolish (cookie-rensning, domänfilter, refresh-header)"
description: "Tre defense-in-depth-förbättringar i iOS auth implementerade"
category: done
status: done
last_updated: 2026-04-21
---

## Acceptanskriterier

- [x] `logout()` rensar explicit WebView-cookies — via fire-and-forget Task med injicerbar `WKHTTPCookieStore`
- [x] `exchangeSessionForWebCookies` filtrerar cookies efter domän — `filterCookies(_:for:)` behåller bara cookies för host eller subdomäner
- [x] Refresh token i header, inte body — `X-Refresh-Token` header i iOS + backend läser från header
- [x] Tester uppdaterade — 6 nya iOS-tester + 2 uppdaterade backend-tester

## Definition of Done

- [x] Inga TypeScript-fel, inga console errors
- [x] Säker (Zod, error handling, ingen XSS/injection)
- [x] Tester skrivna FÖRST, coverage >= 70%
- [x] `check:all` 4/4 grön
- [x] iOS AuthManagerTests 19/19 gröna

## Reviews körda

- [x] security-reviewer — Important: filterCookies tredje condition logiskt inverterad (fixad). Important: kommentar tillagd för medveten state-sekvens i logout. Suggestions: setSession-felhantering, bakåtkompatibilitet (dokumenterad som breaking change).
- [x] code-reviewer — ingår i security-reviewer (kombinerad granskning).
- [x] ios-expert — BLOCKER: default-parameter `WKWebsiteDataStore.default().httpCookieStore` bör resolve inuti funktionskroppen (fixad → `nil` default + `let resolvedCookieStore`). MAJOR: filterCookies kan förstärkas med `sb-`-prefix (noterat, skippad — over-engineering för sprint-scope). Minor: Task.sleep i test, URL-assert i DEBUG.

## Docs uppdaterade

Ingen användarvänd ändring — intern säkerhetsförstärkning. Ingen hjälpartikel behövs.

## Docs uppdaterade

Ingen användarvänd ändring — intern säkerhetsförstärkning. Ingen hjälpartikel behövs. Inga ops-procedurer påverkade.

## Verktyg använda

- Läste patterns.md vid planering: ja
- Kollade code-map.md: ja (auth-domän → route.ts)
- Hittade matchande pattern: "URL stub-setup + header-check" (befintlig MockURLProtocol i AuthManagerTests)

## Arkitekturcoverage

Designdokument: N/A (polish, inget designdokument)

## Modell

sonnet

## Lärdomar

- `WKHTTPCookieStore` är inte mockerbar — `WKWebsiteDataStore.nonPersistent().httpCookieStore` är rätt teststrategi
- Extrahera `buildExchangeRequest` och `filterCookies` som interna metoder gör dem testbara utan att ändra public API
- Fire-and-forget cookie-rensning i logout kräver `Task.sleep` i tester — acceptabelt för operationer utan returvärde
- Default parameter `WKWebsiteDataStore.default().httpCookieStore` evalueras vid call-site i Swift (fungerar som förväntat)
