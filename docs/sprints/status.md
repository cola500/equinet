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

**Sprint 35** ([sprint-35.md](sprint-35.md)) -- Messaging Slice 1 MVP

| Story | Domän | Status |
|-------|-------|--------|
| S35-0 Plan-review av Conversation-domän | docs | done (2ba96855) |
| S35-1 Kund kan skicka meddelande till leverantör | webb | done (cfb2e663) |
| **S35-1.5 Messaging RLS + service-flag (HOTFIX)** | infra | done (08aec743) |
| S35-2 Leverantör kan läsa och svara i inkorg | webb | done (ce73d2c5) |
| S35-3 Push-notifiering vid nytt meddelande | webb | done (055b6fc8) |

> Sessionsstatus skrivs av varje session i sin egen fil: `docs/sprints/session-<sprint>-<domän>.md`

## Tidigare sprintar (alla klara)

| Sprint | Tema | Stories |
|--------|------|---------|
| S34 | iOS UX Major-fixar | 3/3 done (tap-targets, kontakter, felmeddelanden) |
| S33 | Process tweaks + iOS UX-audit | 2/2 done + Seven Dimensions formalized + messaging-epic slicad |
| S32 | Metrics + iOS Polish | 3/3 done (metrics-baseline, native bokningsdetalj, iOS polish-sweep) |
| S31 | Content Freshness + Agent Efficiency | 6/6 done (hjälpartiklar, testing-guide, release-checklist, plan-mall, arkivera planer, mät docs) |
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
| (ingen aktiv session -- S34 klar) | - | - | - | - |

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
| LoginError `emailNotConfirmed` eget fall | 30 min | S34-3 begränsning: ger "fel e-post/lösenord" istället för "verifiera din e-post". Nytt enum-fall + nytt meddelande. |
| LoginError `.cancelled` URLError | 30 min | S34-3 begränsning: mappas till `.networkUnavailable` men kan triggas av app-navigering. Överväg separat `requestCancelled`-fall eller map till `.unknown`. |
| ios-learnings + patterns uppdatering från S34 | 30 min | `.confirmationDialog`-pattern, `LoginError`-enum-pattern, `URLError`-catch-ordning, mailto-encoding. Hör hemma i `.claude/rules/ios-learnings.md`. |
| Granska "redan fixat"-rate grep-pattern | 15 min | 2 sprintar i rad över mål 5%. Antingen justera pattern eller acceptera som ny baseline. |

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
| **Epic: Bokningskommunikation** ([epic-messaging.md](../ideas/epic-messaging.md)) | -- | Slicad enligt Seven Dimensions 2026-04-18. MVP = Slice 1 nedan. Separat från leverantör↔leverantör-epic. |
| Messaging Slice 1 (MVP): per bokning, text, polling | 4-5 dagar | Ny Conversation/Message-domän. Inkorg + tråd-vy. Push. 80% av värdet. Post-launch. |
| Messaging Slice 2: bilagor (bild) | 1-2 dagar | Supabase Storage. Värde för vet/hovslagare. Efter Slice 1 mätt. |
| Messaging Slice 3: realtid | 1-2 dagar | Ersätt polling med Supabase Realtime. Nice-to-have, inte blockerande. |
| Messaging Slice 4: röstmeddelanden | 2-3 dagar | Återanvänd SpeechRecognizer (S8). Unik konkurrensfördel för fysiskt arbetande leverantörer. |
| Messaging Slice 5: förfrågningar före bokning | 2-3 dagar | Okvalificerade förfrågningar. Kräver triage/spam-skydd-beslut. |
| Leverantör ↔ leverantör community (separat epic) | 2-3 sprintar | Nätverkseffekt (remisser, vikarier). Annan persona, annat värde, annan moderering-komplexitet. Utforska efter messaging-epic validerats. |

## Blockerare

| Blocker | Paverkar | Agare | Status |
|---------|---------|-------|--------|
| Apple Developer Program (99 USD) | Push-lansering | Johan | Ej kopt |
