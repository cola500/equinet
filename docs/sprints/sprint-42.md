---
title: "Sprint 42: E2E-genomkörning + visuell baseline"
description: "Kör alla webb-E2E-tiers med traces/screenshots + mobile-mcp-audit av iOS native-flöden. Ingen kodändring — state-of-the-union-sprint."
category: sprint
status: planned
last_updated: 2026-04-19
tags: [sprint, e2e, visual-verification, ios, mobile-mcp, playwright]
sections:
  - Sprint Overview
  - Stories
  - Exekveringsplan
  - Definition of Done
---

# Sprint 42: E2E-genomkörning + visuell baseline

## Sprint Overview

**Mål:** Visuell baseline för alla E2E-tiers på webb (smoke/critical/external/full) + native-flöde-audit på iOS via mobile-mcp. Dokumenterade artefakter (HTML-rapporter, screenshots) så vi vet exakt var vi står inför lansering.

**Bakgrund:** 34 Playwright-specs (373 pass / 77 skip / 0 fail senast) körs i CI men har ingen visuell rapport vi kan peka på. iOS har 223 XCTest unit-tester men **noll** E2E-täckning — bara ad-hoc mobile-mcp-audits (S38-0). Johan vill se visuella artefakter av båda plattformarna innan vi går vidare.

**Val:** Hybrid C — mobile-mcp-audit nu som visuell baseline, XCUITest-bootstrap skjuts till egen sprint när vi vet vad som behöver täckas.

**Scope-avgränsning:** Ingen kodändring. Inga fixar av flakes — de noteras i retro. Om en tier failar: rapportera, men fixa INTE i denna sprint (risk för scope-creep).

---

## Stories

### S42-0: Webb E2E smoke-tier (visuell verifiering)

**Prioritet:** 0
**Effort:** 20-30 min
**Domän:** e2e (`e2e/exploratory-baseline.spec.ts` + `e2e/auth.spec.ts`)

Kör smoke-tiern med Playwright trace + HTML-reporter. Producera visuell artefakt.

**Implementation:**

```bash
# Förberedelse
npm run db:up
npm run setup

# Kör med trace + HTML-rapport
npm run test:e2e:smoke -- --trace on --reporter=html

# Flytta rapport till metrics-katalog
mkdir -p docs/metrics/e2e-visual/2026-04-19/smoke
cp -r playwright-report/ docs/metrics/e2e-visual/2026-04-19/smoke/report
cp -r test-results/ docs/metrics/e2e-visual/2026-04-19/smoke/traces
```

**Acceptanskriterier:**
- [ ] `test:e2e:smoke` körd, resultat dokumenterat (pass/skip/fail)
- [ ] HTML-rapport finns i `docs/metrics/e2e-visual/2026-04-19/smoke/report/`
- [ ] Traces sparade (klickbart tidsspår med screenshots per steg)
- [ ] Kort sammanfattning i done-fil: antal specs, tid, flakes

**Reviews:** ingen (exekverings-story, ingen kodändring)

**Arkitekturcoverage:** N/A.

---

### S42-1: Webb E2E critical-tier

**Prioritet:** 1
**Effort:** 30-45 min (3 specs är tyngre — payment + booking + provider)
**Domän:** e2e

Samma flöde som S42-0 för `test:e2e:critical` (booking + payment + provider).

**Särskilt fokus:** payment-spec kör Stripe mock — verifiera att mocken fortfarande funkar. Om test failar pga Stripe-API-ändring: notera i retro, fixa inte nu.

**Acceptanskriterier:**
- [ ] `test:e2e:critical` körd, resultat dokumenterat
- [ ] HTML-rapport i `docs/metrics/e2e-visual/2026-04-19/critical/`
- [ ] Traces sparade
- [ ] Flakes listade (om några)

**Reviews:** ingen.

---

### S42-2: Webb E2E external-tier

**Prioritet:** 2
**Effort:** 30-45 min (offline-specs kräver prod-build — `npm run build:pwa`)
**Domän:** e2e

Samma flöde för `test:e2e:external` (customer-insights + offline-mutations + offline-pwa).

**Aktualitet verifierad:**
- `offline-pwa.spec.ts` kräver `build:pwa` FÖRST — separat projekt i playwright.config.ts
- Om offline-build failar: tiern är röd, detta blir en fynd snarare än en fix

**Acceptanskriterier:**
- [ ] `test:e2e:external` körd, resultat dokumenterat
- [ ] HTML-rapport i `docs/metrics/e2e-visual/2026-04-19/external/`
- [ ] Offline-specs körda mot prod-build
- [ ] Traces sparade

**Reviews:** ingen.

---

### S42-3: Full-suite stabilitet + flake-rapport

**Prioritet:** 3
**Effort:** 45-60 min (full svit ~15-20 min + analys)
**Domän:** e2e

Kör HELA sviten (34 specs). Jämför mot baseline (373 pass / 77 skip / 0 fail). Identifiera flakes via retry-mönster.

**Implementation:**

```bash
# Kör med retries för att hitta flakes
npm run test:e2e -- --retries=2 --reporter=html,json

# Analysera: vilka specs passerade bara efter retry?
# (Playwright JSON-reporter ger "retry: true"-markering)
```

**Acceptanskriterier:**
- [ ] Full svit körd (34 specs)
- [ ] Resultat dokumenterat: pass/skip/fail jämfört mot baseline (373/77/0)
- [ ] Flakes listade i `docs/metrics/e2e-visual/2026-04-19/full-report.md` (spec-namn + retry-count)
- [ ] HTML-rapport sparad
- [ ] **Om regression**: notera i done-fil, fixa INTE i denna sprint

**Reviews:** ingen.

---

### S42-4: iOS native-flöde-audit via mobile-mcp

**Prioritet:** 4
**Effort:** 1-1.5h
**Domän:** ios (audit, ingen kodändring)

Starta iOS Simulator, logga in som provider, gå igenom alla native-flöden (6 konverterade + messaging WebView). Screenshot per flöde. Samma mönster som S38-0.

**Aktualitet verifierad:**
- iOS native-status per MEMORY.md: Dashboard, Bokningar, Kunder, Tjänster, Mer, Profil = native (sessions 99-107)
- Messaging = WebView (S37-rollout, S38-0 verifierad)
- Kalender, Reviews, Insights, Announcements = WebView

**Flöden att täcka:**
1. Login (native splash + webview-login)
2. Dashboard (NativeDashboardView)
3. Bokningar-lista (NativeBookingsView)
4. Booking detail (native drawer)
5. Kunder-lista (NativeCustomersView)
6. Customer detail
7. Tjänster-lista (NativeServicesView)
8. Mer-meny (NativeMoreView — 11 menyalternativ)
9. Profil (NativeProfileView — 2 tabs)
10. Messaging inkorg (WebView)
11. Messaging tråd (WebView)
12. Kalender (WebView)
13. Offline-banner (flygplansläge på/av)

**Implementation:**

```
1. Öppna simulator: `xcrun simctl boot <UDID>`
2. Launch app via mobile-mcp
3. Logga in: provider@example.com / ProviderPass123!
4. Gå igenom flödena, screenshot per steg
5. Spara till docs/metrics/ios-audit-2026-04-19/01-login.png ... 13-offline.png
6. Skriv retro-fil: docs/retrospectives/2026-04-19-ios-e2e-audit.md med fynd
```

**Acceptanskriterier:**
- [ ] 13 screenshots i `docs/metrics/ios-audit-2026-04-19/` (numrerade 01-13)
- [ ] Retro-fil med fynd per flöde (fungerar/trasigt/degraderat)
- [ ] **Om blocker hittas:** lägg som backlog-rad i status.md, fixa INTE i denna sprint
- [ ] Touch-targets visuellt ≥44pt (spotcheck, inte mätning)
- [ ] Svenska å/ä/ö renderas korrekt i alla screenshots

**Reviews:** cx-ux-reviewer på retro-fil (inte på koden — det finns ingen)

**Arkitekturcoverage:** N/A.

**Gotcha:** mobile-mcp kan inte köras parallellt med annan session som använder simulatorn (se MEMORY feedback_no_parallel_mcp_agents.md). S42-0/1/2/3 kan köras parallellt med S42-4 eftersom de inte rör simulatorn.

---

### S42-5: XCUITest-bootstrap-plan (docs-only)

**Prioritet:** 5 (valfri, beror på tid)
**Effort:** 30-45 min
**Domän:** docs (`docs/plans/ios-xcuitest-bootstrap.md`)

Skriv plan-dokument för framtida XCUITest-sprint. Utifrån fynd från S42-4 — vilka flöden MÅSTE täckas först?

**Innehåll:**
- Målbild: smoke-nivå XCUITest (login + 3 kritiska flöden)
- Setup-steg: EquinetUITests target i Xcode, WebDriverAgent-dependency, test-fixtures
- Test-fixtures: auth via mobileToken (undvik webview-login-flakes)
- CI-integration: GitHub Actions + macOS-runner (dyrt) eller lokal-only först?
- Effort-uppskattning: 2-3 dagar
- Backlog-placering: efter lansering (inte blocker)

**Acceptanskriterier:**
- [ ] `docs/plans/ios-xcuitest-bootstrap.md` skriven med alla sektioner
- [ ] Backlog-rad i status.md med länk till planen
- [ ] Motiverad prioritering (post-launch eller pre-launch?)

**Reviews:** tech-architect (plan-granskning, en genomläsning räcker)

**Arkitekturcoverage:** N/A.

---

## Exekveringsplan

```
Sekventiellt (samma session):
  S42-0 (20-30 min) → S42-1 (30-45 min) → S42-2 (30-45 min) → S42-3 (45-60 min)

Parallellt möjligt (annan session eller efter):
  S42-4 (1-1.5h, iOS Simulator)

Efter audit:
  S42-5 (30-45 min, docs)
```

**Total effort:** 4-5h = 1 dag.

**Parallellisering:** S42-0 till S42-3 kör Playwright mot localhost:3000. S42-4 kör iOS Simulator. De krockar inte — kan köras i två sessioner (worktree eller samma session sekventiellt).

---

## Definition of Done (sprintnivå)

- [ ] 4 webb-tiers körda med HTML-rapporter i `docs/metrics/e2e-visual/2026-04-19/`
- [ ] Full-suite flake-rapport producerad
- [ ] iOS native-audit med 13 screenshots i `docs/metrics/ios-audit-2026-04-19/`
- [ ] Retro-fil `docs/retrospectives/2026-04-19-e2e-genomkörning.md` med fynd per tier
- [ ] Om blockers hittas: backlog-rader i status.md (inte fixade i denna sprint)
- [ ] S42-5 plan skriven ELLER avskriven i retro

**Ingen kodändring.** Om något visar sig vara trasigt: notera, fixa i S43 eller hotfix-sprint.
