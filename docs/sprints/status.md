---
title: "Sprint Status -- Live"
description: "Delad statusfil som alla Claude-sessioner uppdaterar vid commit"
category: sprint
status: active
last_updated: 2026-04-19sections:
  - Aktiv sprint
  - Tidigare sprintar
  - Sessioner
  - Beslut
  - Blockerare
---

# Sprint Status -- Live

> **Instruktion:** Uppdatera denna fil vid varje commit. Tech lead laser den for review och koordinering.

## Aktiv sprint

**Sprint 43: Testpyramid-omfördelning** ([sprint-43.md](sprint-43.md))

| Story | Prio | Status | Effort |
|-------|------|--------|--------|
| S43-0: Discovery — klassa alla 36 E2E-specs | 0 | done | 0.5 dag |
| S43-1: Pilot — flytta 2 specs (unsubscribe + horses) | 1 | done | 0.5-1 dag |
| S43-2: Första batch — flytta 4-6 specs | 2 | done | 1 dag |

**Fas 4 (rensa 18 skip-specs) + Fas 5 (hårdhärda smoke-tier)** planeras för S44.

*(Sprint 42 avbruten 2026-04-19. S42-0/1/2 done. S42-3/4/5 flyttade till backlog — testpyramid-arbetet prioriterat högre.)*
*(Sprint 41 klar 2026-04-19. 3/3 stories done.)*

> Sessionsstatus skrivs av varje session i sin egen fil: `docs/sprints/session-<sprint>-<domän>.md`

## Tidigare sprintar (alla klara)

| Sprint | Tema | Stories |
|--------|------|---------|
| S42 | E2E-genomkörning (avbruten) | 3/6 done (smoke/critical/external visuell verifiering) — avbruten för att prioritera testpyramid-omfördelning |
| S41 | Messaging-ordning + review-lärdom | 3/3 done (blocker-fix, review-manifest, hook) |
| S40 | Smart-replies prod-ifiering | 4/4 done (polish, flag+tests, docs, cx-ux-review) — cx-ux-reviewer missade chat-ordning-blocker (fångades av tech lead, fix i S41) |
| S39 | Self-Testing v3 + messaging-polish | 4/4 done (sync-gate, hook-paths, rollout-checklist, optimistisk messaging) |
| S38 | iOS messaging audit + fixar | 4/4 done (audit, docs, blockers-fix, messaging-knapp) -- audit-first räddade iOS-upplevelsen |
| S37 | Messaging-rollout | 3/3 done (skeleton, injection-fix, flag on) |
| S36 | Self-Testing Infrastructure | 7/7 done (arkitekturcoverage, metacognition, messaging-audit, tech-lead-hook, docs-compliance, modellval-larm, slicing-trigger) + hotfix PR #207 |
| S35 | Messaging Slice 1 MVP | 5/5 done (design, kund, RLS-hotfix, leverantör, push) -- första kompletta Seven Dimensions-leverans |
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
| (ingen aktiv -- väntar på S43-1 Pilot) | - | - | - | - |

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
| S42-3: Full-suite flake-rapport | 45-60 min | Avbruten från S42. Kan köras när testpyramid-arbetet behöver baseline-data. |
| S42-4: iOS native-flöde-audit via mobile-mcp | 1-1.5h | Avbruten från S42. 13 flöden, visuell baseline. Fortfarande värdefullt före lansering. |
| Implementera iOS XCUITest smoke-svit | 2-3 dagar | Plan finns: [ios-xcuitest-bootstrap.md](../plans/ios-xcuitest-bootstrap.md). Login + 3 native-flöden. Post-launch. |
| Migrationstest pa ren DB i CI | 30 min | CI kor migrate deploy, inte reset. Fangar inte trasiga migrationer fran scratch. |
| Messaging: aria-label på ProviderNav messaging-badge (MINOR-2) | 15 min | Skärmläsare förstår inte "3"-siffran. |
| Messaging: Pending-state på MessagingSection-knapp (MINOR-4) | 15 min | Ingen visuell feedback vid klick. |
| Messaging: Pagination för långa trådar (SUGGESTION-1) | 1-2h | Lazy-loading när tråd >50 meddelanden. |
| Messaging: Leverantörs-läskvitto (SUGGESTION-2) | 1h | "Läst kl. 14:23" ger förtroende. |
| Messaging: Typing indicator (SUGGESTION-3) | 2-3h | Real-time via polling/SSE. Post-MVP. |
| Native schema-redigering (iOS) | 1 dag | AvailabilitySchedule + AvailabilityException redigeras idag i WebView. Provider använder detta dagligen. |
| iOS Snapshot-tester | 0.5-1 dag | Swift Snapshot Testing över 15 native-vyer. Fångar visuella regressioner automatiskt. |
| LoginError `emailNotConfirmed` eget fall | 30 min | S34-3 begränsning: ger "fel e-post/lösenord" istället för "verifiera din e-post". Nytt enum-fall + nytt meddelande. |
| LoginError `.cancelled` URLError | 30 min | S34-3 begränsning: mappas till `.networkUnavailable` men kan triggas av app-navigering. Överväg separat `requestCancelled`-fall eller map till `.unknown`. |
| ios-learnings + patterns uppdatering från S34 | 30 min | `.confirmationDialog`-pattern, `LoginError`-enum-pattern, `URLError`-catch-ordning, mailto-encoding. Hör hemma i `.claude/rules/ios-learnings.md`. |
| Granska "redan fixat"-rate grep-pattern | 15 min | 2 sprintar i rad över mål 5%. Antingen justera pattern eller acceptera som ny baseline. |
| Plan-commit-gate: hook + rule-förtydligande | 45-60 min | **Lärdom S43-1 2026-04-19**: Dev hoppade Station 1 (plan-commit FÖRE implementation) och gjorde 0 commits under hela körningen. Lyckat men riskabelt (ingen backup, ingen mellanreview). Fix: (1) pre-commit hook som varnar när story är `in_progress` i status.md utan motsvarande `docs/plans/<story-id>-plan.md` committad; (2) förtydliga i `autonomous-sprint.md` att pilot/batch-stories kräver egen plan-fil även om Discovery finns — planen ska beskriva commit-strategi + per-spec täckning, inte bara vad som migreras. |
| horses-CRUD coverage-gap (efter S43-1) | 1-2h | **Lärdom S43-1 2026-04-19**: E2E-specen täckte add/edit/delete + detail-navigering. Component-test täcker bara form-nivå. Delete-bekräftelsedialog, edit-flöde och `handleDelete`/`handleAddHorse` fetch-logik i `page.tsx` är nu otestade. Fix: `page.test.tsx` med MSW-mockade fetch-anrop ELLER behåll tunn E2E-smoke för horses-CRUD. |
| Coverage-gap-krav för S43-2 batch-rapport | 0 min (process) | Varje spec-migration i S43-2 ska explicit notera vilka scenarios från E2E som INTE är täckta av nya tester. Lärdom från S43-1: reviewer hittade gap, pilot-rapport gjorde inte. |

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
