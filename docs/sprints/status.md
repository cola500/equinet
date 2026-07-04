---
title: "Sprint Status -- Live"
description: "Delad statusfil som alla Claude-sessioner uppdaterar vid commit"
category: sprint
status: active
last_updated: 2026-07-03
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

> **Nuläge (2026-07-03):** Ingen numrerad sprint pågår. Arbetet körs som **ad-hoc slices** och spåras i den kanoniska **[backlog.md](backlog.md)** ("Aktiva produktspår" + "Arkiv / Done"). **Senast avslutat:** enabler-epiken *Prod-lik staging med demo per session* (Slice 1–3c) — **live i prod 2026-07-02**, staging och main i paritet. Se [epic-prodlik-staging-demo-per-session.md](../ideas/epic-prodlik-staging-demo-per-session.md) + [slice-3c-release-runbook.md](../operations/slice-3c-release-runbook.md). **Nästa prioriterade initiativ:** se [backlog.md "Aktiva produktspår"](backlog.md#aktiva-produktspår). Senast avslutade numrerade sprint: **S67**.

**Sprint 67** — iOS staging capability via separat Vercel-projekt. **KLAR 2026-05-09.** Se [sprint-67-ios-staging-capability.md](sprint-67-ios-staging-capability.md).

| Story | Beskrivning | Status |
|-------|-------------|--------|
| S67-0 | Cron disable guard | done (1da4ed34, PR #328) |
| S67-1 | Skapa `equinet-staging-app` Vercel-projekt | done |
| S67-2 | Kopiera env-vars (Batch 1-5 + STAGING_PROJECT) | done |
| S67-3 | Verifiera ssoProtection-policy | done (no-op, redan korrekt) |
| S67-4 | Stripe webhook | deferred — out of scope, dokumenterat |
| S67-5 | DNS-flytt till nya projektet | done |
| S67-6 | Verifiera webb publikt | done |
| S67-7 | Verifiera iOS Simulator end-to-end | done (Erik Järnfot demo-flow renderar) |
| S67-8 | Cleanup `equinet-app` staging-mappning | follow-up — manuell UI-action |
| S67-9 | Slutdokumentation | done |

*(Sprint 67 klar 2026-05-09. 9 stories planerade, 8 done + 1 deferred + 1 follow-up. iOS Simulator verifierad mot `equinet-staging.johanlindengard.com`: dashboard + kalender + bokningar + tjänster renderar Erik:s demo-data utan SSO-blockering. Bonusvärde: cache-bug i URLSession identifierad och fixad i `APIClient.swift`. Story i `docs/stories/ios-api-cache-policy-hardening.md`. Walkthrough i `docs/operations/ios-staging-2026-05-09-walkthrough.md`. Follow-ups i `docs/operations/staging-cleanup-followups.md`.)*

---

**Sprint 65** — Sprint 64 follow-through (auth-säkerhet och leveransgarantier). PAUSAD till förmån för Sprint 67. Se [sprint-65.md](sprint-65.md).

| Story | Beskrivning | Status |
|-------|-------------|--------|
| S65-1 | Hotfix: open redirect + redirectTo + userType-routing i auth/callback | pending |
| S65-2 | Riktig fire-and-forget-fix: fail loud eller retry-kö (rotorsak) | pending |
| S65-3 | Eliminera kvarstående fire-and-forget i reschedule + invites + booking-series | pending |
| S65-4 | Lägg till STRIPE_WEBHOOK_SECRET + audit för fler missade env-vars i CI-guard | pending |
| S65-5 | Session-invalidering på andra enheter vid lösenordsbyte | pending |
| S65-6 | Egen rate-limiter för change-password | pending |
| S65-7 | userType-guard på change-password + synkad lösenordspolicy i UI | pending |

*(Sprint 65 planerad 2026-04-30 men pausad. 7 stories från tech-lead-review av Sprint 64 samma dag — 3 BLOCKERS + 7 MAJORS hittades post-merge. Total effort ~2-3 dagar. S65-1 är hotfix; auth/callback får INTE aktiveras i Supabase Redirect URLs förrän klart. Komplett kontext i sprint-65.md.)*

---

**Sprint 64** — Auth-leverans och URL-config-uppstädning. **KLAR MEN INTE RELEASE-KLAR** — fynd från tech-lead-review 2026-04-30 åtgärdas i Sprint 65.

| Story | Beskrivning | Status |
|-------|-------------|--------|
| S64-1 | Fixa fire-and-forget i AuthService och övriga notifiers (HÖG PRIO) | done (facafec4) — fix räddar inte leveransen, se S65-2 |
| S64-2 | Städa Vercel env-variabler med literal `\n` (preview + dev) | done (verifierat: NEXT_PUBLIC_SUPABASE_URL + ANON_KEY rena i preview+dev) |
| S64-3 | Fixa hardkodad fel domän i `data-retention-warning.ts` | done (fd7c2c7f) |
| S64-4 | CI-guard: kräv kritiska env-variabler i prod-build | done (a86a1fd0) — saknar STRIPE_WEBHOOK_SECRET, se S65-4 |
| S64-5 | "Byt lösenord"-funktion under Inställningar | done (c8c9e69d) — saknar session-invalidering, egen rate-limiter, userType-guard, synkad UI-policy. Se S65-5/6/7 |
| S64-6 | Supabase Auth callback-route för magic link / OAuth | done (4932c0f1) — **3 BLOCKERS i route** (open redirect, ingen redirectTo-validering, hardkodad userType-routing). Får INTE aktiveras i Supabase förrän S65-1 mergad |
| S64-7 | URL-konfigurationsmatris i `docs/operations/url-configuration.md` | done (cd33f9cc) |

*(Sprint 64 mergad 2026-04-30. 7 stories från password reset-incidenten samma dag. Tech-lead-review samma kväll hittade 3 BLOCKERS + 7 MAJORS + 5 MINORS. Sprint 64 räddar INTE email-leveransen och callback-routen har öppen attack-yta. Sprint 65 stänger luckorna. CSP-hotfix landad på main 9410dd21. Komplett kontext i sprint-64.md.)*

---

**Sprint 63** — Smart Replies release-klar.

| Story | Beskrivning | Status |
|-------|-------------|--------|
| S63-1 | Chip med ouppfyllt `{telefon}` skickas som rå placeholder | done (57189d7d) |
| S63-2 | Chip-klick raderar befintlig text i skrivfältet utan varning | done (f0a447ad) |
| S63-3 | Mallarna täcker inte vanliga fält-behov (ETA, "jag är framme") | done (f2926549) |
| S63-4 | Ta bort smart_replies feature flag (DoD) | done (173f6bc7) |

*(Sprint 63 klar 2026-04-26. 4/4 stories done — Smart Replies release-klar: telefon-placeholder disabled (S63-1), undo-toast vid chip-klick (S63-2), ETA-mallar tillagda (S63-3), smart_replies flag borttagen — GA (S63-4). Mergade via PR #306–309. check:all 4/4 gröna, 4380 tester.)*

---

**Sprint 62** — Kundinbjudningar release-klar.

| Story | Beskrivning | Status |
|-------|-------------|--------|
| S62-1 | UI-lösenordsvalidering saknar regex-regler | done (4b38a1f1) |
| S62-2 | NEXTAUTH_URL som bas-URL för inbjudningslänken | done (a182d1b5) |
| S62-3 | Merge-dialog refreshar inte kundlistan | done (f7bb5bd4) |
| S62-4 | Merge-route kringgår GhostMergeService | done (66ad2561) |
| S62-5 | Ingen historik om skickade inbjudningar | done (cb216f95) |
| S62-6 | Ta bort customer_invite feature flag (DoD) | done (bb520f91) |

*(Sprint 62 klar 2026-04-25. 6/6 stories done — kundinbjudningar release-klar: UI-lösenordsvalidering (S62-1), APP_URL-byte (S62-2), merge-dialog refresh (S62-3), GhostMergeService-refaktorering (S62-4), inbjudningshistorik (S62-5), customer_invite flag borttagen — GA (S62-6). Mergade via PR #299–304. check:all 4/4 gröna, 4375 tester.)*

*(Sprint 61 klar 2026-04-25. 6/6 stories done — återkommande bokningar release-klar: atomisk serie-skapande via $transaction (S61-1), startdatumsvalidering (S61-2), kund-vy för seriebokningar med UX-review (S61-3), atomisk cancel (S61-4), email-bekräftelse vid serie-skapande (S61-5), recurring_bookings feature flag borttagen — GA (S61-6). Mergade via PR #294–298. check:all 4/4 gröna, 4368 tester.)*

*(Sprint 60 klar 2026-04-25. 5/5 stories done — förfallen service release-klar: inline intervalredigering i leverantörslistan (S60-2), rekommenderat intervall + varning vid >26 veckor (S60-3), native route returnerar 200+[] vid flagga AV (S60-4), due_for_service feature flag borttagen — GA (S60-5). Mergad via PR #293. check:all 4/4 gröna, 4370 tester.)*

*(Sprint 59 klar 2026-04-25. 5/5 stories done — gruppbokningar release-klar: filter för döda requests (S59-1), kopiera-kod-knapp + tydligare delnings-UX (S59-2), bokningsdetaljer inline efter match med peer-sanitering (S59-3), rate-limit på preview + atomisk join-transaktion med 409 vid full grupp (S59-4), feature flag borttagen — group_bookings är GA (S59-5). Mergade via PR #288, #289, #290, #291, #292. check:all 4/4 gröna, 4374 tester.)*

*(Sprint 58 klar 2026-04-24. 4/4 stories done — Affärsinsikter release-klar: total intäkt KPI (S58-1), delta-indikator mot föregående period (S58-2), tomtläge + tydligare servicebreakdown-rubrik (S58-3), business_insights feature flag borttagen (S58-4). Mergad via PR #287. check:all 4/4 gröna, 4380 tester. Demo-läget oberoende verifierat.)*

*(Sprint 57 klar 2026-04-24. 4/4 stories done — ruttsynlighet för nya kunder: kommande ruttar på leverantörsprofil (S57-1), rutt-badge i söklistan (S57-2), rutt-kontext-banner i bokningskalendern (S57-3), notis vid ruttändring (S57-4). Mergad via PR #284. Hotfix landad ovanpå: serviceType-filter söker nu i businessName + description + service.name.)*

*(Sprint 56 klar 2026-04-24. 4/4 stories done — kategori-ikoner navigerar till filtrerad sökning, tjänstetyp-filterchips på /providers, transparent pending-status med förväntad svarstid, review-uppmaning efter slutförd bokning.)*

*(Sprint 55 klar 2026-04-24. 1/1 story done — iOS demo mode + env-synk (NEXT_PUBLIC_DEMO_MODE) + kalender-buggfix (offset→padding för korrekt hit-testing) + dubblerad knapp borttagen. Retro: `docs/retrospectives/2026-04-24-sprint-55.md`.)*

*(Sprint 54 klar 2026-04-24. 2/2 stories done — inline bekräfta/avvisa i kalender + redigera bokningsdatum/-tid. Demo-feedback implementerad. Bugfix: "rejected" mappades inte till "cancelled" i API-anropet. Terminologifix: "Avböj" → "Avvisa" i hela appen.)*

*(Sprint 53 klar 2026-04-23. 4/4 stories done (inkl. valfri S53-3). Demo verifierat manuellt av Johan via skärmdelning-scenariot. R1+R2 + serial-review testat i praktiken — ~266k tokens total sprint-kostnad (mindre än en S51-djävulens-advokat-review). 4 procedurbrott (alla samma kategori: Dev self-merge × 3 + 0 plan-reviews av 4 stories) — trim-diskussion parkerad. Retro: `docs/retrospectives/2026-04-23-sprint-53.md`.)*

*(Sprint 50 klar 2026-04-21. 1/1 story done — S50-0 bevisade backend-kedjan fungerar (magic bytes → storage → signedUrl → provider-läsning). Webb-UI och iOS-login kunde INTE E2E-testas pga test-infrastruktur-begränsningar (MessagingDialog öppnar ej i headless, SecureTextField blockerar XCUITest). 3 backlog-rader: bucket-seeding (pre-launch blocker, 15 min), dialog-headless-undersökning, iOS-login-bypass. Fynd: `supabase/config.toml` hade `storage.enabled=false` — fixat i commiten. Retro: `docs/retrospectives/2026-04-21-messaging-visual.md` + `docs/retrospectives/2026-04-21-sprint-50.md`.)*

*(Sprint 49 klar 2026-04-21. 2/2 stories done — iOS auth-polish (7 minor-fynd från S48-0-reviews adresserade). Cookie-rensning vid logout, domän-filter, refresh-token-header, JWT-rotation-observer, retry-logik, mock-tester. Banner-UI deferred (AC #2 delvis uppfyllt). 6 nya minor-fynd från 3-reviews paketerade som backlog-rad. Retro: `docs/retrospectives/2026-04-21-sprint-49.md`.)*

*(Sprint 48 klar 2026-04-20. 3/3 stories done — iOS auth-desync-fix (pre-launch blocker löst) + miljö-hardening (staging-URL, env-hierarki, status-script) + gh pr merge-wrapper (stänger S47-4-lucka). Procedurbrott: 2 (båda "premature done-markering", inga strukturella). 4 real-world-saves av reviewer-subagenter. Första sprint där tech-lead-review-flödet fungerade konsekvent — S47-enforcement bevisad empiriskt. Retro: `docs/retrospectives/2026-04-20-sprint-48.md`.)*

*(Sprint 47 klar 2026-04-20. 6/6 stories done — process-hardening 2 komplett. 6 aktiva hooks (5 pre-commit + 1 pre-push), 4 BLOCKERS med override-mekanism, 37/37 tester gröna, review-matris extraherad, override-mönster dokumenterat. 6 procedurbrott (4 Dev-self-merges + 2 tech-lead-branch-fel) — två räddades av hookarna själva (real-world-saves). Retro: `docs/retrospectives/2026-04-20-sprint-47.md`.)*

*(Sprint 46 klar 2026-04-20 — bild-bilagor live. 8 procedurbrott identifierade → S47 bygger automation som gör dem omöjliga.)*

*(Sprint 45 klar 2026-04-19. 5/5 stories done — 3 nya process-scripts, 2 rule-förtydliganden, 2 hooks utökade. 0 nya Vitest-tester. PRar: #231 #232 #233 #234 mergade, #235 stängd utan merge (baserad på gammal main — commit-strategy.md-ändringen applicerad direkt på main i 79def043). Procedurbrott: minst 6 (2 rapporterade + 4 upptäckta post-avslut: S45-4 divergent branch, felaktig PR-info i status.md + retro, sprint-avslut-commits på main utan feature branch). Retro: `docs/retrospectives/2026-04-19-sprint-45.md`.)*

*(Sprint 44 klar 2026-04-19. 3/3 stories done — 44 nya Vitest-tester, 3 E2E-specs raderade, E2E-svit 29→22. Vitest: 4240→4284. Retro: `docs/retrospectives/2026-04-19-sprint-44.md`.)*

*(Sprint 43 klar 2026-04-19. 3/3 stories done — 7 E2E-specs migrerade, 150 nya Vitest-tester, E2E-svit 36→29. Retro: `docs/retrospectives/2026-04-19-sprint-43.md`. Sprint-avslut slutfört av tech lead i efterhand — Dev hoppade till S44 utan att avsluta.)*
*(Sprint 42 avbruten 2026-04-19. S42-0/1/2 done. S42-3/4/5 flyttade till backlog — testpyramid-arbetet prioriterat högre.)*
*(Sprint 41 klar 2026-04-19. 3/3 stories done.)*

> Sessionsstatus skrivs av varje session i sin egen fil: `docs/sprints/session-<sprint>-<domän>.md`

## Tidigare sprintar (alla klara)

> Sprint-historik (sprint-nivå). Backlog-items på item-nivå finns i [backlog.md](backlog.md) "Arkiv / Done"; per-sprint-detaljer i [retrospectives/](../retrospectives/).

| Sprint | Tema | Stories |
|--------|------|---------|
| S63 | Smart Replies release-klar | 4/4 done — telefon-placeholder disabled (S63-1), undo-toast (S63-2), ETA-mallar (S63-3), smart_replies flag borttagen — GA (S63-4). Mergade via PR #306–309. |
| S62 | Kundinbjudningar release-klar | Planerad 2026-04-25. 6 stories. |
| S61 | Återkommande bokningar release-klar | 6/6 done — atomisk create/cancel, startdatumsvalidering, kund-vy, email-bekräftelse, recurring_bookings flag borttagen. Mergade via PR #294–298. |
| S60 | Förfallen service release-klar | 5/5 done — inline intervalredigering, varning vid >26 veckor, native 200+[], due_for_service flag borttagen. Mergad via PR #293. |
| S59 | Gruppbokningar release-klar | 5/5 done — döda requests filtreras, kopiera-kod-knapp, bokningsdetaljer inline efter match, atomisk join + rate-limit på preview, group_bookings feature flag borttagen. Mergade via PR #288–292. |
| S58 | Affärsinsikter release-klar | 4/4 done — total intäkt KPI, delta-indikator, tomtläge, business_insights flag borttagen. Mergad via PR #287. |
| S57 | Ruttsynlighet för nya kunder | 4/4 done — kommande ruttar på leverantörsprofil, rutt-badge i söklista, rutt-kontext-banner, notis vid ruttändring. Mergad via PR #284. |
| S56 | Förbättrade kundflöden | 4/4 done — kategori-ikon-navigation, tjänstetyp-filterchips, transparent pending-status, review-uppmaning. |
| S55 | iOS demo mode + kalenderfix | 1/1 done — env-synk, kalender-buggfix, dubblerad knapp borttagen. Retro: `docs/retrospectives/2026-04-24-sprint-55.md`. |
| S54 | Inline-godkänd + redigera bokning | 2/2 done — inline bekräfta/avvisa i kalender, redigera datum/tid. Bugfix rejected→cancelled. |
| S53 | Webb demo-värdig (leverantörsvinklad) | 4/4 done — demo-audit, FAQ native `<details>`, Erik Järnfot seed, "Se demo"-knapp. Sprint ≤1 arbetsdag. R1+R2+serial-review testat empiriskt (266k tokens total, jämför S51-0.1:s 300k för EN story). Retro: `docs/retrospectives/2026-04-23-sprint-53.md`. |
| S52 | Upptäckt och transparens (SKIPPAD) | Aldrig startad. Pivot till demo-scope 2026-04-22. Bevarad som referens för framtida pre-booking-messaging-epic. |
| S51 | Pre-launch-härdning (AVBRUTEN) | 2/6 done (S51-0 MFA admin, S51-0.1 MFA-hotfix). S51-1/2/3/4 avbrutna 2026-04-22 vid pivot till demo-scope. Minor-fynd från S51-0.1-review paketerade som backlog-rad. |
| S50 | Pre-launch visuell verifiering | 1/1 done — messaging-bilagor backend bevisad via API-tester. Webb-UI + iOS-login blockerade av test-infrastruktur-begränsningar (headless dialog-problem, iOS SecureTextField). Bucket-seeding-bugg hittad (pre-launch blocker). Retro: `docs/retrospectives/2026-04-21-messaging-visual.md`. |
| S49 | iOS auth-polish | 2/2 done — 7 minor-fynd från S48-0 paketerade. Cookie-rensning, domän-filter, JWT-rotation-observer, retry-logik, mock-tester. Banner-UI deferred (backlog). 6 nya minor-fynd från 3-reviews. Retro: `docs/retrospectives/2026-04-21-sprint-49.md`. |
| S48 | iOS auth-desync-fix + miljö-hardening | 3/3 done — iOS auth-fix (pre-launch blocker), staging/env-struktur, gh pr merge-wrapper. 2 procedurbrott (båda premature done-markering). 4 real-world-saves av reviewer-subagenter. Första konsekvent tech-lead-review-flöde. Retro: `docs/retrospectives/2026-04-20-sprint-48.md`. |
| S47 | Process-hardening 2 — enforcement över hela linjen | 6/6 done — 6 aktiva hooks, 4 BLOCKERS med override, 37 tester, review-matris maskinläsbar, override-mönster dokumenterat. 2 real-world-saves bevisade enforcement i praktiken. Retro: `docs/retrospectives/2026-04-20-sprint-47.md`. |
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
| (ingen aktiv session) | - | - | - | - |

## Beslut

| Datum | Beslut | Motivering |
|-------|--------|------------|
| 2026-04-10 | seed.sql tom, auth-triggers separat | supabase start kor seed FORE Prisma-tabeller |
| 2026-04-01 | Sekventiellt arbete, en session at gangen | Delad working directory, parallella branches krockar |

## Backlogg

> Backloggen är konsoliderad till den kanoniska **[docs/sprints/backlog.md](backlog.md)**.
> Den här filen (`status.md`) håller bara sprint-state: aktiv/tidigare sprintar, sessioner, beslut och blockerare.
> Alla items — aktiva produktspår, kö, parkerat, PO-beslut och arkiv — finns i backlog.md.

## Blockerare

> **Kanonisk blockerar-lista finns i [backlog.md "Blockerare"](backlog.md#blockerare-väntar-på-johan).** Undvik att duplicera här — nedan är bara den historiska huvudblockern.

| Blocker | Paverkar | Agare | Status |
|---------|---------|-------|--------|
| Apple Developer Program (99 USD) | Push-lansering | Johan | Ej kopt |
