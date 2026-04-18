---
title: "Sprint Status -- Live"
description: "Delad statusfil som alla Claude-sessioner uppdaterar vid commit"
category: sprint
status: active
last_updated: 2026-04-18
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

**Sprint 31** ([sprint-31-content-freshness.md](sprint-31-content-freshness.md)):

| Story | Domän | Status |
|-------|-------|--------|
| S31-1 Hjälpartiklar-audit och uppdatering | webb | done |
| S31-2 Admin testing-guide uppdatering | docs | done |
| S31-3 Release-checklista | docs | done |
| S31-4 Tvinga grep-verifiering i plan-mall | docs | done |
| S31-5 Arkivera gamla planer | docs | done |
| S31-6 Mät agent-användning av docs | docs | done |

**Sprint 32** ([sprint-32-metrics.md](sprint-32-metrics.md)) -- Metrics + iOS Polish

| Story | Domän | Status |
|-------|-------|--------|
| S32-1 Metrics-rapport-script (baseline) | infra | done (d90e7ed0) |
| S32-2 Native bokningsdetalj-vy | ios | done (b45e9f92) |
| S32-3 iOS polish-sweep | ios | done (e011b70b) |

> Sessionsstatus skrivs av varje session i sin egen fil: `docs/sprints/session-<sprint>-<domän>.md`

## Tidigare sprintar (alla klara)

| Sprint | Tema | Stories |
|--------|------|---------|
| S30 | Kunskap & Polish | 5/5 done, 2 skipped (redan implementerade) |
| S29 | iOS Polish + mobile-mcp | 6/6 done (review-gating, mobile-mcp, E2E, iOS cleanup no-ops, docs) |
| S28 | Offline PWA-stabilisering | 5/5 done (spike, CI-smoke, fix rotorsaker, iOS-verifiering, docs) |
| S27 | Pre-launch sweep | 8/8 done (Leaflet lazy-load, migration CI, email refactor, MFA admin, GDPR retention, iOS, docs) |
| S26 | Subagent A/B-test | 4/4 done (parallella reviews +40%, research-agent villkorlig) |
| S25 | Worktree-agent test | 4/4 done (worktree-agent blockerad, stories kördes direkt) |
| S24 | Parallell refactoring | 8/8 done (första parallella sprinten) |
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
| (ingen aktiv session) | - | - | - | - |

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
| Migrationstest pa ren DB i CI | 30 min | CI kor migrate deploy, inte reset. Fangar inte trasiga migrationer fran scratch. |
| Native schema-redigering (iOS) | 1 dag | AvailabilitySchedule + AvailabilityException redigeras idag i WebView. Provider använder detta dagligen. |
| iOS Snapshot-tester | 0.5-1 dag | Swift Snapshot Testing över 15 native-vyer. Fångar visuella regressioner automatiskt. |

### Vid lansering

| Item | Effort | Motivering |
|------|--------|------------|
| Rate limit alerting | 30 min | Ingen trafik i prod annu. Skicka 429-hits till Sentry vid lansering. |
| Log aggregation (Axiom/Logtail) | 0.5 dag | Sentry fangar fel men strukturerade loggar behovs for felsökning i prod. |
| Skew protection / rolling releases | 15 min | Kraver Vercel Pro. Forhindrar att gamla klienter traffar ny server vid deploy. |
| CORS headers | 15 min | Inga externa klienter annu (iOS ar same-origin via WKWebView). |
| A11y-testning (axe-core) | 1 dag | Bra praxis. Kan laggas som E2E-steg med Playwright axe-integration. |
| iOS accessibility audit (VoiceOver + Dynamic Type) | 0.5-1 dag | NFR-relevant för lansering. mobile-mcp + VoiceOver-simulering över alla native-vyer. |

### Lag prioritet

| Item | Effort | Beskrivning |
|------|--------|-------------|
| Supabase Realtime | 1-2 dagar | Live-uppdatering via WebSocket, ersatter SWR-polling |
| Zod .strict() pa mobile-token | 30 min | Saknas pa request body |
| Live Activity för pågående bokning (iOS 16+) | 1-1.5 dag | Lock Screen + Dynamic Island när bokning pågår. Wow-feature, medel-effort. |
| Siri Shortcut "Nästa bokning" | 0.5 dag | NSUserActivity + App Intent. Demoteknikvärde högt, komplexitet låg. |
| Mät modellval per story (Opus/Sonnet/Haiku) | 0.5 dag | Utöka generate-metrics.sh med modell-dimension i M3/M4/M5. Lägg "Modell:"-fält i done-fil-mall. Efter 10+ stories per modell: beslut om standard per story-typ. |
| Meddelanden kund ↔ leverantör (per bokning) | ~1 sprint MVP | In-app chat kopplad till specifik bokning. Ersätter SMS/samtal. Supabase Realtime + push-infra finns redan. Post-launch-kandidat. |
| Meddelanden leverantör ↔ leverantör (community) | 2-3 sprintar | Nätverkseffekt (remisser, vikarier). Kräver moderering, rapportering, blockera-funktion. Produktbeslut om community-karaktär krävs. Utforska efter Variant A. |

## Blockerare

| Blocker | Paverkar | Agare | Status |
|---------|---------|-------|--------|
| Apple Developer Program (99 USD) | Push-lansering | Johan | Ej kopt |
