---
title: "S49-0: Säkerhetspolish — cookie-rensning, domänfilter, refresh-header"
description: "Plan för tre defense-in-depth-förbättringar i iOS auth-flödet"
category: plan
status: done
last_updated: 2026-04-21
---

## Aktualitet verifierad

**Kommandon körda:** Läste AuthManager.swift rad 192-237 (exchangeSessionForWebCookies), rad 153-186 (logout), route.ts.
**Resultat:** Problemen finns kvar — refreshToken skickas i body (rad 209), ingen domain-filter, ingen explicit cookie-rensning i logout.
**Beslut:** Fortsätt

## Berörda filer

- `ios/Equinet/Equinet/AuthManager.swift`
- `ios/Equinet/EquinetTests/AuthManagerTests.swift`
- `src/app/api/auth/native-session-exchange/route.ts`
- `src/app/api/auth/native-session-exchange/route.test.ts`

## Approach

### 1. Explicit cookie-rensning i logout()

`logout()` förlitade sig på Supabase `signOut` + `cookiesDidChange`-observer. Risk: ofullständig rensning vid edge-cases.

Fix: Lägg till valfri `cookieStore: WKHTTPCookieStore?` parameter (default: `WKWebsiteDataStore.default().httpCookieStore`). Fire-and-forget Task raderar alla cookies.

### 2. Domän-filter i exchangeSessionForWebCookies

Cookies från `HTTPCookieStorage.shared` filtrerades inte — alla cookies för URL-svaret injicerades.

Fix: Ny intern `filterCookies(_:for:)` metod. Behåller bara cookies där `cookie.domain == host` eller `.hasSuffix(".host")`.

### 3. Refresh token i X-Refresh-Token header

Refresh token skickades i request body — kan loggas av framtida middleware/proxies.

Fix: Ny intern `buildExchangeRequest(accessToken:refreshToken:baseURL:)` metod sätter `X-Refresh-Token` header. Backend läser från header med `request.headers.get("X-Refresh-Token")`. Body-parsing för refreshToken tas bort.

## TDD-ordning

1. RED backend: Byt body-test till header-test → 1 fail
2. GREEN backend: Läs från header i route.ts → 8/8
3. RED iOS: Lägg till 6 nya tester (buildExchangeRequest, filterCookies, logout cookie-rensning) → compile errors
4. GREEN iOS: Implementera de tre metoderna → 19/19
5. VERIFY: `check:all` 4/4
