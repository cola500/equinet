---
title: Security Sprint Continuity 2026-05
description: Konsoliderad re-entry-doc för Security Hardening-arbetet. Sprint 3-A klar + 3-A follow-up HIGH klart 2026-05-18. När sprinten återupptas — börja här.
category: security
status: active
last_updated: 2026-05-18
tags:
  - security
  - sprint
  - continuity
  - re-entry
  - sprint-3a
  - sprint-3a-followup
related:
  - fixes.txt
  - remediation-backlog-fixes-txt-2026-05.md
  - staging-security-audit-2026-05.md
  - slice-1-2-retro.md
  - sprint-closure-2026-05.md
  - security-hardening-sprint-backlog.md
  - ../operations/demo-audit-2026-05-14.md
sections:
  - Current State Summary
  - Completed Work
  - Open Security Backlog
  - Environment Status
  - Architectural Learnings
  - Recommended Next Sprint
  - Explicit Non-Goals
  - Re-entry Instructions
---

# Security Sprint Continuity 2026-05

> **Denna fil är primär entrypoint vid återupptagande av Security Hardening-arbetet.** Läs den först.

## 1. Current State Summary

**Sprint-status:** PAUSAD efter Sprint 3-A + Sprint 3-A follow-up (HIGH-prio slices) (2026-05-18).
**Branch:** `staging` synkad med `origin/staging` (senaste commit `a2ba326b`).
**Main/prod:** **Oberörd** — inga säkerhetsfixar mergade till `main` ännu, ingen prod-deploy utfärdad.
**Demo Maturity:** TRUSTED EXTERNAL TESTER READY (alla 4 CRITICAL stängda).

### Vad som uppnåtts (kort)

**Slice 1+2 (2026-05-17):**
- 7 av 12 staging-audit-fynd stängda (S-2, S-4, S-6, S-7, S-8, S-10, S-13).
- Demo-bypass-ytor stängda (email/push/delete/5 hidden routes).
- Admin UI-information-disclosure stängd (RSC layout-guard).
- Payment IDOR-invariant låst med tester.
- Staging avindexerad från sökmotorer.

**Sprint 3-A (CRITICAL hotfixes, 2026-05-17 → 2026-05-18):**
- C4 push-token hijack — pre-upsert ownership-check, 409 vid kollision (commit `8c9ee9fa`).
- C1 ghost-user collision — `GhostUserError EMAIL_BELONGS_TO_REGISTERED_USER` + `isManualCustomer`-gate (4 sub-slices).
- C2 manual-booking customerId IDOR — `isCustomerReachable` med link OR isManualCustomer OR booking-relation (C2.1, C2.2, C2.3-hotfix).
- C3 upload path-traversal — Fix A (MIME→ext) + Fix B (`assertSafeStorageFileName`) + Fix C (Zod UUID på entityId), PR #337 mergat som `30052a37`.

**Sprint 3-A follow-up (HIGH, 2026-05-18):**
- 3A.fu.1 — Verifierad `message-attachments`-bucket existerar i staging-Supabase (smoke 201, ingen kodändring).
- 3A.fu.2 — UUID-validera `bookingId` i 3 messages-routes (POST/GET messages, PATCH read, POST attachments), PR #338 mergat som `9e6cb2a7`.
- 3A.fu.3 — Services-bucket ownership: `entityId === session.user.providerId` exact match, PR #339 mergat som `a2ba326b`.

### Naming-clarification

Vår tidigare interna planering kallade follow-up-slices "Sprint 3-B (3B.1, 3B.2, 3B.3 ...)" — men `remediation-backlog-fixes-txt-2026-05.md` reserverar namnet "Sprint 3-B" för **H1, H4, H7, H10 HIGH-fynd** från fixes.txt (som ännu inte är påbörjade). För att undvika namnkonflikt benämns våra genomförda slices nu **"Sprint 3-A follow-up"** (3A.fu.1, 3A.fu.2 osv) i dokumentationen. Backlog-doc:s Sprint 3-B (H1-H10) är fortfarande pending och separat.

### Nuvarande risknivå

| Kategori | Risk-status |
|---|---|
| Data-läckage / IDOR | LÅG — RLS + ownership-checks + invariant-tester |
| Demo-bypass | LÅG — alla identifierade ytor stängda |
| AI cost-abuse | **HÖG** — ingen per-user budget, IP-pool delas (S-1, S-3 öppna) |
| Admin-yta | LÅG — RSC-guard + MFA + audit-log |
| Observability | MEDIUM — loggar finns men ingen aggregering/larm |

### Varför sprinten pausades

- Sprint 3-A komplett: alla 4 CRITICAL stängda och verifierade live.
- Sprint 3-A follow-up HIGH-segment komplett: 3 av 6 follow-up-slices klara (alla HIGH-prio).
- Återstående follow-up-slices (3A.fu.4 originalName-sanering, 3A.fu.5 prod-bucket-parity, 3A.fu.6 dev-fallback fail-loud) klassade MEDIUM/LOW — kan göras senare eller i samband med 3-B.
- Naturlig pause-point med samlat dokumentationspaket. `staging` är säkrat för fortsatt extern testning och iOS native-rebuild kan fortsätta utan blockerare.

## 2. Completed Work

### Slice 1 — demo-bypass-hardening (Slice 1-paket = commit `a3a1be26`)

| Sub-slice | Effort | Vad |
|---|---|---|
| S-2 | 15 min | 5 hidden provider-routes (voice-log, announcements, route-planning, due-for-service, group-bookings) redirectar till `/provider/profile` i demo |
| S-7 | 30 min | `PushDeliveryService.sendToUser()` har `isDemoMode()` tidig-exit + `[DEMO_PUSH_BLOCKED]`-log |
| S-10 | 30 min | `robots.txt` returnerar `Disallow: /` i demo |
| S-13 | 30 min | `DELETE /api/native/customers/[id]` returnerar 403 + `[DEMO_DELETE_BLOCKED]` i demo |

**Verifiering i staging:** Playwright/curl/runtime logs alla pass. Booking-accept som Erik triggade både `[DEMO_EMAIL_BLOCKED]` och `[DEMO_PUSH_BLOCKED]`, 0 träffar mot `api.push.apple.com` eller `resend.com`.

### Slice 2 — admin/MFA/payment-härdning

| Sub-slice | Commit | Vad |
|---|---|---|
| S-4 + hotfix | `7639a4d2`, `ccce1df5` | Ny RSC `src/app/admin/layout.tsx`. Icke-admin → `/`. Anonym → `/login`. |
| S-6 | (ingen kod) | iat-baserad 15-min admin-timeout var **redan implementerad** i `requireAdminRole` med 6 tester. Audit-fyndet var false positive. |
| S-8 | `a42a81c6` | 2 nya invariant-tester i `PaymentService.test.ts` som låser ownership-kontraktet mellan service och repository. |

**Verifiering i staging:** Anonym `/admin` → 307 `/login`. Erik (demo-provider) `/admin` → `/`. Provider dashboard regressar inte. PaymentService-tester: 17 gröna (15 befintliga + 2 nya).

### Commits (kronologisk ordning)

| Commit | Beskrivning | Slice |
|---|---|---|
| `a2ba326b` | Merge PR #339: fix(security): restrict service uploads to provider namespace | 3A.fu.3 |
| `9e6cb2a7` | Merge PR #338: fix: validate bookingId UUID in message routes | 3A.fu.2 |
| `46483ac5` | docs: add Sprint 3-A security remediation retrospective | 3-A closure |
| `30052a37` | Merge PR #337: fix: prevent upload path traversal (C3) | 3-A C3 |
| `3b0f0b01` | fix: allow booking for customers with existing relationship | 3-A C2.3 hotfix |
| `584a4d68` | fix(security): C2.2 surface CUSTOMER_NOT_LINKED as 403 in series and manual routes | 3-A C2.2 |
| `1e65298f` | test(security): C1.4 verify booking-service fails closed on GhostUserError | 3-A C1.4 |
| `8c9ee9fa` | fix(security): reject push token ownership conflicts | 3-A C4 |
| `d3467e83` | docs(security): add sprint continuity and re-entry guide | Continuity |
| `ee039de5` | docs(security): close hardening sprint with audit and roadmap | Slice 1+2 closure |
| `a42a81c6` | test(payment): lock in ownership invariant | S-8 |
| `ccce1df5` | fix(admin): redirect anonymous admin access to login | S-4 hotfix |
| `7639a4d2` | fix(admin): guard admin UI server-side | S-4 |
| `a3a1be26` | fix(demo): close demo bypass surfaces | Slice 1 (S-2+S-7+S-10+S-13) |
| `d9dc2063` | fix(demo): block outbound emails in demo mode | Slice 0 (förberedande) |
| `a47ef40b` | docs(demo): add provider demo capability audit | Slice 0 (audit) |

**Alla commits på `staging`-branch. Inga på `main`.** Inga prod-deploys utfärdade.

## 3. Open Security Backlog

### Sprint 3-A follow-up — kvarvarande slices

| # | Tema | Severity | Effort | Priority |
|---|---|---|---|---|
| **3A.fu.4** | Sanera `Upload.originalName` (truncate + strip control chars + null bytes) | MEDIUM | 30 min | Defense-in-depth, ingen känd exploit |
| **3A.fu.5** | Bucket-parity prod ↔ staging för `equinet-uploads` (5 MB limit + MIME-restrict) | MEDIUM | 10 min ändring + verifiering | **TOUCHES PRODUCTION** — kräver godkännande + fönster |
| **3A.fu.6** | Dev-fallback fail-loud i NODE_ENV=production | LOW | 20 min | Hygien |

### Övriga öppna fynd (från fixes.txt och tidigare audits)

| # | Tema | Severity | Effort | Priority |
|---|---|---|---|---|
| **Sprint 3-B (H1, H4, H7, H10)** | HIGH-fynd från fixes.txt — separat sprint enligt remediation-backlog | HIGH | 5h | **BLOCKER** för prod-merge |
| **Sprint 3-C (H2, H3, H5, H6, H8, H9, M11)** | Defense-in-depth pass | HIGH/MED | 9h | Innan publik demo eller prod-launch |
| **S-1** | AI cost-control — per-user daily token budget med Redis-counter | HIGH | 4-6h | **BLOCKER** för publik demo eller prod |
| **S-3** | Per-user AI rate-limit alongside IP-limit | HIGH | 3-4h | **BLOCKER** för publik demo eller prod |
| **Manuell-1** | Riktig admin → `/admin` flow live-test | — | 5 min | **BLOCKER** för prod-merge |
| **Manuell-2** | MFA 16-min-timeout live-test som admin | — | 20 min | **BLOCKER** för prod-merge |
| **Manuell-3** | Stripe live-flow verification med test-kort | — | 30 min | **BLOCKER** för Stripe-aktivering |
| Observability-1 | AI-kostnadskoppling till user (dashboard + larm) | — | 4-6h | **RECOMMENDED** före publik demo |
| Observability-2 | Abuse-monitoring / anomaly-detection | — | Separat sprint | RECOMMENDED |
| S-9 | Cron Vercel-header-validering | LOW | 30 min | LATER (quick win) |
| S-11 | CustomerInsight prompt-injection delimiters | LOW | 1h | LATER |
| S-12 | Root-HTML wildcard CORS undersökning | LOW (INFO) | 30 min | LATER |
| S-5 | `withApiHandler`-migrering av 139 routes | MEDIUM | Spår | LATER (kontinuerligt) |
| Prod-hardening | Pre-prod-merge checklista (8 punkter) | — | 1-2h verifiering | **BLOCKER** för prod-launch |

### Öppna beslut som kräver produktägar-beslut

1. **När ska Slice 3 (S-1 + S-3) startas?**
   - Trigger: publik demo, AI-kostnader >50 USD/dag, Stripe live, prod-launch
   - Effort: ~10-13h om paketerat som en sprint
2. **När ska `staging` mergas till `main`?**
   - Detta är ett separat beslut från Slice 3. Slice 1+2 fixarna kan gå live i prod utan Slice 3.
   - Risk: Slice 1+2 har konfig-skydd (`NEXT_PUBLIC_DEMO_MODE=false` i prod) som gör demo-guards no-op i prod. Säkert att merga.
   - Manuell-1/2/3 bör köras före merge.
3. **Ska observability-sprinten köras före eller efter Slice 3?**
   - Efter S-1: enklare att bygga AI-kostnad-dashboard ovanpå Redis-counter från S-1.
   - Före S-1: ger baseline-data om nuvarande AI-användning.
4. **Ska vi köra OWASP ZAP regression nu?**
   - Senaste rapport: 2026-03-29. Skulle visa om Slice 1+2 fixerat tidigare fynd och om nya introducerats.
   - Inte gjort som del av denna sprint.

## 4. Environment Status

| Aspekt | local/dev | staging | production |
|---|---|---|---|
| **Slice 1+2-fixar** | I koden (om brancha `staging`) | ✅ Live (commit `ee039de5`) | ❌ **INTE deployad** (main ej mergad) |
| **`NEXT_PUBLIC_DEMO_MODE`** | typisk `true` | `true` (permanent) | **`false`** |
| **Resend (email)** | Mock-mode (ingen key) | Sätt men demo-blocker fångar | Aktiv |
| **APNs (push)** | Saknas | Saknas (push-blocker fångar ändå) | Aktiv för iOS-app |
| **Stripe** | `sk_test_...` | Test-nycklar | Live-nycklar |
| **Anthropic** | Dev-key | Staging-key | Prod-key |
| **Supabase** | Lokal CLI | `zzdamokfeenencuggjjp` Frankfurt | `xybyzflfxnqqyxnvjklv` Zurich |
| **Custom Access Token Hook** | — | Installerad | Installerad |
| **RLS-policies** | Lokal migrations | Live | Live |
| **Robots indexering** | — | `Disallow: /` | `Allow: /` |
| **Admin RSC-guard** | I koden | Aktiv | ❌ Inte deployad |
| **Hidden routes redirect** | I koden (om DEMO_MODE) | Aktiv | ❌ Inte deployad (irrelevant utan DEMO_MODE) |

### Vad som INTE ska kopieras mellan miljöer

- `NEXT_PUBLIC_DEMO_MODE=true` till prod — bryter alla riktiga flöden
- Supabase-credentials mellan projekt — olika RLS-config
- Anthropic API-key — demo-trafik räknas mot prod-budget om kopierad
- Stripe live-secret till staging — katastrofal feldebitering
- `CRON_SECRET` mellan miljöer — replay-attack-yta
- Seed-data (Erik Järnfot m.fl.) — säkerhetsläckage om i prod
- Demo `app_metadata.isAdmin` — ska aldrig vara `true` för demo-personas

### Vad som BÖR synkas mellan miljöer

- Säkerhets-headers (`next.config.ts`)
- RLS-policies (via migrations)
- API-route-mönster (`withApiHandler`)
- Feature-flag DEFINITIONS (men inte values — overrides är miljöspecifika)
- Demo-blocker-logiken (men `isDemoMode()` är environment-gated)

## 5. Architectural Learnings

### Patterns som fungerade bra (behåll och replikera)

| Pattern | Var | Varför |
|---|---|---|
| `isDemoMode()` tidig-exit i service | Email, push, delete-customer | En central env-check, ~6 rader per guard. Symmetriskt. |
| `isDemoModeWithFlags()` server-side redirect | 6 provider-pages | Konsekvent. Server-RSC eller client-effect — båda fungerar. |
| `withApiHandler({ auth, rateLimit, featureFlag, schema })` | 43 routes | Centraliserad auth + rate-limit + audit. Förenklar review. |
| Atomisk WHERE i repository | `findBookingForPayment(id, customerId)` | IDOR-omöjligt på SQL-nivå. |
| RSC layout-guard | `src/app/admin/layout.tsx` | Server-rendering blockerar UI innan client-hydration. Hindrar CDN-cache-läckage. |
| Defense-in-depth (4 lager) | Auth → rate-limit → ownership → RLS | Varje lager självständigt. Bug i ett ger inte total bypass. |

### Duplicering nära tröskelvärde

| Pattern | Förekomster | Centraliseringskandidat? |
|---|---|---|
| `isDemoMode()` tidig-exit | 3 | Vid 5+ → överväg `demoGuard()`-wrapper |
| `useEffect(redirect)` client demo-redirect | 6 | Vid 7-8+ → extrahera `useDemoRedirect(target)`-hook |
| Manuell `auth() + null-check` i routes | ~139 | Pågående migrering (S-5) |

**Inget refaktor-arbete gjort.** Dokumenterat för framtid.

### Release engineering insights

- **Staging isolation** — separat Vercel + Supabase + custom domain gjorde rollback trivial. Inga "preview deploy"-koreografi krävdes.
- **Read-only audit-first workflow** — sparade ~4h implementation (S-6 var redan klar, S-8 behövde bara test).
- **Små sub-slices (15-30 min)** — snabb feedback-loop, lätta att rulla tillbaka individuellt. S-4-hotfixen kunde rättas på <30 min utan att rulla tillbaka resten.
- **Pattern-återanvändning > nya patterns** — email-blocker-mönster återanvänt till push-blocker. Reviews-redirect-mönster återanvänt till 5 nya pages.
- **Pre-push hook detekterar docs-only commits** — sparar test/typecheck/lint-tid vid dokumentationspushar.

## 6. Recommended Next Sprint

### Tre möjliga val (uppdaterad 2026-05-18 efter Sprint 3-A + 3-A follow-up HIGH)

| Val | Vad | Effort | När det är rätt |
|---|---|---|---|
| **A** | Fortsätt Sprint 3-A follow-up: 3A.fu.4 originalName-sanering | ~30 min | Om du vill stänga MEDIUM-watch-items innan kontextbyte. Lågrisk slice, minimal-diff |
| **B** | Pausa remediation, kör retro för Sprint 3-A follow-up | ~30-60 min | Om du vill konsolidera lärdomar från 3 follow-up-slices innan nästa fas. Naturlig pause-point |
| **C** | Gå vidare till Sprint 3-B (H1, H4, H7, H10 HIGH-fynd från fixes.txt) | 5h | Om prod-merge planeras nästa. Detta är BLOCKER för prod enligt remediation-backlog |

**Default-rekommendation:** **Val B (retro)** — vi har genomfört 3 slices över olika domäner (bucket-infra, message-routes, upload-ownership) och en retro fångar process-lärdomar (post-3A scope-naming, MCP-target-säkerhet, smoke-via-Playwright-mönster) som annars förfaller. 3A.fu.4-6 har låg risk att förfalla; H1-H10 har sin egen sprint-plan i remediation-backlog.

### Sprint 3-D (AI cost-control och observability, original Slice 3, om triggas)

**Mål:** Stänga AI cost-abuse-yta + grundläggande observability för att möjliggöra publik demo eller prod-launch.

**Scope:**

| Slice | Effort | Vad |
|---|---|---|
| 3.1 | 4-6h | S-1: Per-user daily token budget med Upstash Redis-counter. 429 vid överskridning. Admin override. |
| 3.2 | 3-4h | S-3: Per-user rate-limit alongside IP-limit för AI-routes. |
| 3.3 | 2h | Circuit-breaker vid Anthropic 5xx (open circuit i 60s vid 5+ fel). |
| 3.4 | 1-2h | Anomaly-larm via Slack/email vid AI-kostnad > tröskelvärde. |

**Total effort:** ~10-14h.

### Rekommenderad slice-ordning

1. **3.1 först** — Redis-counter är fundamentet. Snabb 429-respons hindrar mest skada.
2. **3.2 parallellt eller direkt efter** — Kompletterar IP-limit.
3. **3.3 sist** — Värdefull men inte BLOCKER.
4. **3.4 separat** — Kan göras parallellt eller efter 3.1-3.2.

### Verifieringsstrategi

| Test | Metod |
|---|---|
| Per-user budget triggar 429 | Mock Redis, fake user med >tröskel tokens, anrop AI-route, förvänta 429 |
| Admin bypass:ar budget | Mock admin-user, anropa AI med stor body, förvänta 200 |
| Tröskel-konfig via env | `AI_DAILY_TOKEN_CAP=100` → 100-token request blockas |
| Circuit-breaker | Mock Anthropic 5xx 5x, förvänta 503 i 60s |
| Larm-test | Manuell triggning, verifiera Slack-meddelande |

### Uppskattad risknivå

- Implementation: LÅG-MEDIUM. Redis-counter är väletablerat pattern.
- Regression: LÅG. AI-routes är feature-flaggade och har feature-gate som primär.
- Operations: MEDIUM. Behöver Redis-instans (finns redan i staging för rate-limit).

### Alternativ sprint — Pre-prod-hardening (kortare)

Om Slice 3 skjuts upp men prod-merge behövs:

1. Manuell-1, Manuell-2, Manuell-3 (~1h totalt)
2. OWASP ZAP regression mot staging (~30 min)
3. Pre-prod-merge checklista (~1h)
4. PR `staging` → `main` (~30 min planning, manuell merge)

**Total effort:** ~3-4h. Inga nya kod-ändringar — endast verifiering och deploy.

## 7. Explicit Non-Goals

Detta dokumenteras explicit för att framtida sessioner inte ska föreslå dessa utan beslut:

| Vad vi INTE gjorde | Varför |
|---|---|
| **Ingen `staging` → `main` merge** | Slice 1+2 är säkra för prod, men ingen brådska. Beslut väntar på prod-launch eller demo-mognad. |
| **Ingen central guard-architecture-refactor** | Duplicering finns men under centraliseringströskel. "Premature abstraction" risk. |
| **Ingen AI cost-control (Slice 3) implementation** | Avgränsad scope — låg risk i staging med trusted testers. |
| **Ingen `withApiHandler`-massmigrering** | 139 routes är spår över sprintar, inte enstaka task. |
| **Ingen observability-infra (dashboards/alarm)** | Värdefullt men kräver egen sprint. Loggar finns för manuell granskning. |
| **Ingen big-bang auth-refactor** | Trots att middleware+layout har överlapp — vi accepterar defense-in-depth utan att förenkla. |
| **Ingen ändring av rate-limit-arkitektur** | IP-baserad fungerar för staging. Per-user kräver Slice 3. |
| **Ingen prompt-injection-hardening (S-11)** | Output Zod-validerad → låg-risk. LATER. |
| **Ingen external pentest** | Bör beställas före prod-launch men inte del av denna sprint. |
| **Ingen production deployment av Slice 1+2** | Avsiktligt — `staging` är säker testbädd för fixarna före prod. |

## 8. Re-entry Instructions

> **2026-05-18 OMVÄRDERING:** `fixes.txt`-auditen har identifierat 4 CRITICAL-fynd (C1-C4). Sprint 3-A (C1-C4 hotfixes) är nu nästa rekommenderade sprint, **före** original Slice 3 (AI cost-control). Re-entry-instruktionerna nedan är uppdaterade.

### Steg 1 — Orientering (10 min, utökad efter fixes.txt)

Läs dessa filer i exakt denna ordning:

1. **`docs/security/fixes.txt`** — auktoritativ för core application security (C1-C4 + H1-H10 + M1-M14 + L1-L11). **Läs först** eftersom den åsidosätter tidigare maturity-bedömning.
2. **`docs/security/remediation-backlog-fixes-txt-2026-05.md`** — sprintplan Sprint 3-A till 3-E baserat på fixes.txt.
3. **Denna fil** (`security-sprint-continuity-2026-05.md`) — får dig till nuvarande status och re-entry-process.
4. `docs/security/sprint-closure-2026-05.md` — uppdaterad maturity (INTERNAL TESTERS ONLY) och triggers.
5. `docs/security/security-hardening-sprint-backlog.md` — korsreferens-tabell mellan S-numrering och fixes.txt C/H/M/L.

**Skippa** vid första re-entry:
- `staging-security-audit-2026-05.md` (480 rader, mest historiskt fynd-arkiv över demo-yta — Addendum 2026-05-18 förklarar scope-skillnad)
- `slice-1-2-retro.md` (140 rader, retro av redan-gjort arbete)

Läs dem bara om något fynd är oklart.

### Steg 2 — Verifiera branch och status

```bash
git checkout staging
git pull origin staging
git log --oneline -7   # senaste ska vara ee039de5 (eller nyare)
git status              # ska vara clean eller bara icke-security-relaterade ändringar
```

**Vid avvikelse:**
- Om `main` har mergats till `staging` sedan 2026-05-18: kolla att inga Slice 1+2-commits revertats.
- Om security-relaterade filer har modifierats sedan: identifiera vem och varför innan du fortsätter.

### Steg 3 — Snabb staging health-check

```bash
# Verifiera att Slice 1+2-fixarna fortfarande är live
curl -s https://equinet-staging.johanlindengard.com/robots.txt
# Förvänta: User-Agent: * \n Disallow: /

curl -s -o /dev/null -w "%{http_code}\n" --max-redirs 0 https://equinet-staging.johanlindengard.com/admin
# Förvänta: 307 (eller 200 om cache; kör med -H 'Cache-Control: no-cache')
```

Om något inte matchar: NÅGOT HAR HÄNT. Stoppa, undersök git log, kanske revert-commit gjord.

### Steg 4 — Bestäm scope för session

**DEFAULT efter fixes.txt-audit (2026-05-18):** Nästa sprint bör vara **Sprint 3-A (C1-C4 hotfixes)** om någon av dessa triggers gäller:

- Externa testare ska få tillgång till staging
- Staging → main merge planeras
- Påvisad eller misstänkt exploitation av C1-C4

**Frågor att ställa Johan vid återupptagande:**

1. Är extern testare-tillgång eller publik demo planerad? → **Sprint 3-A först**
2. Är prod-merge planerad? → **Sprint 3-A + 3-B först**, sedan pre-prod-hardening
3. Är Stripe live-flow planerat? → **H10 i Sprint 3-B**
4. Är någon AI-kostnadsspik observerad? → Sprint 3-D (S-1, S-3)
5. Bara underhåll? → OWASP ZAP regression mot staging

Beroende på svar:
- **Sprint 3-A** (default) → läs `remediation-backlog-fixes-txt-2026-05.md` § Sprint 3-A.
- **Sprint 3-B/C** → samma doc, följande sektioner.
- **Sprint 3-D (AI cost)** → ursprunglig plan i `sprint-closure-2026-05.md` § 6.
- **Pre-prod-hardening** → kräver Sprint 3-A + 3-B klara först.

### Steg 5 — Risker att förstå INNAN ny implementation

| Risk | Detalj |
|---|---|
| **C1-C4 från fixes.txt är OPEN och exploitable av authenticated provider** | Innan extern tillgång eller prod-merge: Sprint 3-A krävs. Se `fixes.txt` rader 12-54. |
| **Slice 1+2 är endast på `staging`-branch** | Före prod-launch krävs `staging` → `main` merge. Men inte före Sprint 3-A. |
| **Erik Järnfot demo-persona finns bara i staging-Supabase** | Om en future fix antar att Erik existerar i prod — den gör inte det. |
| **`NEXT_PUBLIC_DEMO_MODE` är permanent `true` i staging** | Demo-guards är inte regression-testade i staging — testa alltid båda env-värden lokalt. |
| **AI-kostnader är inte rate-limitat per user** | Om Sprint 3-D inte är gjord och du ska implementera nytt AI-feature: lägg cost-cap från början, vänta inte. |
| **`requireAdminRole` har 6 befintliga tester men M11 fail-open-fall är OPEN** | Innan du föreslår fler MFA-tester, kolla `src/lib/roles.test.ts:170-218`. M11-fixen är trivial (tre rader) — se Sprint 3-C. |
| **Payment ownership är låst i SQL-WHERE för booking-payment** | Men H10, M3, M4 visar att andra payment-ytor saknar samma härdning. |
| **Booking-series accepterar godtycklig customerId (C2)** | Innan du föreslår nytt manual-booking-flöde: läs C2 i fixes.txt först. |
| **`/api/upload` accepterar path-traversal entityId (C3)** | Innan du föreslår nytt upload-flöde: läs C3 i fixes.txt först. |

### Steg 6 — När du startar ny implementation

Följ Slice 1+2-processen:

1. **READ-ONLY analys först** — läs koden, läs befintliga tester, identifiera om fyndet faktiskt är öppet eller redan löst.
2. **Presentera plan innan kod** — diff-storlek, verifierings-steg, rollback.
3. **Implementera en sub-slice i taget** — 15-30 min implementation, verifiera, gå vidare.
4. **Verifiera lokalt med `npm run check:all`** — alla 4 gates gröna före commit.
5. **Committa enskilda sub-slices** — undvik big-bang commits.
6. **Pusha till staging för deploy-verifiering** — innan merge till main.
7. **Manuell staging-verifiering med curl/Playwright/runtime logs** — bekräfta deploy och funktion.
8. **Uppdatera backlog + retro + closure** — håll continuity-dokumentationen levande.

---

## Snabb-länkar

- **Audit (varför vi fixade det vi fixade):** [`staging-security-audit-2026-05.md`](staging-security-audit-2026-05.md)
- **Vad som gjordes (kronologisk retro):** [`slice-1-2-retro.md`](slice-1-2-retro.md)
- **Maturity-status och triggers:** [`sprint-closure-2026-05.md`](sprint-closure-2026-05.md)
- **Backlog med per-slice-status:** [`security-hardening-sprint-backlog.md`](security-hardening-sprint-backlog.md)
- **Tidigare audits/pentests:** `pentest-2026-04-post-migration.md`, `PENTEST-REPORT-2026-02-27.md`, `pentest-2026-02-15.md`
- **RLS:** `rls-findings.md`
- **MFA admin:** `mfa-admin.md`

---

**Status:** Sprint pausad. Denna fil är levande — uppdatera vid varje sprint-event (start, paus, slut).
