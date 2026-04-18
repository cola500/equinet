---
title: "S17-9: Koppla iOS-appen till Supabase staging"
description: "Miljöhantering i iOS-appen så den kan peka mot lokal, staging eller produktion"
category: plan
status: wip
last_updated: 2026-04-05
sections:
  - Bakgrund
  - Nuläge
  - Approach
  - Implementation
  - Verifiering
  - Risker
---

# S17-9: Koppla iOS-appen till Supabase staging

## Bakgrund

iOS-appen behöver kunna peka mot Supabase staging-projektet (`zzdamokfeenencuggjjp`) för att testa auth, RLS och hela flödet mot riktig Supabase-instans.

## Nuläge

- `AppConfig.swift` har redan staging Supabase URL + anon key hardkodade
- **Inkonsistens:** DEBUG pekar web mot `localhost:3000` men Supabase SDK mot remote staging
- S17-7 bytte lokal dev till `supabase start` (lokal Supabase på port 54321)
- Resultat: iOS SDK auth mot remote staging, men web-servern pratar med lokal Supabase = tokens matchar inte

## Approach

Skapa ett `AppEnvironment`-enum med tre miljöer:

| Miljö | Web baseURL | Supabase | När |
|-------|------------|----------|-----|
| local | localhost:3000 | localhost:54321 (supabase start) | DEBUG (default) |
| staging | equinet-app.vercel.app | zzdamokfeenencuggjjp.supabase.co | DEBUG + launch arg `-STAGING` |
| production | equinet-app.vercel.app | zzdamokfeenencuggjjp.supabase.co* | RELEASE |

*) Staging och production delar Supabase-projekt tills vi har separat prod-projekt.

**Miljöbyte:** Xcode launch argument `-STAGING` i schemat. Inga pbxproj-ändringar (minimerar risk).

## Implementation

### Fas 1: AppEnvironment + AppConfig refactor

**Filer som ändras:**
- `ios/Equinet/Equinet/AppConfig.swift` -- ny miljöhantering

**Steg:**
1. Skapa `AppEnvironment` enum med `local`, `staging`, `production`
2. Varje case returnerar `baseURL`, `supabaseURL`, `supabaseAnonKey`
3. DEBUG: kolla `ProcessInfo.processInfo.arguments.contains("-STAGING")` -> staging, annars local
4. RELEASE: production
5. Lokal Supabase: URL `http://127.0.0.1:54321`, anon key från `supabase status`

### Fas 2: Anpassa lokala Supabase-credentials

**Steg:**
1. Kör `supabase status` för att hämta lokal anon key
2. Konfigurera local-miljön med rätt URL och key

### Fas 3: Tester

**Steg:**
1. Uppdatera `AuthManagerTests` om de refererar till AppConfig
2. Verifiera att befintliga tester fortfarande passerar

### Fas 4: Verifiering mot Simulator

**Steg:**
1. Bygg med staging-miljö, verifiera login mot Supabase staging
2. Verifiera session exchange (native -> WebView cookies)
3. Verifiera native skärmar: dashboard, bokningar

### Fas 5: Dokumentation

**Steg:**
1. Kommentera i AppConfig hur man byter miljö
2. Uppdatera iOS-sektion i README om det behövs

## Verifiering

- [ ] `xcodebuild test -only-testing:EquinetTests/AuthManagerTests` gröna
- [ ] Staging login fungerar (om test-konto finns)
- [ ] Local environment konsistent (iOS SDK + web server mot samma Supabase)

## Risker

- **Lokal anon key kan ändras** vid `supabase db reset`: Hanteras genom att dokumentera att man kör `supabase status` efter reset
- **pbxproj-ändringar**: Undviks helt -- vi använder launch argument istället för ny build configuration
