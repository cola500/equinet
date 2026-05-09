---
title: "iOS staging walkthrough — 2026-05-09"
description: "S67-7 verifiering: iOS Simulator end-to-end mot equinet-staging.johanlindengard.com efter S67-5 DNS-flytt. Alla native flöden gröna."
category: operations
status: active
last_updated: 2026-05-09
tags: [ios, staging, sprint-67, demo-mode, mobile-mcp, verification]
related:
  - ../sprints/sprint-67-ios-staging-capability.md
  - ../stories/ios-api-cache-policy-hardening.md
  - staging-environment-setup.md
sections:
  - Sammanfattning
  - Setup
  - Walkthrough
  - Bugg upptäckt + fix
  - Resultat per vy
  - Slutsats
---

# iOS staging walkthrough — 2026-05-09

## Sammanfattning

iOS-appen verifierad end-to-end mot staging custom-domain `equinet-staging.johanlindengard.com` efter Sprint 67 DNS-cutover. Alla native flöden (Dashboard, Kalender, Bokningar, Mer, Tjänster) renderar Erik Järnfot demo-data utan SSO-blockering.

**En transient bugg hittades och dokumenterades** (URLSession cachar Vercel CDN 404-svar) — fix landad i `APIClient.swift`, story i `docs/stories/ios-api-cache-policy-hardening.md`.

## Setup

| Aspekt | Värde |
|---|---|
| Simulator | iPhone 17 Pro (iOS 26.4, UDID `98D781B5-A466-40E5-B0A8-226D99EAF6D2`) |
| App-build | xcodebuild Debug + `simctl install` (Xcode 26) |
| Launch arg | `-STAGING` → `AppEnvironment.staging` |
| baseURL | `https://equinet-staging.johanlindengard.com` |
| Supabase | `https://zzdamokfeenencuggjjp.supabase.co` (staging) |
| Login | `erik.jarnfot@demo.equinet.se` / `DemoProvider123!` |
| Verifieringsverktyg | `mobile-mcp` (mobilenext) — interaktion + a11y-tree |

## Walkthrough

| # | Vy | Screenshot | API-endpoint | Status |
|---|---|---|---|---|
| 1 | Native login | (skipped — testanvändare loggade direkt) | Supabase Auth direkt | ✅ Auth lyckades |
| 2 | Dashboard | `01-dashboard.png` | `GET /api/native/dashboard` | ✅ HTTP 200 |
| 3 | Kalender | `02-calendar.png` | `GET /api/native/calendar?from=...&to=...` | ✅ Bokningar renderar |
| 4 | Bokningar | `03-bookings.png` | `GET /api/native/bookings` | ✅ 18 bokningar listade |
| 5 | Mer-flik | `04-more.png` | (UI-rendering) | ✅ 3 menyalternativ (demo_mode=true strippar) |
| 6 | Tjänster | `05-services.png` | `GET /api/native/services` | ✅ 5 demo-tjänster |

Skärmdumpar finns i `docs/operations/screenshots/ios-staging-2026-05-09/`.

## Bugg upptäckt + fix

### Symptom

Första `fetchDashboard()` efter login → HTTP 404 DEPLOYMENT_NOT_FOUND. Curl mot samma URL från terminal → HTTP 401 (förväntat utan auth). Klick "Försök igen" i appen → fortsatt 404.

### Rotorsak (5 Whys)

URLSession cachade Vercel CDN:s 404-svar enligt `cache-control: max-age=N` headers. Bevisat via CFNetwork-logg `cache_hit=true`. Workaround: `simctl uninstall + install` rensade URLSession-cache.

### Fix

Story: `docs/stories/ios-api-cache-policy-hardening.md`

Sätt `request.cachePolicy = .reloadIgnoringLocalCacheData` på alla URLRequest i `APIClient.swift` (3 ställen: `fetchFeatureFlags`, `uploadProfileImage`, `performRequest`).

## Resultat per vy

### Dashboard (`01-dashboard.png`)

- Header: "Lördag 9 Maj"
- Banner: "2 nya förfrågningar väntar"
- Bokning idag 10:30: "Anders Bergman — Omskoning"
- Stats: 1 idag / 7 kommande / 2 nya förfrågningar
- ✅ Matchar sprint-doc demo-data

### Kalender (`02-calendar.png`)

- Datum-picker: "9 maj 2026"
- Veckodagar (MÅN-SÖN), lördag highlightad
- Service-filter chips: "Alla", "Omskoning", "Ungdomsverkning", "Verkning"
- Bokning kl 11-12: "Omskoning - Dante - Anders Bergman"
- ✅ Realistisk demo-kalender

### Bokningar (`03-bookings.png`)

Filter-chips: Alla 18, Förfrågningar 2, Bekräftade 8

Listade bokningar (urval):
- Omskoning 1400 kr — Sara Magnusson — Stella (Stefiansbosund) — 14 maj 2026 — Bekräfta/Avvisa
- Ungdomsverkning 600 kr — Karin Lindqvist — Bella (Gotlandsruss) — 1 maj 2026 — Bekräfta/Avvisa
- Omskoning 1400 kr — Johan Nilsson — Tornado (Travare) — 12 maj 2026 — Manuell — Genomförd/Utebli/Avboka/Anteckna

✅ Demo-data realistisk: blandade statusar, telefonnummer, hästraser.

### Mer-flik (`04-more.png`)

3 menyalternativ:
- Mina tjänster
- Min profil
- Konto: Logga ut

✅ Demo-mode aktivt: sekundära features (Reviews, Stallprofil, etc.) strippade.

### Tjänster (`05-services.png`)

5 tjänster för Erik:
1. Hovslagarbedömning — 800 kr — 30 min — Aktiv
2. Ungdomsverkning — 600 kr — 40 min — Var 6:e vecka — Aktiv
3. Akutbesök — 2500 kr — 1 h — Aktiv
4. Verkning (barfota) — 750 kr — 45 min — Var 6:e vecka — Aktiv
5. Omskoning — 1400 kr — 1 h 15 min — Var 8:e vecka — Aktiv

✅ Matchar sprint-doc Erik Järnfot demo-data.

## Slutsats

**Sprint 67 iOS staging-mål uppnått:**

- ✅ Erik Järnfot demo-flow fungerar end-to-end i iOS Simulator mot custom domain
- ✅ Native API-anrop returnerar 200 (inte 401 SSO-blockerat)
- ✅ Bearer JWT från Supabase Auth accepteras av Next.js auth-handler
- ✅ Demo-mode-stripping fungerar (Mer-flik visar bara 3 alternativ)
- ✅ Erik:s tjänster, bokningar, kunder är synliga och realistiska

**Bonusvärde:**

- ✅ Cache-bug identifierad och fixad innan den spred sig till framtida DNS-flyttar
- ✅ 5 Whys + story-doc + tester planerade

**Vad som inte verifierades (out of scope för Sprint 67):**

- TestFlight-distribution
- iOS Release-build mot prod
- Native DemoLoginButton (web-only idag)
- Profile-vy (skipped, trivial)
- Push-notifikationer (kräver APNs-konfig per miljö)
