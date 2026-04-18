---
title: "Sprint 32: Metrics + iOS Polish"
description: "Etablera datadriven utvärdering + native bokningsdetalj + iOS polish-sweep"
category: sprint
status: planned
last_updated: 2026-04-18
tags: [sprint, metrics, data, dora, agents, ios, native, polish]
sections:
  - Sprint Overview
  - Sessionstilldelning
  - Stories
  - Exekveringsplan
---

# Sprint 32: Metrics + iOS Polish

## Sprint Overview

**Mål:** Etablera objektiva mätetal så vi kan utvärdera effekten av processförbättringar datadrivet + ge kärlek till iOS-appen genom en saknad native detaljvy och en tvärgående polish-sweep.

**Bakgrund:** Vi har infört många effektiviseringar (pattern-katalog, review-gating, worktree-parallellisering, token-reduktion, verifiera-aktualitet-regel) men mäter inte systematiskt om de ger värde. Samtidigt är iOS-appen ~90% native men bokningsdetalj (mest använda detaljvyn) är fortfarande WebView, och de 15 native vyerna har varierande UX-kvalitet.

**Princip:** Mät få saker konsekvent. Polish synligt mätbart.

---

## Sessionstilldelning

Kan köras parallellt -- S32-1 (infra) och S32-2/3 (ios) rör helt separata filer.

- **Session 1:** S32-1 (metrics, infra-domän)
- **Session 2:** S32-2 -> S32-3 (ios-domän, sekventiellt)

Eller en session sekventiellt om tidbrist.

---

## Stories

### S32-1: Metrics-rapport-script (baseline)

**Prioritet:** 1
**Effort:** 0.5-1 dag
**Domän:** infra (`scripts/`, `package.json`, `docs/metrics/`)

Bygg ett script som genererar en markdown-rapport med utvecklings- och process-metrics. Rapporten körs manuellt vid sprint-avslut och committas som historik.

**Implementation:**

**Steg 1: Skapa `scripts/generate-metrics.sh`** (eller TypeScript om komplexiteten motiverar det)

Scriptet ska:
- Läsa `git log` för commits, tidstämplar, branch-historik
- Läsa `docs/done/*.md` för story-metadata, subagent-resultat, "redan fixat"-flaggor
- Läsa `docs/retrospectives/*.md` för sprint-perioder
- Output till `docs/metrics/<YYYY-MM-DD>-report.md`

**Steg 2: Implementera 6 baseline-metrics** (minsta uppsättning som ger insikt)

1. **Deployment frequency** -- commits till `main` per vecka senaste 4 veckor
   - Kommando: `git log main --since='4 weeks ago' --pretty=format:"%ci"`
   - Gruppera per ISO-vecka, räkna

2. **Lead time for changes** (median, p90) -- tid från första commit på feature-branch till merge
   - Kommando: `git log --merges --first-parent main --since='8 weeks ago'`
   - Per merge: hitta första commit på den mergede branchen, beräkna tidsdiff
   - Rapportera median + p90 i timmar

3. **"Redan fixat"-rate** -- andel stories där planering visade att problemet redan var löst
   - Grep i `docs/done/*.md` efter "redan fixat|redan åtgärdat|redan implementerat|Skipped"
   - Division med total count done-filer per sprint
   - Mål: <5% (nuvarande ~25%)

4. **Subagent hit-rate** -- hur ofta hittar review-agenter faktiska problem
   - Grep i `docs/done/*.md` efter `blocker|major|minor` i Reviews-sektion
   - Per kategori: count + vilken subagent hittade
   - Svar på: "fångar subagenter verkliga problem eller är de ceremoniella?"

5. **Cykeltid per story** (median) -- första plan-commit till done-commit
   - För varje `s<N>-<M>-plan.md` och `s<N>-<M>-done.md`: hitta commits, beräkna diff
   - Rapportera median per sprint

6. **Test-count trend** -- antal unit-tester per sprint-avslut
   - Kör `grep -r "^\s*\(test\|it\)(" src/ | wc -l` vid sprint-avslut
   - Spara i rapport, trend över tid

**Steg 3: Lägg till npm-script**

```json
"metrics:report": "bash scripts/generate-metrics.sh"
```

**Steg 4: Skapa `docs/metrics/README.md`** med förklaring av varje metric, hur den beräknas, och vad som är "bra/dåligt"-intervall.

**Steg 5: Kör första gången -- etablera baseline**
- `npm run metrics:report`
- Committa `docs/metrics/2026-04-18-baseline.md`
- Detta är nolläget vi mäter framtida förbättringar mot

**Steg 6: Länka från CLAUDE.md snabbreferens**
- Lägg till rad: "Metrics | `docs/metrics/` | aktuell rapport: `latest.md`"

**Acceptanskriterier:**
- [ ] `npm run metrics:report` genererar markdown-rapport utan fel
- [ ] Rapporten innehåller alla 6 baseline-metrics
- [ ] Baseline-rapport för 2026-04-18 committad
- [ ] `docs/metrics/README.md` förklarar varje metric
- [ ] CLAUDE.md länkar till metrics-katalogen
- [ ] `npm run check:all` grön

**Avgränsning / ej i scope:**
- Ingen automatisering via CI (scriptet körs manuellt vid sprint-avslut)
- Ingen dashboard eller visualisering (markdown räcker som start)
- Ingen Vercel/GitHub API-integration (git log + docs räcker för baseline)
- Ingen historik-migrering (vi mäter framåt, inte bakåt -- retros finns för historik)

---

### S32-2: Native bokningsdetalj-vy

**Prioritet:** 2
**Effort:** 1-1.5 dag
**Domän:** ios (`ios/Equinet/Equinet/`) + webb (API om native-endpoint saknas)

Klick på en bokning i `NativeBookingsView` öppnar idag WebView (`/provider/bookings/[id]`). Detta är den mest använda detaljvyn i appen -- provider tittar på den flera gånger per bokning. Native variant ger snappare känsla, offline-kapabilitet och bättre integration med övriga native-vyer.

**Feature Inventory (OBLIGATORISK innan implementation):**

Innan planen skrivs färdigt, dokumentera exakt vad webbens `/provider/bookings/[id]` visar och gör:
- Vilka fält renderas? (kund, tjänst, tidpunkt, status, hästar, anteckningar, adress, pris, mm)
- Vilka knappar finns? (bekräfta, komplettera, avboka, omboka, lägg till anteckning, be om review, mm)
- Vilka status-övergångar stöds?
- Vilka beroende vyer öppnas? (edit-sheet, review-sheet, map-view)
- Finns inline-review-flöde eller länkar det bort till annan sida?

**Verifiera auth-mekanism:**
- Kolla om `/api/bookings/[id]/*` routes använder `auth()` (session) eller `authFromMobileToken()` (Bearer JWT)
- Om session-only: bygg ny `/api/native/bookings/[id]` route med Bearer JWT
- Om Bearer stöds: återanvänd befintliga endpoints

**Implementation (steg efter Feature Inventory + auth-check):**

**Steg 1: Models** (`ios/Equinet/Equinet/BookingDetailModels.swift`)
- Utöka `BookingsModels.Booking` om fält saknas för detaljvyn
- `BookingDetail` struct med alla fält som webben visar

**Steg 2: API** (om nytt behövs)
- `/api/native/bookings/[id]/route.ts` GET + PATCH
- Zod .strict(), Bearer JWT, rate limit, svenska felmeddelanden
- Tester enligt BDD dual-loop

**Steg 3: ViewModel** (`ios/Equinet/Equinet/BookingDetailViewModel.swift`)
- @Observable @MainActor, DI via protokoll
- `load(bookingId:)`, `confirm()`, `complete()`, `cancel()`, `reschedule()`
- Optimistic UI-mönster (oldState + revert vid fel)
- Tester (XCTest)

**Steg 4: View** (`ios/Equinet/Equinet/NativeBookingDetailView.swift`)
- Sektioner: Kund, Tjänst, Tidpunkt, Adress, Hästar, Anteckningar, Status-actions
- Haptic feedback på statusändringar
- Loading + error states
- Inline review-flöde om `ReviewsModule.inlineReviewFlow` är aktuellt

**Steg 5: Navigation**
- `NativeBookingsView` -> klick på rad öppnar `NativeBookingDetailView` via NavigationLink
- Back-navigation fungerar med TabView
- Deep-link från widget öppnar rätt detaljvy (om widget visar booking-id)

**Steg 6: Tester och polish**
- APIClientTests för nya metoder
- BookingDetailViewModelTests
- mobile-mcp-verifiering: screenshot, interaktion, accessibility tree
- Feature flag-kontroll (om det ska bakom flag, troligen inte -- det ersätter befintlig WebView)

**Acceptanskriterier:**
- [ ] Feature Inventory dokumenterad i plan (innan kod skrivs)
- [ ] Auth-kompatibilitet verifierad
- [ ] `NativeBookingDetailView` öppnas när användaren klickar på bokning i listan
- [ ] Alla features från WebView-versionen finns native
- [ ] Status-actions har optimistic UI + haptic + error handling
- [ ] XCTest för ViewModel (minst 10 tester)
- [ ] mobile-mcp-verifiering: screenshot + accessibility tree
- [ ] `check:all` grön + `xcodebuild test -only-testing:EquinetTests/BookingDetailViewModelTests` grön

**Docs-matris:**
- README.md (ny native vy)
- Hjälpartikel (`src/lib/help/articles/provider/bokningsdetalj.md`) -- uppdatera eller skapa
- Admin testing-guide (nytt scenario: "öppna bokning i iOS-appen, ändra status")
- patterns.md om nytt mönster upptäcks

---

### S32-3: iOS polish-sweep

**Prioritet:** 3
**Effort:** 0.5-1 dag
**Domän:** ios (`ios/Equinet/Equinet/Native*.swift`)

Systematisk genomgång av de 15 native-vyerna för att säkerställa konsekvent UX: haptic feedback vid actions, loading states, empty states, error states.

**Implementation:**

**Steg 1: Inventera befintligt** (skriv tabell i plan-filen)

| Native-vy | Haptic | Loading | Empty | Error | Noter |
|-----------|--------|---------|-------|-------|-------|
| NativeDashboardView | ? | ? | ? | ? | |
| NativeBookingsView | ? | ? | ? | ? | |
| ... (alla 15) | | | | | |

Kolumn för varje: ja / nej / delvis. Detta är audit-fasen.

**Steg 2: Definiera "klar"** per kategori

- **Haptic:** `UIImpactFeedbackGenerator(.light)` vid tap, `.notificationOccurred(.success)` vid lyckad action, `.notificationOccurred(.error)` vid fel
- **Loading:** ProgressView eller skeleton medan data laddas, inte "tom skärm"
- **Empty:** Vänlig tom-vy med illustration + förklaring + CTA (om tillämpligt)
- **Error:** Felbanner med "Försök igen"-knapp

**Steg 3: Fixa de tio värsta** (prioritera synlighet)

Fokusera på vyer som används mest (Dashboard, Bokningar, Kalender, Kunder) och vyer där användaren saknar tydlig respons (alla action-knappar).

**Steg 4: Gemensamma komponenter**

Om >3 vyer använder samma mönster, extrahera:
- `EmptyStateView(icon:title:message:cta:)`
- `ErrorBanner(message:onRetry:)`
- `LoadingOverlay` eller `.skeleton()` modifier

**Steg 5: cx-ux-reviewer subagent** + mobile-mcp före-efter-screenshots

**Acceptanskriterier:**
- [ ] Audit-tabell i plan-filen (alla 15 vyer inventerade)
- [ ] Minst 10 konkreta polish-fixar applicerade
- [ ] Gemensamma komponenter extraherade om tillämpligt
- [ ] cx-ux-reviewer har godkänt (inga blockerare eller majors)
- [ ] mobile-mcp före/efter-screenshots i done-fil
- [ ] `xcodebuild test` grön (inga regressioner i ViewModels)

**Docs-matris:**
- `docs/retrospectives/<datum>-ios-polish-sweep.md` med audit-data
- patterns.md: "iOS polish-standards (haptic/loading/empty/error)" om nytt pattern

---

## Framtida stories (skiss, inte scope för S32)

Dessa är kandidater för senare sprintar:

- **S32-4:** Vercel deploy-metrics (via Vercel API) -- deployment frequency på deploys istället för merges
- **S32-5:** Change failure rate -- markera commits som "hotfix" eller "revert", beräkna CFR
- **S32-6:** MTTR -- tid mellan "broken"-commit och fix
- **S32-7:** Metrics-dashboard i `/admin/system` eller separat Vercel-sida

---

## Exekveringsplan

```
Parallellt (2 sessioner):
  Session 1: S32-1 (0.5-1 dag, metrics)
  Session 2: S32-2 (1-1.5 dag, bokningsdetalj) -> S32-3 (0.5-1 dag, polish)

Eller sekventiellt (1 session):
  S32-1 -> S32-2 -> S32-3
```

**Total effort:** ~2-3 dagar.

## Definition of Done (sprintnivå)

- [ ] `npm run metrics:report` fungerar och baseline etablerad
- [ ] Native bokningsdetalj ersätter WebView för `/provider/bookings/[id]`
- [ ] 15 native-vyer genomgångna med konsekvent haptic/loading/empty/error
- [ ] `npm run check:all` grön + `xcodebuild test -only-testing:EquinetTests` grön
- [ ] mobile-mcp-verifiering gjord och dokumenterad
- [ ] Hjälpartikel + testing-guide uppdaterade för bokningsdetalj
