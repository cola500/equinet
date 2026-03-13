---
title: "Retrospektiv: iOS WebView debug-session"
description: "5 Whys debugging av WebView-flikar som inte laddade data, plus splash-fix"
category: retrospective
status: current
last_updated: "2026-03-12"
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan forbattras
  - Patterns att spara
  - 5 Whys
  - Larandeeffekt
---

# Retrospektiv: iOS WebView debug-session

**Datum:** 2026-03-12
**Scope:** Debugging av varfor Oversikt- och Bokningar-flikarna i iOS-appen visade skeleton/loading-state utan data, trots att Kalendern (native) fungerade.

---

## Resultat

- 2 andrade filer (WebView.swift, AuthenticatedView.swift), 1 tillagd+borttagen debug-case (BridgeHandler.swift)
- 0 nya tester (ren debug-session)
- Splash-fix: visas nu bara 0.5s vid inloggning, inte vid flikbyte
- Tid: ~1 session

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| iOS UI | AuthenticatedView.swift | Splash visas bara vid inloggning (0.5s timer), inte per WebView-flik |
| iOS WebView | WebView.swift | Temporar debug-loggning (tillagd + borttagen) |
| iOS Bridge | BridgeHandler.swift | Temporar debug-case (tillagd + borttagen) |

## Vad gick bra

### 1. 5 Whys-metoden ledde rakt till rotorsaken
Systematisk analys istallet for att gissa. Varje "varfor?" smalnade ner mojligheterna tills debug-loggning avslojade exakt vad som var fel.

### 2. JS-injektion fran Swift for debugging
Att injicera `fetch('/api/auth/session')` via `evaluateJavaScript` och skicka resultatet genom bridge-protokollet gav exakt den data som behovdes -- session-objektet med `userType: "customer"`.

### 3. Snabb iteration med debug-loggning
Tre iterationer av debug-loggning (page state -> cookie check -> session fetch) ledde till svaret pa ~20 minuter.

## Vad kan forbattras

### 1. iOS-appen borde validera userType vid inloggning
Appen visar provider-UI (TabView med Oversikt/Kalender/Bokningar/Mer) oavsett om anvandaren ar provider eller customer. En customer som loggar in ser skeleton forever pa alla WebView-flikar.

**Prioritet:** HOG -- drabbar varje customer som loggar in i appen.

### 2. Splash-logiken var kopplad till WebView-laddning
Splash blocerade More-fliken (native) nar dashboard-WebView inte hade laddats an. Splash borde vara en enkel overgangseffekt vid inloggning, inte beroende av WebView-status.

**Prioritet:** MEDEL -- fixad i denna session.

### 3. Ingen synlig felindikering vid fel userType
Nar en customer loggar in och ser provider-UI, finns ingen feedback om att nagot ar fel. Borde visa ett tydligt meddelande eller redirecta.

**Prioritet:** HOG -- UX-forbattring.

## Patterns att spara

### JS-injektion for WKWebView-debugging
Nar WKWebView-sidor inte fungerar som forvantat, injicera JavaScript via `evaluateJavaScript` som:
1. Gor `fetch()` till relevanta API-endpoints
2. Skickar resultatet via bridge (`window.webkit.messageHandlers.equinet.postMessage`)
3. Loggar i Swift via `AppLogger`

Detta undviker behovet av Safari Web Inspector och fungerar pa fysiska enheter.

### Session-cookie vs Mobile JWT -- tva separata auth-varldar
- **Native APIClient**: Anvander mobile JWT (Bearer token) -- oberoende av session-cookie
- **WebView-sidor**: Anvander session-cookie via NextAuth `useSession()` -- oberoende av JWT
- En kan fungera medan den andra failar. Debug genom att testa BADA.

## 5 Whys (Root-Cause Analysis)

### Problem: WebView-flikar (Oversikt, Bokningar) visar bara skeleton, ingen data
1. **Varfor visas skeleton?** `useAuth()` returnerar `isProvider: false`, sidan gar aldrig forbi loading-guarden.
2. **Varfor ar isProvider false?** `useSession()` returnerar `userType: "customer"` fran session-cookien.
3. **Varfor ar userType customer?** Anvandaren loggade in med kundkontot "Test Kund" istallet for ett provider-konto.
4. **Varfor fungerade kalendern anda?** Kalendern ar native och anvander `APIClient` med mobile JWT -- helt separat auth-flode som inte kontrollerar `userType` fran session.
5. **Varfor tillater appen att en customer loggar in i provider-UI?** Det finns ingen userType-validering vid inloggning. Appen visar alltid provider-TabView oavsett vem som loggar in.

**Atgard:** Lagg till userType-check efter inloggning -- visa CustomerWebView for customers, AuthenticatedView (provider-TabView) for providers. Alternativt: visa felmeddelande om en customer forsoker logga in i provider-appen.
**Status:** Att gora

### Problem: Splash-skarm blockerade More-fliken
1. **Varfor visades splash pa More-fliken?** Splash-villkoret var `!initialLoadComplete && selectedTab != .calendar` -- More-fliken ar inte calendar.
2. **Varfor var initialLoadComplete false?** Den satts bara av dashboard-WebView:s `onFirstLoad`, som inte hade avfyrats an.
3. **Varfor hade dashboard inte laddats?** SwiftUI TabView lazy-laddar flikar -- dashboard-WebView skapas inte forran anvandaren byter till den.
4. **Varfor ar splash kopplad till WebView-laddning?** Designen utgick fran att WebView var default-fliken, men efter native-first rebuild ar Kalender (native) default.
5. **Varfor uppdaterades inte splash-logiken?** Forandringen av default-flik (fran WebView till native) gjordes utan att uppdatera splash-beroendena.

**Atgard:** Splash ar nu en 0.5s branded overgang vid inloggning, oberoende av WebView-status.
**Status:** Implementerad

## Larandeeffekt

**Nyckelinsikt:** Nar en hybrid-app har tva separata auth-system (native JWT + WebView session-cookie), kan en fungera perfekt medan den andra ar trasig. Debug alltid BADA. Och viktigast: nar "data inte laddas" -- kolla forst VEM som ar inloggad, inte bara OM nagon ar inloggad.
