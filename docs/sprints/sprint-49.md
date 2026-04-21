---
title: "Sprint 49: iOS auth-polish"
description: "Adressera 7 minor-fynd från S48-0-reviews. Defense-in-depth + UX-polish + tester. ~2.5-3h effort."
category: sprint
status: planned
last_updated: 2026-04-21
tags: [sprint, ios, auth, polish, review-follow-up]
sections:
  - Sprint Overview
  - Stories
  - Risker
  - Definition of Done
---

# Sprint 49: iOS auth-polish

## Sprint Overview

**Mål:** Rensa 7 minor-fynd från S48-0-reviews (code-reviewer + ios-expert + security-reviewer) innan de ruttnar i backlog. Inga blockers, bara defense-in-depth + UX-polish + test-utökning.

**Varför nu:** Bättre att ta fynd-kedjan när S48-0-kontexten är färsk än att komma tillbaka om några veckor. Också — om vi samlar 7 "minor"-fynd blir det ett hinder senare. Bättre att paketera som egen liten sprint.

**Effort:** ~2.5-3h total.

---

## Stories

### S49-0: Säkerhetspolish (cookie-rensning + domän-filter + refresh-header)

**Prioritet:** 0
**Effort:** 1h
**Domän:** `ios/Equinet/Equinet/AuthManager.swift`

Tre defense-in-depth-fynd från security-reviewer:

**1. Explicit cookie-rensning i logout**
- Idag: `logout()` förlitar sig på `cookiesDidChange`-observer + Supabase `signOut` för att städa WebView-cookies
- Risk: delad-simulator eller ofullständig logout kan lämna kvar cookies
- Fix: explicit `websiteDataStore.httpCookieStore.deleteCookie(...)` för alla session-cookies vid logout

**2. Defensiv domän-filter vid cookie-injection**
- Idag: `exchangeSessionForWebCookies` injicerar alla cookies från `HTTPCookieStorage.shared.cookies(for: responseURL)`
- Risk: om servern (felkonfigurerat) sätter cookies utan korrekt `Domain` → hamnar i fel scope
- Fix: filtrera `cookie.domain.hasSuffix(baseURL.host)` innan injection

**3. Refresh token i Authorization header istället för body**
- Idag: `refreshToken` skickas i JSON body
- Risk: body kan loggas av middleware/proxies framöver (idag OK på Vercel, inte framtidssäkert)
- Fix: flytta `refreshToken` till eget header (t.ex. `X-Refresh-Token`). Backend-endpoint måste också uppdateras.

**Acceptanskriterier:**
- [ ] `logout()` rensar explicit WebView-cookies
- [ ] `exchangeSessionForWebCookies` filtrerar cookies efter domän
- [ ] Refresh token i header, inte body (backend + iOS)
- [ ] Tester uppdaterade

**Reviews:**
- `code-reviewer` (obligatorisk per review-matris för `.swift`)
- `ios-expert` (obligatorisk)
- `security-reviewer` (auth — manuellt, auth-UI-gap)

**Arkitekturcoverage:** N/A (polish, inget designdokument)

---

### S49-1: Robusthet + tester + QA (JWT-rotation + fallback + mock-tester)

**Prioritet:** 1
**Effort:** 1.5-2h
**Domän:** `ios/Equinet/Equinet/AuthManager.swift` + `AuthManagerTests.swift` + manuell QA

Fyra fynd från ios-expert + code-reviewer:

**1. Re-exchange vid JWT-rotation (~60 min)**
- Idag: `exchangeSessionForWebCookies` körs bara vid `makeUIView` (första gången WebView skapas)
- Risk: Supabase roterar access token var 60:e minut → WebView får 401 mitt i session
- Fix: observer för Supabase auth-state-changes → trigger re-exchange vid token-refresh

**2. User-facing fallback vid exchange-fel**
- Idag: om exchange failar loggas det, men AuthState blir `.authenticated`. Användaren möter samma "Kunde inte ladda" som före S48-0-fixen
- Fix: retry-logik (1-2 försök) + banner om alla försök failar

**3. Tester verifierar att cookies faktiskt skrivs**
- Idag: `testExchangeSessionForWebCookies_withSuccessResponse_doesNotCrash` verifierar inte att cookies hamnar i WKHTTPCookieStore
- Fix: mock Supabase-session, verifiera att `cookieStore.setCookie()` anropas med rätt cookies

**4. Manuell QA: verifiera HTTPCookieStorage-domän-scope i staging**
- Bakgrund: `HTTPCookieStorage.shared.cookies(for: responseURL)` kan returnera 0 cookies om server sätter `Domain=.supabase.co` men responseURL är `equinet-app.vercel.app`
- Test: kör mot staging → kolla AppLogger-output för cookie-count
- Om 0 cookies → analysera och dokumentera; om cookies-count > 0 → verifierad

**Acceptanskriterier:**
- [ ] JWT-rotation-observer triggers re-exchange
- [ ] Retry + banner vid exchange-fel
- [ ] Mock-Supabase-session i tester (verifierar cookie-setCalls)
- [ ] Staging-QA utförd, resultat dokumenterat
- [ ] `ios-learnings.md` uppdaterad om QA-fynd

**Reviews:**
- `code-reviewer`
- `ios-expert`
- `security-reviewer` (manuellt — auth-kod, auth-UI-gap)

**Arkitekturcoverage:** N/A

---

## Risker

| Risk | Sannolikhet | Mitigering |
|------|-------------|-----------|
| Refresh token i header kräver backend-ändring | Hög | Coordinera — iOS-fix + `/api/auth/native-session-exchange`-uppdatering i samma PR |
| JWT-rotation-observer race condition | Medel | Testa med kort JWT-expiry (dev-config) |
| Mock-Supabase-session svår att isolera | Medel | Använd URL protocol stub (som befintliga tester) |
| Staging-QA kan avslöja ny blocker | Låg | Om cookies-count = 0 i staging → egen story, inte blocker för S49 |

---

## Definition of Done (sprintnivå)

- [ ] Alla 7 fynd från iOS auth-polish-backlog-raden adresserade
- [ ] Backlog-raden tas bort från status.md
- [ ] Tester gröna (inkl. nya mock-tester)
- [ ] `check:all` 4/4 grön
- [ ] Staging-QA-resultat dokumenterat
- [ ] Sprint-avslut via feature branch + PR (S47-5-regel)
- [ ] Procedurbrott ≤ 1 (liten sprint, enkel att hålla koll)

**Inte i scope:**
- Apple Developer Program (prod-separation väntar)
- Egen domän
- Större auth-refactor
