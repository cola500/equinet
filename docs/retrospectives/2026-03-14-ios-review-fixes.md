---
title: iOS Review Fixes -- retain cycle, origin validation, calendar UX, accessibility
description: Retrospektiv för iOS-fixar efter kodgranskning (session 98)
category: retrospective
status: complete
last_updated: 2026-03-14
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan förbättras
  - Patterns att spara
  - 5 Whys
  - Lärandeeffekt
---

# Retrospektiv: iOS Review Fixes

**Datum:** 2026-03-14
**Scope:** Säkerhets- och UX-fixar i iOS-appen efter kodgranskning + WebView content positioning fix

---

## Resultat

- 8 ändrade filer, 0 nya filer, 0 nya migrationer
- 0 nya tester (fixar i befintlig kod, 48 iOS-tester + 3282 unit-tester gröna)
- Typecheck = 0 errors
- Tid: ~2 sessioner (review-fixar + iteration 2 padding-fix)

## Vad som byggdes

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| iOS/Säkerhet | WebView.swift | WeakScriptMessageHandler (retain cycle fix), origin validation för bridge messages, dismantleUIView cleanup |
| iOS/UX | NativeCalendarView.swift | "Idag"-knapp alltid synlig (opacity-trick), empty state overlay, now-line timer (60s), "Försök igen" ä-fix |
| iOS/Perf | NativeCalendarView.swift, WeekStripView.swift | Static DateFormatters (undviker per-render allokering) |
| iOS/A11y | NativeLoginView.swift | accessibilityIdentifier på email/password-fält |
| iOS/Safety | AuthenticatedView.swift | Force-unwrap `!` -> nil-coalescing `??` (crashsäkerhet) |
| Web/iOS | src/app/layout.tsx | `viewport-fit: cover` statiskt i HTML (env() resolvar korrekt från första rendering) |
| Web/iOS | WebView.swift | CSS padding-top: `calc(env(safe-area-inset-top, 20px) + 1rem)` |
| Web/iOS | InstallPrompt.tsx | Dölj PWA-prompt i nativ iOS-app (`window.isEquinetApp`) |

## Vad gick bra

### 1. Kodgranskning fångade viktig retain cycle
WeakScriptMessageHandler-mönstret är standard i WKWebView-utveckling men lätt att missa. Utan det hålls Coordinator aldrig fri av ARC -- ett minnesläcka som växer med varje WebView-instans.

### 2. viewport-fit=cover-fix var kirurgisk
Genom att lägga till `Viewport`-export i layout.tsx (4 rader) löste vi att `env(safe-area-inset-top)` inte resolvade vid första rendering. Ren separation: Next.js hanterar viewport-meta statiskt, CSS calc() ger rätt padding.

### 3. Static DateFormatters -- enkel perf-vinst
6 DateFormatters skapades per render-cykel. Flytten till `static let` är trivial men sparar allokering på varje swipe/scroll i kalendern.

### 4. Origin-validering är defense-in-depth
Bridge-meddelanden valideras nu mot allowedHosts. Liten insats, stor säkerhetshöjning för WKWebView.

## Vad kan förbättras

### 1. WebView CSS-padding behöver iterering
Första försök (`env(safe-area-inset-top, 1rem)`) visade sig otillräcklig -- krävde en andra session för att fixa. Orsak: viewport-fit=cover injicerades via JS efter CSS, så env() aldrig resolvade.

**Prioritet:** LÅG -- löst nu, men mönstret bör dokumenteras.

### 2. Ingen automatiserad visuell test för iOS
Padding-problem upptäcktes manuellt via screenshots. Det finns ingen CI-pipeline för iOS visuella regressioner.

**Prioritet:** LÅG -- mobile-mcp fungerar bra för manuell verifiering.

## Patterns att spara

### WeakScriptMessageHandler för WKWebView
`WKUserContentController.add(_:name:)` håller STARK referens till handler. Wrappa alltid i en `WeakScriptMessageHandler` med `weak var delegate`. Komplettera med `dismantleUIView` som kör `removeScriptMessageHandler` + `removeAllUserScripts`.

### viewport-fit=cover statiskt i Next.js
Använd `export const viewport: Viewport = { viewportFit: "cover" }` i layout.tsx istället för dynamisk JS-injektion. Ger `env(safe-area-inset-*)` från första rendering. No-op i vanlig webbläsare.

### Static DateFormatter i SwiftUI
DateFormatter är dyrt att skapa. Använd `private static let` på struct-nivå för formatters som återanvänds i `body`. Särskilt viktigt i scroll-tunga vyer (kalender, listor).

## 5 Whys (Root-Cause Analysis)

### Problem: WebView-innehåll för nära statusbar efter första fix
1. Varför? -> `env(safe-area-inset-top)` resolvade till 0 i CSS
2. Varför? -> `viewport-fit=cover` saknades i HTML vid CSS-evalueringstillfället
3. Varför? -> viewport-meta injicerades via JS (`atDocumentEnd`), EFTER att style-elementet lagts till
4. Varför? -> Ursprunglig implementation antog att JS-injektion skulle köra i rätt ordning
5. Varför? -> `atDocumentEnd` garanterar inte att meta-tag är parsad före CSS-evaluering

**Åtgärd:** Flytta viewport-fit=cover till statisk HTML via Next.js `Viewport`-export. Behåll JS som fallback.
**Status:** Implementerad

## Lärandeeffekt

**Nyckelinsikt:** `viewport-fit=cover` måste vara statiskt i HTML -- inte dynamiskt injicerat via JS -- för att `env(safe-area-inset-*)` ska resolvera korrekt vid första CSS-evaluering. I Next.js App Router: använd `export const viewport: Viewport` i layout.tsx.
