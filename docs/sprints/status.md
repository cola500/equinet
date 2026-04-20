---
title: "Sprint Status -- Live"
description: "Delad statusfil som alla Claude-sessioner uppdaterar vid commit"
category: sprint
status: active
last_updated: 2026-04-19
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

**Sprint 47: Process-hardening 2 — enforcement över hela linjen** ([sprint-47.md](sprint-47.md))

| Story | Prio | Status | Effort |
|-------|------|--------|--------|
| S47-0: Explicit review-matris + strukturerat done-fil-format | 0 | done | 30-45 min |
| S47-1: Review-obligatorisk-gate (pre-commit BLOCKER) | 1 | pending | 1-1.5h |
| S47-2: Branch-check pre-commit (BLOCKER) | 2 | pending | 45 min |
| S47-3: Hook-tester (scripts/test-hooks.sh) | 3 | pending | 1-1.5h |
| S47-4: Uppgradera S45-varningar till BLOCKERS med override | 4 | pending | 45-60 min |
| S47-5: Sprint-avslut-review-gate | 5 | pending | 30-45 min |

*(Sprint 46 klar 2026-04-20 — bild-bilagor live. 8 procedurbrott identifierade → S47 bygger automation som gör dem omöjliga.)*

*(Sprint 45 klar 2026-04-19. 5/5 stories done — 3 nya process-scripts, 2 rule-förtydliganden, 2 hooks utökade. 0 nya Vitest-tester. PRar: #231 #232 #233 #234 mergade, #235 stängd utan merge (baserad på gammal main — commit-strategy.md-ändringen applicerad direkt på main i 79def043). Procedurbrott: minst 6 (2 rapporterade + 4 upptäckta post-avslut: S45-4 divergent branch, felaktig PR-info i status.md + retro, sprint-avslut-commits på main utan feature branch). Retro: `docs/retrospectives/2026-04-19-sprint-45.md`.)*

*(Sprint 44 klar 2026-04-19. 3/3 stories done — 44 nya Vitest-tester, 3 E2E-specs raderade, E2E-svit 29→22. Vitest: 4240→4284. Retro: `docs/retrospectives/2026-04-19-sprint-44.md`.)*

*(Sprint 43 klar 2026-04-19. 3/3 stories done — 7 E2E-specs migrerade, 150 nya Vitest-tester, E2E-svit 36→29. Retro: `docs/retrospectives/2026-04-19-sprint-43.md`. Sprint-avslut slutfört av tech lead i efterhand — Dev hoppade till S44 utan att avsluta.)*
*(Sprint 42 avbruten 2026-04-19. S42-0/1/2 done. S42-3/4/5 flyttade till backlog — testpyramid-arbetet prioriterat högre.)*
*(Sprint 41 klar 2026-04-19. 3/3 stories done.)*

> Sessionsstatus skrivs av varje session i sin egen fil: `docs/sprints/session-<sprint>-<domän>.md`

## Tidigare sprintar (alla klara)

| Sprint | Tema | Stories |
|--------|------|---------|
| S46 | Messaging Slice 2 — bilagor (bild) | 4/4 done — bild-upload, Supabase Storage, magic bytes, thumbnail. +18 Vitest-tester (4284→4302). 1 procedurbrott (plan-commit). iOS-audit: WKWebView OK, auth-desync funnen (pre-launch-blocker). Retro: `docs/retrospectives/2026-04-20-sprint-46.md`. |
| S44 | Testpyramid TA BORT + Batch 2 | 3/3 done — 3 E2E raderade, 4 migrerade, 7 coverage-tester. E2E 29→22. Vitest 4240→4284. Retro: process-drift-retron identifierade 8 procedurbrott S43-S44 → S45 bygger automation. |
| S43 | Testpyramid-omfördelning | 3/3 done (Discovery + Pilot + Batch 1) — 7 specs migrerade, E2E 36→29, Vitest +150. Tre procedurbrott identifierade: plan-commit-miss (S43-1), trivial-gating-miss (Dev skippade review i båda stories), sprint-avslut-hoppat (direkt till S44). Fixar: PR #227 + tre backlog-rader. |
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
| **iOS auth-desync native/WebView** (S46-3-fynd, höjd prio) | 1-2h | **Produktbugg**: Native login via Supabase Swift SDK sätter Supabase JWT i Keychain men startar inte MobileToken-exchange (`/api/auth/native-session-exchange`) och populerar inte WebView cookie-store. Konsekvens: ny enhet + native login → WebView-sidor (Meddelanden, Bokningar) visar "Kunde inte ladda"-fel. Grundläggande installations-flöde brustet. **Pre-launch blocker**. Granska `AuthManager`. Se `docs/metrics/ios-audit-2026-04-20-messaging-attachments.md`. |

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
| Review-matris: auth-UI-gap (S47-0-fynd) | 15 min | `src/components/auth/**/*.tsx` (inloggningsformulär, OAuth-knappar) matchar bara `ui-component`-raden → krav: code-reviewer + cx-ux-reviewer. Men INTE security-reviewer, trots att auth-UI är säkerhets-yta (session-hantering, CSRF, OAuth-flöden i UI). Lägg till rad i `.claude/rules/review-matrix.md`: `src/components/auth/**/*.tsx` → `code-reviewer, cx-ux-reviewer, security-reviewer`. Ingen akut risk (ingen pågående auth-UI-story) men bör fixas före nästa auth-relaterad UI-ändring. |
| Docs-sync: environments.md + .env.local-gotcha | 30-45 min | **Lärdom 2026-04-20**: environments.md säger Docker PostgreSQL lokalt men vi använder Supabase CLI sedan S17-7. Dokumentera också `.env.local`-fallgropen (Vercel CLI trumfar `.env`). Se även SEO-hotfix PR #240 som rättade prod-URL. |
| Miljö-hardening-sprint (S48-kandidat) | 1 dag | **Lärdom 2026-04-20**: "hitta rätt miljö" är oklart. Scope: (a) dedikerad `equinet-staging.vercel.app`-deployment (inte bara PR-preview), (b) iOS staging-scheme pekar på staging-URL (prod-scheme väntar tills Apple Developer köpt), (c) `.env`-hierarki-städning, (d) `npm run status` visar aktiv miljö. Vercel-URLs räcker (egen domän ej köpt). |
| Tech-lead-review av sprint-avslut | 30 min (process + ev. hook) | **Lärdom S45 2026-04-19**: Sprint-avslut hade 4 fel (felaktig PR-info, S45-4 divergent branch, CLAUDE.md/gotchas direkt på main utan PR, "5/5 done" när S45-4 open). Dev skrev retron med fel info; tech lead hade ingen review-triggerpunkt. Fix: formalisera "sprint-avslut är en story med egen review" i autonomous-sprint.md + ev. hook som varnar när retro committas utan tech-lead-signatur. |
| Plan-commit-gate: hook + rule-förtydligande | 45-60 min | **Lärdom S43-1 2026-04-19**: Dev hoppade Station 1 (plan-commit FÖRE implementation) och gjorde 0 commits under hela körningen. Lyckat men riskabelt (ingen backup, ingen mellanreview). Fix: (1) pre-commit hook som varnar när story är `in_progress` i status.md utan motsvarande `docs/plans/<story-id>-plan.md` committad; (2) förtydliga i `autonomous-sprint.md` att pilot/batch-stories kräver egen plan-fil även om Discovery finns — planen ska beskriva commit-strategi + per-spec täckning, inte bara vad som migreras. |
| Sprint-avslut-gate: hook eller script | 30-45 min | **Lärdom S43→S44 2026-04-19**: Dev hoppade till S44 utan att slutföra sprint-avslut (NFR/CLAUDE.md ej uppdaterade, status.md ej flyttad, gates ej körda, retro ofullständig). Tredje procedurbrottet i S43. Fix: hook som varnar när ny story markeras `in_progress` om föregående sprints stories alla är `done` men status.md "Aktiv sprint"-sektion inte flyttats till "Tidigare sprintar" + retro-fil saknas. |
| horses-CRUD coverage-gap (efter S43-1) | 1-2h | **Lärdom S43-1 2026-04-19**: E2E-specen täckte add/edit/delete + detail-navigering. Component-test täcker bara form-nivå. Delete-bekräftelsedialog, edit-flöde och `handleDelete`/`handleAddHorse` fetch-logik i `page.tsx` är nu otestade. Fix: `page.test.tsx` med MSW-mockade fetch-anrop ELLER behåll tunn E2E-smoke för horses-CRUD. |
| Coverage-gap-krav för S43-2 batch-rapport | 0 min (process) | Varje spec-migration i S43-2 ska explicit notera vilka scenarios från E2E som INTE är täckta av nya tester. Lärdom från S43-1: reviewer hittade gap, pilot-rapport gjorde inte. **UPPFYLLT i S43-2** — behålls som process-krav för framtida batchar. |
| due-for-service: `filter=upcoming`-test saknas (efter S43-2) | 15 min | Reviewer-fynd S43-2 2026-04-19: integration-test täcker `filter=overdue` + `filter=all` men inte `filter=upcoming`. E2E-specen testade det heller inte (ingen regression), men route-URL:en dokumenterar parametern. |

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
