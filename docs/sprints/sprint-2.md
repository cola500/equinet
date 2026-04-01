---
title: "Sprint 2: Team Foundation"
description: "Forsta sprint med teamstruktur. Kritiska fixar, teknikskuld-batchar och first-time team workflow."
category: sprint
status: active
last_updated: 2026-04-01
tags: [sprint, team, security, tech-debt, workflow]
sections:
  - Sprint Overview
  - Beslut
  - Stories
  - Teknikskuld-opportunistiskt
  - Sprint Retro Template
---

# Sprint 2: Team Foundation

**Sprint Duration:** 1 vecka
**Sprint Goal:** Fixa kritiska problem fran genomlysning, etablera teamworkflow, leverera forsta feature med stationsflode
**Start Date:** 2026-04-01

---

## Sprint Overview

Forsta sprinten med formell teamstruktur (AGENTS.md, stationsflode, review-checklistor).
Fokus pa att fixa kritiska problem och testa att workflown fungerar.

**Roller denna sprint:**
- Tech lead: Claude Opus (arkitektur, review, prioritering)
- Fullstack: Claude-session (implementation)
- Johan: Produktagare (godkanner, prioriterar)

---

## Beslut

### NextAuth v5 beta (inventerad 2026-04-01)

- **Status**: beta.30 ar senaste versionen (ingen stabil v5 existerar)
- **Risk**: Lag, beta i 2+ ar. Men extremt utbredd i produktion.
- **Beslut**: Stanna kvar pa beta.30. Bevaka Auth.js-repot for GA-release.
- **Atagard vid GA**: Planera uppgradering som separat story.

### Permissions-Policy geolocation (fixad 2026-04-01)

- **Problem**: `geolocation=()` blockerade all geolocation, men 5 komponenter anvander det
- **Fix**: Andrat till `geolocation=(self)` -- tillater first-party, blockerar third-party

### Geocode auth (fixad 2026-04-01)

- **Problem**: `/api/geocode` saknade auth-check -- oppen geocoding-proxy
- **Fix**: Lagt till `auth()` med null-check + test

---

## Stories

### S2-1: withApiHandler-migrering (batch 1) -- READY

**Prioritet:** Hog
**Typ:** Teknikskuld
**Beskrivning:** Migrera 15-20 routes till `withApiHandler`-wrappern. Borja med enklaste domanerna.
**Scope:** `src/app/api/horses/`, `src/app/api/follows/`, `src/app/api/reviews/`, `src/app/api/services/`
**Acceptanskriterier:**
- [ ] 15+ routes migrerade
- [ ] Alla befintliga tester fortsatt grona
- [ ] `npm run check:all` passerar
**Station:** Plan godkand av tech lead -> Red -> Green -> Review -> Verify -> Merge

### S2-2: console.* cleanup (batch 1) -- READY

**Prioritet:** Medel
**Typ:** Teknikskuld
**Beskrivning:** Rensa console.* i 20 mest berorda filer. Byt till `logger`/`clientLogger`.
**Scope:** De 43 filerna med 97 forekomster (se genomlysning)
**Acceptanskriterier:**
- [ ] 50+ console.*-forekomster borttagna
- [ ] Strukturerad loggning pa plats
- [ ] Inga nya console.* introducerade
- [ ] `npm run check:all` passerar
**Station:** Forenklat (mekanisk refaktorering): Green -> Verify -> Merge

### S2-3: Stora filer -- BookingService uppdelning (analys) -- BACKLOG

**Prioritet:** Lag
**Typ:** Teknikskuld
**Beskrivning:** BookingService ar 986 rader. Analysera vilka delar som kan extraheras.
**Scope:** `src/domain/booking/BookingService.ts`
**Acceptanskriterier:**
- [ ] Analys-dokument med forslag pa uppdelning
- [ ] Identifierade delar med test-takning
- [ ] Ingen implementation denna sprint -- bara analys
**Station:** Plan (analys) -> tech lead granskar

### S2-4: Observability-pipeline -- research -- BACKLOG

**Prioritet:** Lag
**Typ:** Research
**Beskrivning:** Undersok alternativ for log drain, client error reporting, correlation IDs.
**Scope:** Sentry (redan installerat), Vercel Drains, OpenTelemetry
**Acceptanskriterier:**
- [ ] Jamforelse av alternativ med for-/nackdelar
- [ ] Rekommendation med uppskattad insats
- [ ] Ingen implementation denna sprint

---

## Teknikskuld -- opportunistiskt

Dessa ska fixas nar vi andrar i berorda filer, inte som separata tasks:

| Skuld | Trigger | Atagard |
|-------|---------|---------|
| `console.*` -> `logger` | Andrar i fil med console.* | Byt till strukturerad loggning |
| Route utan `withApiHandler` | Andrar i route-fil | Migrera till wrapper |
| `any`-typ | Andrar i fil med any | Typa korrekt |
| Saknad feature flag test | Andrar i flaggad route | Lagg till "returns 404 when disabled"-test |

---

## Sprint Retro Template

### Vad gick bra?

### Vad kan forbattras?

### Hur fungerade stationsfloden?

### Teamkommunikation -- vad saknades?

### Andring till nasta sprint?
