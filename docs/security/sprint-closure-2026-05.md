---
title: Security Hardening Sprint — Closure och Roadmap 2026-05
description: Sprint-stängning för Slice 1+2 av Security Hardening Sprint 2026-05. Definierar nuvarande demo-maturity, kvarstående arbete per miljö, arkitektur-observationer och triggers för nästa sprint.
category: security
status: active
last_updated: 2026-05-18
tags:
  - security
  - sprint
  - closure
  - roadmap
  - demo-maturity
related:
  - security-hardening-sprint-backlog.md
  - slice-1-2-retro.md
  - staging-security-audit-2026-05.md
  - ../operations/demo-audit-2026-05-14.md
sections:
  - Current Maturity
  - Vad som fortfarande återstår
  - Miljöperspektiv
  - Security architecture observations
  - Release engineering lessons learned
  - Rekommendation framåt
---

# Security Hardening Sprint — Closure och Roadmap 2026-05

**Datum:** 2026-05-18 (uppdaterad efter fixes.txt-audit)
**Sprint-status:** PAUSAD efter Slice 1+2. **Sprint 3-A (C1-C4 hotfixes) är nu nästa rekommenderade sprint, ej längre Slice 3 (AI cost-control).**
**Branch:** `staging` (synkad). Inga merges till main/prod.

## Current Maturity

> **2026-05-18 OMVÄRDERING — se `fixes.txt` och `remediation-backlog-fixes-txt-2026-05.md`.**
> Ny djupaudit `fixes.txt` identifierade 4 CRITICAL-fynd (C1-C4) som är exploitable av varje authenticated provider, inklusive externa testare. Tidigare bedömning "TRUSTED EXTERNAL TESTER READY" var baserad på min demo-yta-audit som inte täckte core provider-write-paths. Maturity nedgraderas till **INTERNAL TESTERS ONLY** tills C1-C4 är fixade.

### Demo Maturity Level

**Staging är nu:** **INTERNAL TESTERS ONLY**

| Vad detta betyder | Vad detta INTE betyder |
|---|---|
| ✅ Anställda + designpartners under NDA kan använda staging för funktionell verifiering. | ❌ External tester ready — `fixes.txt` C1-C4 är exploitable av varje authenticated provider. |
| ✅ Demo-mode-bypass-ytor stängda (S-2/S-7/S-10/S-13). | ❌ Public internet hardened — saknar CSRF, CSP-nonces, full upload-validering. |
| ✅ Admin UI-information-disclosure stängd (S-4). | ❌ Production-grade secure — kräver hela Sprint 3-A/B/C före main-merge. |
| ✅ Payment ownership-invariant låst (S-8). | ❌ Account-takeover-säkert — C1 ghost-user collision tillåter hijack. |

### Var vi inte är (uppdaterad 2026-05-18)

- **External tester** — kräver **Sprint 3-A** (C1-C4 hotfixes) först. Externa testare med eget provider-konto kan idag exploitera C1 (account takeover), C2 (fake bookings för annan user), C3 (path traversal upload), C4 (push hijack).
- **Public demo** — kräver Sprint 3-A + 3-B + 3-D (AI cost-control).
- **Production-launch-redo** — kräver Sprint 3-A + 3-B + 3-C + manuell verification + OWASP ZAP regression.
- **Multi-tenant skalbart** — per-tenant rate-limit och kvotering finns inte.

## Vad som fortfarande återstår

### Säkerhetsarbete — uppdaterad 2026-05-18

**BLOCKER (Sprint 3-A — före allt annat):**

| # | Tema | Källa | Effort |
|---|---|---|---|
| **C1** | Ghost-user email collision → account takeover | fixes.txt | 1-2h |
| **C2** | Booking-series godtyckligt customerId | fixes.txt | 1-2h |
| **C3** | Upload path traversal | fixes.txt | 2-3h |
| **C4** | Device-token hijack via blind upsert | fixes.txt | 1h |

**HIGH (Sprint 3-B):**

| # | Tema | Källa | Effort |
|---|---|---|---|
| **H1** | route-orders GET utan ownership-filter | fixes.txt | 30 min |
| **H4** | CSRF Origin-check i `withApiHandler` | fixes.txt | 1h |
| **H7** | Stale JWT admin window vid demotion | fixes.txt | 2h |
| **H10** | PaymentIntent saknar customer:-binding | fixes.txt | 1-2h |

**Defense-in-depth (Sprint 3-C):**

H2, H3, H5, H6, H8, H9, M11 — se `remediation-backlog-fixes-txt-2026-05.md`.

**Tidigare prioriterad (Sprint 3-D — skjutet efter 3-A/B/C):**

| # | Tema | Severity | Effort |
|---|---|---|---|
| S-1 | AI cost-control — per-user daily token budget + alarm | HIGH | 4-6h |
| S-3 | Per-user AI rate-limit (kompletterar IP-limit) | HIGH | 3-4h |

**Hygien (Sprint 3-E):**

S-5, S-9 (=H6), S-11, S-12 från min audit + M1-M14, L1-L11 från fixes.txt.

### Operationell verifiering (manuell)

| # | Vad | Varför ej automatiserat |
|---|---|---|
| 1 | Riktig admin loggar in → `/admin` flow | Kräver admin-credentials, inte demo-konto |
| 2 | MFA 16-min-timeout live-test som admin | Kräver att vänta 16 min med riktig session, inte automation-vänligt |
| 3 | Stripe live-flow verification | Kräver Stripe-test-konto + manuell betalning + webhook-trace |

### Observability gaps

| Område | Status idag | Vad som saknas |
|---|---|---|
| Demo-blocker-loggar | `[DEMO_EMAIL_BLOCKED]`, `[DEMO_PUSH_BLOCKED]`, `[DEMO_DELETE_BLOCKED]` i Vercel runtime logs | Inget aggregerat dashboard/alarm — manuell log-grep krävs |
| AI-kostnad per provider | Anthropic-fakturan endast i Anthropic-dashboard | Ingen koppling till våra users — kan inte se "vem orsakade $X den dagen" |
| Admin audit-log | `AdminAuditLog`-tabell skrivs vid admin-routes via `withApiHandler` | Ingen UI för granskning, ingen retention-policy, ingen alarm vid anomali |
| Rate-limit-throttling | `RateLimitServiceError` → 503 loggas | Ingen aggregering över tid — kan inte se "user X hits limit ofta" |
| Abuse-monitoring | — | Helt frånvarande. Ingen anomaly-detection, ingen IP-reputation, ingen device-fingerprinting |

### AI-cost anomaly detection (specifikt)

Ingen monitoring finns. Idag är ENDA varning:
- Anthropic-dashboardens manuella check
- Stripe-faktura vid månadsslut

Rekommendation: vid Slice 3 (eller efter), implementera daily token-counter per user i Redis + larma om någon överskrider tröskel. Behöver inte vara automatiserat alarm — Slack/email räcker.

## Miljöperspektiv

### Översikt per miljö

| Aspekt | local/dev | staging | production |
|---|---|---|---|
| **NEXT_PUBLIC_DEMO_MODE** | typiskt `true` | `true` (permanent) | **`false`** |
| **Resend API key** | Tom/mock → mock mode | Sätt men blockad av demo-blocker | Aktiv — riktiga mail skickas |
| **APNs credentials** | Saknas typiskt | Saknas typiskt (push-blocker fångar) | Aktiv för iOS-prod-app |
| **Stripe nycklar** | `STRIPE_SECRET_KEY=sk_test_...` | Test-nycklar | Live-nycklar (separat) |
| **Anthropic API key** | Personlig dev-key | Delad staging-key | Separat prod-key |
| **Supabase-projekt** | Lokal supabase CLI | `zzdamokfeenencuggjjp` (Frankfurt) | `xybyzflfxnqqyxnvjklv` (Zurich) |
| **Custom Access Token Hook** | — | Installerad | Installerad |
| **RLS-policies** | Lokala migrations | Live | Live |
| **`disable_emails` runtime flag** | Default false | Påverkas av demo-blocker | Default false |
| **Robots indexering** | — | `Disallow: /` (efter S-10) | `Allow: /` (efter S-10 — påverkas inte i prod) |
| **Admin layout-guard** | Aktiv (efter S-4) | Aktiv (efter S-4) | Aktiv (efter S-4, men kräver merge till main först) |
| **Demo-redirects (5 hidden routes)** | Aktiva om `NEXT_PUBLIC_DEMO_MODE=true` | Aktiva | Inaktiva (env false) |

### Vad som finns vs saknas per miljö

**local/dev:**

✅ Finns:
- Lokal Supabase CLI med samma RLS som staging
- Demo-mode kan testas genom env-toggle
- Email/push hamnar i mock-mode (ingen riktig leverans)

❌ Saknas:
- Magic bytes-validering på uploads kräver real `file-type`-installation (oftast OK)
- AI-rate-limit-mock (in-memory fallback ger 200/min, 10x större än Upstash)
- Inget motsvar till Vercel runtime logs — bara console

**staging:**

✅ Finns (efter Slice 1+2):
- Alla Slice 1+2 fixes deployade
- Custom Access Token Hook
- RLS deny-all på 21 tabeller med bevistester
- HSTS + CSP + X-Frame-Options DENY + nosniff
- Magic bytes på uploads
- Demo email/push/delete-blocker
- 5 hidden routes redirectar
- Admin RSC layout-guard
- Robots disallow

❌ Saknas:
- S-1 + S-3 (AI cost + per-user rate-limit)
- Observability dashboard
- Abuse-monitoring

**production:**

✅ Finns:
- Custom Access Token Hook (separat instans)
- RLS samma som staging
- Säkerhets-headers samma som staging
- Magic bytes samma
- Cron HMAC-secret (separat värde)

❌ Saknas — **viktigt**:
- **Slice 1+2 fixes är INTE deployade till prod** — alla commits ligger på `staging`-branch, inte mergade till `main`
- S-1 + S-3
- Observability + abuse-monitoring (samma som staging)
- Eventuella prod-specifika gates som inte är applicerbara i staging

### Vad som INTE bör kopieras mellan miljöer

| Aspekt | Risk vid kopiering |
|---|---|
| `NEXT_PUBLIC_DEMO_MODE=true` till prod | Stänger av riktig mail, push, delete — bryter alla prod-flöden |
| Supabase-credentials | Olika projekt, olika RLS-konfig — kopiering ger korrupt data |
| Anthropic API-key | Demo-mode-trafik (om kopierad till prod) skulle räknas mot prod-budget |
| Stripe live-secret | Skulle aktivera live-betalningar i staging — katastrofal feldebitering |
| `CRON_SECRET` | Återanvändning förenklar replay-attack |
| `JWT_SECRET` (Supabase) | Separat per projekt — kopiering bryter auth |
| Seed-data (Erik Järnfot m.fl.) | Demo-användare i prod är säkerhetsläckage |
| Demo `app_metadata.isAdmin`-värden | Ska aldrig vara `true` för demo-personas |

### Vad som bör synkas mellan miljöer

- Säkerhets-headers-konfig (`next.config.ts`)
- RLS-policies (via migrations)
- API-route-mönster (`withApiHandler` etc.)
- Feature-flag-DEFINITIONS (men inte deras värden — overrides är miljöspecifika)
- Demo-blocker-logik (men `isDemoMode()` returnerar olika beroende på env)

## Security architecture observations

### Vad fungerar bra

| Pattern | Var det används | Varför det är bra |
|---|---|---|
| **`isDemoMode()` tidig-exit** | Email, push, delete-customer | En central env-check, varje guard ~6 rader. Lätt att läsa, lätt att granska. Symmetriskt mellan kanaler. |
| **`isDemoModeWithFlags()` server-side redirect** | 6 provider-pages (reviews, export, settings/integrations, voice-log, announcements, route-planning, due-for-service, group-bookings) | Konsekvent pattern. Server-RSC eller client-effect — båda fungerar. |
| **`withApiHandler({ auth, rateLimit, featureFlag, schema })`** | 43 routes | Centraliserad auth + rate-limit + audit. Eliminerar boilerplate. Förenklar review. |
| **Atomisk WHERE i repository** | `findBookingForPayment(id, customerId)` etc. | IDOR-omöjligt på SQL-nivå. Returnerar null vid mismatch — service mappar till 404. |
| **RSC layout-guard** | `src/app/admin/layout.tsx` (S-4) | Server-rendering blockerar UI innan client-hydration. Hindrar CDN-cache-läckage. |
| **Defense-in-depth (lager)** | Auth → rate-limit → ownership → RLS | Varje lager självständigt. Bugg i ett ger inte total bypass. |

### Guards som börjar dupliceras

Vid Slice 1+2 expanderade följande mönster:

| Pattern | Antal förekomster | Centraliseringskandidat? |
|---|---|---|
| `isDemoMode()` tidig-exit i service | 3 (email, push, delete-customer) | Vid 5+ förekomster → överväg `demoGuard()`-wrapper i `withApiHandler` |
| `isDemoModeWithFlags()` + `useEffect(redirect)` i client-pages | 6 (reviews + 5 nya från Slice 1) | Vid 7-8+ → extrahera `useDemoRedirect(target)`-hook |
| `{ where: { id, customerId }}` Prisma-ownership | ~10+ förekomster i hela kodbasen | Befintligt mönster `findByIdForProvider/Customer` — fortsätt migrera till repository-metoder |
| Manuell `auth() + null-check` i routes | ~139 routes utan `withApiHandler` | Pågående migrering (S-5) |

**Beslut för denna sprint:** Ingen refaktor gjord. Mönsterduplicering är inte problem ännu — under tröskelvärdet för centralisering. Att tvinga abstraktion innan vi har 5+ konkreta exempel ger ofta dålig abstraktion ("premature abstraction"). Dokumentera, vänta.

### Framtida centraliseringskandidater

Om framtida slices fortsätter följa Slice 1-mönstren:

1. **`demoGuard()`-decorator** för side-effect-services (email, push, sms, webhooks, AI-cost). Skulle minska antal `if (isDemoMode())` i service-lager.
2. **`useDemoRedirect(target)`-hook** för client-pages. Kollar `demo_mode`-flag och triggar `router.replace`.
3. **`requireOwnership(id, userId, repository.findByIdForX)`** för att standardisera IDOR-pattern. Just nu är pattern olika mellan domäner (atomisk WHERE vs hjälpfunktion).

**Genomför EJ nu.** Lägg som "watch"-tag i refactor-triggers.

## Release engineering lessons learned

### Vad fungerade bra

**Staging isolation:**
- Helt separat Vercel-projekt + Supabase-projekt + custom domain har gjort att vi kunde deploya och verifiera Slice 1+2 utan att riskera prod ens vid bugfixar (S-4 hotfix).
- Ingen "skapa preview-deploy med staging-env"-koreografi behövdes — bara `git push origin staging`.
- Rollback-strategin är trivial: `git revert` på staging-branch + push. Inget koordinerat arbete mot prod.

**Read-only audit först:**
- Audit-fas på 1 dag (2026-05-15) producerade backlog för 5 dagars implementation.
- Discovery att S-6 (MFA) redan var implementerad sparade 2h gissning + implementation.
- Discovery att S-8 (payment ownership) bara behövde regression-test sparade ytterligare 1-2h.
- Sammantaget: ~4h faktisk implementation vs ~8h om vi börjat med kod direkt.

**Små sub-slices:**
- Varje sub-slice 15-30 min implementation + verifiering.
- Snabb feedback-loop: implementation → typecheck → test → review → nästa.
- Misstag (S-4 anonym-redirect) upptäcktes och fixades på <30 min utan att rulla tillbaka något.
- Ingen "big bang"-merge — varje commit deployer för sig.

### Vad kunde gjorts annorlunda

- **Audit-djup:** Audit S-6 och S-8 var "ytlig" (läste service-kod, inte testfiler). Djupare granskning vid analys-fasen sparade implementation-tid men kunde ha gjorts ännu tidigare.
- **S-4 hotfix:** Att separera `!user` (anon) från `!isAdmin` (icke-admin) borde varit i första implementation. Lärdom: vid framtida RSC-guards, alltid lista alla auth-states explicit i pseudokoden innan implementation.
- **Manuell verifiering:** Riktig admin / MFA-timeout / Stripe live har inte verifierats automatiskt. Inte ett akut problem för staging, men bör schemaläggas före prod.

### Process-mönster för framtida security-sprintar

1. **Audit-dag:** Parallella Explore-agenter kartlägger. Producerar backlog.
2. **Plan-fas:** Read-only-analys per sub-slice. Verifiera invariant innan implementation.
3. **Sub-slice:** Pattern-återanvändning > ny pattern. Verifiering efter varje.
4. **Verifiering:** Lokal `check:all` → staging-deploy → curl/Playwright/runtime logs.
5. **Retro:** Sammanfatta vad som säkrats, vad som återstår, manuella checks.
6. **Closure:** Detta dokument — definiera maturity och triggers för nästa.

## Rekommendation framåt

### När nästa security sprint bör göras

**Definitiva triggers (=> kör Slice 3):**

- ✅ Beslut tas att öppna publik demo för okontrollerad trafik
- ✅ AI-kostnader (Anthropic-faktura) stiger oväntat — > 50 USD/dygn
- ✅ Stripe betalflöden ska aktiveras i staging eller prod
- ✅ Beslut tas att merga `staging`-branchen till `main` för produktion-deploy

**Tidigare triggers (=> kör smaller fixar):**

- ⚠️ Ny grupp testare (>10 externa testare med olika kontoer)
- ⚠️ Press-/marknadsföringsbeslut som potentiellt driver oväntad trafik
- ⚠️ Penetrationstest planerad — kör Slice 3 + observability först
- ⚠️ iOS-publik-launch — push-blockern behöver verifieras igen med riktiga APNs-tokens

**Schemalagda triggers (regelbundet):**

- 📅 Månadsvis OWASP ZAP scan (befintliga rapporter i `docs/security/zap-*`)
- 📅 Kvartalsvis full audit (uppdatera `staging-security-audit-*.md`)
- 📅 Dependency-audit via Dependabot (löpande)
- 📅 RLS-bevistester körs i CI vid varje commit (löpande)

### Slice 3 — föreslagen scope om/när det startas

| Sub-slice | Effort | Vad |
|---|---|---|
| 3.1 | 4-6h | S-1 AI cost-control — per-user daily token budget med Redis-counter, 429 vid överskridning |
| 3.2 | 3-4h | S-3 per-user rate-limit alongside IP-limit för AI-routes |
| 3.3 | 2h | Circuit-breaker vid Anthropic 5xx |
| 3.4 | 1h | Anomaly-larm via Slack vid AI-kostnad > tröskelvärde |

**Totalt: ~10-13h. Bör packas som en sprint.**

### Observability-sprint — föreslagen om/när relevant

Inte ett akut behov, men följande luckor är värda en separat dag:

- Dashboard för demo-blocker-loggar
- AI-kostnadskoppling till user (Redis-counter + dashboard)
- Admin audit-log UI för granskning
- Rate-limit-throttling aggregering över tid

**Effort: ~6-8h.**

### Pre-prod-merge checklista

Innan `staging` → `main` mergas och deployas till prod, kör genom:

- [ ] Slice 3 implementerad (eller medvetet skjutet)
- [ ] Manuell admin-verifiering klar (3 punkter från retro)
- [ ] Stripe live-flow verifierat med test-kort
- [ ] OWASP ZAP baseline körd mot staging — inga nya HIGH
- [ ] RLS-bevistest-suite grön
- [ ] Pre-existing lint-warnings (102) granskade — inga säkerhetsrelevanta
- [ ] Demo-mode-overrides bekräftade INTE i prod-env (`NEXT_PUBLIC_DEMO_MODE` ej satt eller `false`)
- [ ] Rollback-plan dokumenterad (vilken commit revertar varje slice)

---

## Status

- **Sprint:** PAUSAD efter Slice 1+2
- **Demo Maturity:** TRUSTED EXTERNAL TESTER READY
- **Branch:** `staging` synkad. Inga merges till `main`.
- **Nästa beslutspunkt:** När en av definitiva triggers utlöses, eller vid beslut om publik demo.

**Inget ytterligare arbete planerat utan ny prompt från Johan.**
