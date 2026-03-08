---
title: "iOS App UX Polish"
description: "UX-förbättringar för iOS-appen baserat på CX/UX-granskning"
category: plan
status: completed
last_updated: 2026-03-08
sections:
  - Kontext
  - Approach
  - Faser
  - Verifiering
---

# Plan: iOS App UX Polish

## Kontext

iOS-appen (WKWebView hybrid) har en fungerande walking skeleton med WebView, native-web bridge, offline-detektion och native-feel (ingen zoom, pull-to-refresh etc). En CX/UX-granskning identifierade flera förbättringsområden -- främst att appen saknar en native identitet vid start och har småfel i laddnings- och offline-flödet.

**Branch:** `feature/stability-optimizations` (fortsätter på befintligt iOS-arbete)

## Approach

Tre faser: branded start-upplevelse, polish av befintliga flöden, och tillgänglighet. Alla ändringar är i iOS-koden (`ios/Equinet/Equinet/`), ingen webappkod behöver ändras.

---

## Faser

### Fas 1: Branded splash + laddning (Kritiskt)

**Mål:** Appen ska kännas native från första sekunden.

**1a. Native branded splash-vy**
- Skapa `SplashView.swift` -- SwiftUI-vy med Equinet-logotyp (SF Symbol eller bild) + brand-bakgrundsfärg
- `ContentView`: visa `SplashView` tills WebView rapporterar `didFinish`
- Mjuk `.opacity`-övergång (0.3s) från splash till WebView
- `@State var webViewReady = false`, sätts i WebView via binding

**1b. Linjär progress-indikator**
- Ersätt `ProgressView()` (liten spinner) med en tunn `ProgressView(.linear)` full bredd under safe area
- Visas bara under laddning, döljs av splash vid första laddning

**1c. Lås till portrait**
- Ta bort landscape-orienteringar från `Info.plist`
- Behåll bara `UIInterfaceOrientationPortrait`

**Filer:**
- `ios/Equinet/Equinet/SplashView.swift` (NY)
- `ios/Equinet/Equinet/ContentView.swift` (ändra)
- `ios/Equinet/Equinet/WebView.swift` (ändra -- ny binding `webViewReady`)
- `ios/Equinet/Info.plist` (ändra)

---

### Fas 2: Flödespolish (Högt prioriterat)

**2a. Pull-to-refresh: avsluta vid didFinish**
- Spara referens till `UIRefreshControl` i Coordinator
- Anropa `endRefreshing()` i `didFinish navigation` istället för hårdkodad 1s delay
- Lägg till timeout-skydd (max 10s)

**2b. "Ansluten igen"-banner (grön)**
- Ny `@State var showReconnectedBanner = false` i ContentView
- När `onStatusChanged` rapporterar online: visa grön banner i 3 sekunder
- Speglar webbappens befintliga `OfflineBanner`-beteende

**2c. Fånga HTTP 5xx-fel**
- Implementera `webView(_:decidePolicyFor navigationResponse:)` i Coordinator
- Kontrollera HTTP-statuskod, vid 5xx -> visa native felvy

**2d. Fixa teckenfel**
- `"den ar igång"` -> `"den är igång"` i ContentView

**2e. Haptic feedback vid pull-to-refresh**
- `UIImpactFeedbackGenerator(style: .medium).impactOccurred()` i `handleRefresh`

**Filer:**
- `ios/Equinet/Equinet/ContentView.swift` (ändra)
- `ios/Equinet/Equinet/WebView.swift` (ändra)

---

### Fas 3: Tillgänglighet + app lifecycle (Nice-to-have)

**3a. VoiceOver på offline-banner**
- `.accessibilityLabel("Ingen internetanslutning")` + `.accessibilityElement(children: .combine)`

**3b. Touch targets**
- `.frame(minHeight: 44)` på "Försök igen"-knappen i felvyn

**3c. Skicka app lifecycle-events via bridge**
- `ScenePhase`-observer i EquinetApp eller ContentView
- Skicka `appDidBecomeActive` / `appDidEnterBackground` till webappen
- Webappen kan använda det för att synka data vid app-aktivering

**Filer:**
- `ios/Equinet/Equinet/ContentView.swift` (ändra)
- `ios/Equinet/Equinet/EquinetApp.swift` (ändra)

---

## Verifiering

### Fas 1
- [ ] Appen visar logotyp + brand-färg vid start
- [ ] Mjuk övergång till login-sida när WebView laddat klart
- [ ] Ingen vit blink vid start
- [ ] Tunn progress-linje vid sidladdning
- [ ] Appen roterar INTE till landscape

### Fas 2
- [ ] Pull-to-refresh spinner slutar snurra när sidan laddat klart
- [ ] Grön "Ansluten igen"-banner visas 3 sek vid online-återkoppling
- [ ] Server 500-fel visar native felvy (testa: stoppa dev-server under navigation)
- [ ] Haptic feedback vid pull-to-refresh
- [ ] Korrekt svenska i feltexter

### Fas 3
- [ ] VoiceOver läser "Ingen internetanslutning" (inte "wifi slash...")
- [ ] "Försök igen"-knappen har minst 44pt höjd
- [ ] Xcode-console loggar app lifecycle-events via bridge
