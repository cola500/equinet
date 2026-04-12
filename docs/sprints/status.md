---
title: "Sprint Status -- Live"
description: "Delad statusfil som alla Claude-sessioner uppdaterar vid commit"
category: sprint
status: active
last_updated: 2026-04-11
sections:
  - Aktiv sprint
  - Tidigare sprintar
  - Sessioner
  - Beslut
  - Blockerare
---

# Sprint Status -- Live

> **Instruktion:** Uppdatera denna fil vid varje commit. Tech lead laser den for review och koordinering.

## Aktiv sprint

**Sprint 24** ([sprint-24-parallel-refactor.md](sprint-24-parallel-refactor.md)):

| Story | Roll | Ansvarig | Status | Branch | Senaste commit |
|-------|------|----------|--------|--------|----------------|
| S24-1 Extrahera BookingValidation | fullstack (webb) | Session 1 | done | feature/s24-1-booking-validation | - |
| S24-2 ManualBookingDialog steg-split | fullstack (webb) | - | pending | - | - |
| S24-3 Snabba säkerhetsfixar | fullstack (webb) | - | pending | - | - |
| S24-4 Dependabot auto-merge | fullstack (infra) | - | pending | - | - |
| S24-5 iOS cleanup | fullstack (ios) | - | pending | - | - |
| S24-6 Hjälpartiklar till markdown | fullstack (docs) | - | pending | - | - |
| S24-7 Legacy docs svenska tecken | fullstack (docs) | - | pending | - | - |
| S24-8 Applicera parallel-sprint-regler | fullstack (docs) | - | pending | - | - |

## Tidigare sprintar (alla klara)

| Sprint | Tema | Stories |
|--------|------|---------|
| S23 | Token-effektivitet | 8/8 done |
| S22 | Lanseringsklar | 5/6 done (S22-3 blocked) |
| S21 | Härdning inför lansering | 6/6 done |
| S20 | Process enforcement | 6/6 done |
| S19 | E2E-hardening | 9/9 done |
| S18 | iOS native-migrering | 4/5 done (S18-5 bonus pending) |
| S17 | Infra & cleanup | 8/8 done |
| S16 | Supabase cutover | 5/5 done |
| S15 | Supabase cutover | 7/7 done |
| S14 | RLS Live | 6/6 done |
| S13 | Supabase Auth cleanup | 6/6 done |
| S12 | Auth routes | 5/5 done |
| S11 | Dual auth | 4/4 done |
| S10 | RLS + Auth PoC | 2/2 done |
| S9 | Hardening | 10/12 done (S9-3 parkerad, S9-4 pending) |
| S8 | Native + voice | 3/3 done |
| S7 | RLS + voice spike | 2/5 done (S7-2/3 backlog) |
| S2-S6 | Features + cleanup | done |

## Sessioner

| Session | Roll | Arbetar pa | Branch | Startad |
|---------|------|-----------|--------|---------|
| Sprint 24 Session 1 | fullstack (webb) | S24-2 next | feature/s24-2-manual-booking-dialog | 2026-04-12 |

## Beslut

| Datum | Beslut | Motivering |
|-------|--------|------------|
| 2026-04-10 | seed.sql tom, auth-triggers separat | supabase start kor seed FORE Prisma-tabeller |
| 2026-04-01 | Sekventiellt arbete, en session at gangen | Delad working directory, parallella branches krockar |

## Backlogg

### Blockerare vid lansering

| Item | Effort | Beskrivning |
|------|--------|-------------|
| Uppgradera till Vercel Pro | $20/man | Hobby tillater inte kommersiellt bruk |

### Hog prioritet

| Item | Effort | Beskrivning |
|------|--------|-------------|
| E-postverifiering Resend (S17-5) | 0.5 dag | Verifiera Resend-leverans i prod |
| MFA for admin | 1 dag | Supabase TOTP-enrollment + verifiering |

### Vart att fixa (vid tillfalle)

| Item | Effort | Motivering |
|------|--------|------------|
| CSP report-to | 15 min | Vi har CSP men vet inte nar den blockerar i prod. Skicka till Sentry. |
| Dependabot auto-merge for patch | 15 min | PRs skapas men ingen mergar dem. Patch kan auto-mergas. |
| Migrationstest pa ren DB i CI | 30 min | CI kor migrate deploy, inte reset. Fangar inte trasiga migrationer fran scratch. |

### Vid lansering

| Item | Effort | Motivering |
|------|--------|------------|
| Rate limit alerting | 30 min | Ingen trafik i prod annu. Skicka 429-hits till Sentry vid lansering. |
| Log aggregation (Axiom/Logtail) | 0.5 dag | Sentry fangar fel men strukturerade loggar behovs for felsökning i prod. |
| Skew protection / rolling releases | 15 min | Kraver Vercel Pro. Forhindrar att gamla klienter traffar ny server vid deploy. |
| CORS headers | 15 min | Inga externa klienter annu (iOS ar same-origin via WKWebView). |
| A11y-testning (axe-core) | 1 dag | Bra praxis. Kan laggas som E2E-steg med Playwright axe-integration. |

### Lag prioritet

| Item | Effort | Beskrivning |
|------|--------|-------------|
| Supabase Realtime | 1-2 dagar | Live-uppdatering via WebSocket, ersatter SWR-polling |
| Zod .strict() pa mobile-token | 30 min | Saknas pa request body |

## Blockerare

| Blocker | Paverkar | Agare | Status |
|---------|---------|-------|--------|
| Apple Developer Program (99 USD) | Push-lansering | Johan | Ej kopt |
