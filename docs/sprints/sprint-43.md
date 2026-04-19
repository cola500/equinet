---
title: "Sprint 43: Testpyramid-omfördelning (Discovery + Pilot + första batch)"
description: "Flytta E2E-logik till integration/component-nivå. 36 specs (50% skippade) → 8-12 E2E + ~20 integration-tests."
category: sprint
status: planned
last_updated: 2026-04-19
tags: [sprint, testing, e2e, integration-tests, test-pyramid, refactoring]
sections:
  - Sprint Overview
  - Kontext och data
  - Stories
  - Exekveringsplan
  - Risker
  - Definition of Done
---

# Sprint 43: Testpyramid-omfördelning

## Sprint Overview

**Mål:** Börja flytta E2E-specs ned i testpyramiden. Efter sprinten: alla 36 specs klassade, 6-9 specs konkret omfördelade (pilot + första batch), mätbar tids- och flake-vinst dokumenterad.

**Bakgrund:** E2E-sviten (36 specs, 9138 rader) är testunderhållets största kostnad. 18/36 specs (50%) har skip/fixme — halva sviten är sophög. Många specs testar API-logik, validering eller auth som kunde testas med integration-tests (~10-100ms) istället för full browser (~30s-2min per spec).

Integration-test-mönstret finns redan etablerat i kodbasen (9 `.integration.test.ts`-filer för API-routes). Vi bygger inte nytt — vi expanderar.

**Scope-avgränsning:** Sprint 43 täcker Fas 1-3 (Discovery + Pilot + första batch). Fas 4 (rensa skip-avfall) och Fas 5 (hårdhärda smoke-tier) blir S44.

---

## Kontext och data

### Nuvarande test-status

- **Unit-tester**: 353 filer, 4186 tester (kör ~10s)
- **Integration-tests**: 9 filer för API-routes (mönstret finns)
- **E2E-specs**: 36 filer, 9138 rader
  - Pass/skip/fail senast: 373 / 77 / 0
  - 18/36 har skip/fixme (50%)
  - Full svit tar ~15-20 min
- **Kända flakes**: cookie-consent, networkidle, rate-limit, seed-konflikter

### Målbild efter omfördelning

| Nivå | Antal | Tid |
|------|-------|-----|
| Unit | 4000+ | ~10s |
| **Integration (expanderad)** | +20-30 | ~5-10s |
| **Component (ny)** | ~8-12 | ~3-5s |
| E2E smoke (hårdhärdat) | 8-12 | ~3-5 min |

**Förväntad vinst:** Halverad E2E-tid, 0 skip-specs, PR-körningar möjliga.

---

## Stories

### S43-0: Discovery — klassa alla 36 E2E-specs

**Prioritet:** 0
**Effort:** 0.5 dag (3-4h)
**Domän:** docs + analys (`docs/plans/testpyramid-omfordelning.md`)

Gå igenom alla 36 specs en efter en. Klassificera varje enligt fyra kategorier med motivering.

**Klassning:**

| Kategori | Kriterium | Förväntat antal |
|----------|-----------|-----------------|
| **STANNA** | Genuin user journey över 2+ domäner, browser-specifikt beteende (offline PWA, SW, visuell regression) | 8-12 |
| **FLYTTA → integration** | Testar API-logik, Zod-validering, auth-guards, IDOR-skydd, DB-interaktion | 12-16 |
| **FLYTTA → component** | UI-interaktion isolerad (form-validering, modal, widget-rendering) | 4-6 |
| **TA BORT** | Duplikat av unit/integration-täckning, skip-förseglat, dött scope | 4-8 |

**Per spec dokumentera:**
- Filnamn + rader
- Beskrivning (vad testas)
- Nuvarande status (pass/skip/flaky)
- Föreslagen kategori + motivering
- Om FLYTTA: till vilken fil/struktur
- Om STANNA: motivering varför browser krävs
- Om TA BORT: vad täcker redan detta

**Output:**
- `docs/plans/testpyramid-omfordelning.md` med klassning per spec
- Sammanfattning: totaler per kategori
- Prioritering för Fas 3-batcher (vilka 4-6 specs först?)

**Acceptanskriterier:**
- [ ] Alla 36 specs klassade med motivering
- [ ] Summary-tabell med totaler per kategori
- [ ] 2-3 pilot-kandidater explicit markerade (kriterier: representativa för varje "FLYTTA"-kategori, relativt små/enkla, välförstådd domän)
- [ ] Första Fas 3-batch (4-6 specs) föreslagen + motiverad
- [ ] Klar för review

**Reviews:** tech-architect (plan-granskning — är klassningen rimlig? missar vi något?)

**Arkitekturcoverage:** N/A (discovery, inte implementation)

---

### S43-1: Pilot — flytta 2-3 specs till integration/component

**Prioritet:** 1
**Effort:** 0.5-1 dag (4-6h)
**Domän:** tests (`src/app/api/**/*.integration.test.ts` + `src/components/**/*.test.tsx`)

Proof-of-concept. Välj 2-3 specs från Discovery-planen som representerar olika "FLYTTA"-kategorier. Flytta dem. Mät.

**Implementationsmönster för integration-test:**

Kopiera etablerat mönster från `src/app/api/bookings/[id]/route.integration.test.ts`. Kör Next.js route handlers direkt utan webserver:

```ts
import { POST } from '@/app/api/X/route'
import { NextRequest } from 'next/server'

// Skapa request direkt, anropa handler, assertera response
const req = new NextRequest('http://localhost/api/X', { ... })
const res = await POST(req)
expect(res.status).toBe(200)
```

**Per flyttad spec:**
1. Skriv integration/component-ekvivalent (samma eller bättre coverage)
2. Kör båda sida-vid-sida en commit
3. Verifiera: nytt test täcker scenariot; ta bort E2E-spec
4. Mät: tid före (E2E spec) → tid efter (integration-test)

**Acceptanskriterier:**
- [ ] 2-3 specs flyttade och E2E-versionen borttagen
- [ ] Nya tester gröna
- [ ] `npm run check:all` grön
- [ ] Pilot-rapport i `docs/metrics/testpyramid/pilot-2026-04-20.md`:
  - Tid före/efter per spec
  - Coverage-jämförelse (behöll vi täckning?)
  - Överraskningar / gotchas
  - **Go/no-go-beslut för Fas 3**

**Reviews:** code-reviewer (verifiera test-kvalitet)

**Arkitekturcoverage:** N/A (ingen arkitekturdesign)

**Risker:**
- **Coverage-förlust**: en E2E testar ofta flera lager. Om vi flyttar API-test-delen ned, verifiera att UI-delen inte tappas. Lösning: ibland krävs både integration-test + component-test för att ersätta en E2E.
- **Dolda beroenden**: spec kan förlita sig på fixtures/seed som inte finns på integration-nivå. Dokumentera i pilot-rapporten.

---

### S43-2: Första batch — flytta 4-6 specs

**Prioritet:** 2
**Effort:** 1 dag (6-8h)
**Domän:** tests

Förutsatt **go** från pilot-rapporten (S43-1). Flytta första batch enligt Discovery-planen.

**Batch-val:**
- 4-6 specs från "FLYTTA → integration"-kategori
- Välj specs som hör ihop tematiskt (t.ex. alla auth-specs, eller alla booking-API-specs) för att hålla commit-ordningen ren
- Undvik samma domän som pilot (minska risk för konflikter)

**Process per spec:**
Samma som pilot. Dokumentera varje flytt i batch-rapporten.

**Acceptanskriterier:**
- [ ] 4-6 specs flyttade
- [ ] Integration/component-tester gröna
- [ ] `npm run check:all` grön
- [ ] E2E-svit körs under nuvarande tid (eller snabbare)
- [ ] Batch-rapport i `docs/metrics/testpyramid/batch-1-2026-04-XX.md`:
  - Lista flyttade specs + nya testfiler
  - Kumulativ tids-/flake-vinst
  - Eventuella gotchas

**Reviews:** code-reviewer

**Arkitekturcoverage:** N/A

---

## Exekveringsplan

```
Sekventiellt (ordningen är viktig):
  S43-0 (0.5 dag, Discovery) 
    ↓
  Review Discovery-planen (15-30 min, tech-architect)
    ↓
  S43-1 (0.5-1 dag, Pilot)
    ↓
  Go/no-go-beslut baserat på pilot-rapport
    ↓
  S43-2 (1 dag, Första batch)
```

**Total effort:** 2-3 dagar.

**Ej parallelliserbart:** Varje fas bygger på föregående. Går att parallellisera inom batchar (Fas 3+) om domäner skiljer sig, men inte inom sprint 43.

---

## Risker

| Risk | Sannolikhet | Mitigering |
|------|-------------|-----------|
| Coverage-förlust vid flytt | Medel | Klassa noggrant i Discovery; pilot mäter behållen täckning |
| Integration-test kan inte replikera E2E-scenario (t.ex. client-side routing) | Medel | Dessa stannar som E2E. Discovery fångar detta. |
| Pilot misslyckas → stop | Låg | Pilot-rapporten har explicit go/no-go. S43-2 startar inte automatiskt. |
| Sunk-cost bias ("men denna spec har alltid funnits!") | Medel | Klassningen i Discovery är disciplin-verktyget. Motivering krävs, inte tyckande. |
| Scope-creep: fixa flakes under omfördelning | Hög | Nolltolerans: om en spec flakar, flytta ELLER ta bort, INTE fixa. |

---

## Definition of Done (sprintnivå)

- [ ] Discovery-plan täcker alla 36 specs med klassning
- [ ] Pilot-rapport med go/no-go-beslut
- [ ] 6-9 specs konkret omfördelade (pilot + batch)
- [ ] `npm run check:all` grön
- [ ] E2E-sviten fortfarande grön (med färre specs)
- [ ] Mätbar tids- och flake-vinst dokumenterad i metrics-katalog
- [ ] Fas 4-5 (skip-rensning + smoke-härdning) definierade för S44
