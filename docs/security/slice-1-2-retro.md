---
title: Security Hardening Sprint — Slice 1+2 Retro
description: Retro och sammanställning av första två slices i Security Hardening Sprint. Vad som säkrats, commits, staging-verifiering, kvarstående manuella checks och topp-risker inför extern demo.
category: security
status: active
last_updated: 2026-05-18
tags:
  - security
  - retro
  - sprint
  - hardening
related:
  - security-hardening-sprint-backlog.md
  - staging-security-audit-2026-05.md
  - ../operations/demo-audit-2026-05-14.md
sections:
  - Sammanfattning
  - Vad som säkrats
  - Commits som ingår
  - Verifiering i staging
  - Manuella checks som återstår
  - Topp-risker kvar inför extern demo
  - Process-observationer
  - Nästa steg
---

# Security Hardening Sprint — Slice 1+2 Retro

**Period:** 2026-05-14 → 2026-05-18 (4 dagar inkl. audit)
**Branch:** `staging`
**Status:** Slice 1 + Slice 2 KLARA, live i staging. Inga merges till main/prod.

## Sammanfattning

Två slices avklarade. Totalt **8 commits** över **5 dagar** har stängt 7 av 12 audit-fynd (S-2, S-4, S-6, S-7, S-8, S-10, S-13). Inga regressions i befintliga flöden. **0 produktionsändringar** för S-6 och S-8 (redan implementerat — invariant-tester och dokumentation tillagda för regression-skydd).

| Slice | Sub-slices | Effort spenderat | Audit-fynd stängda |
|---|---|---|---|
| 1 (demo-bypass-hardening) | 4 | ~2.5h | S-2, S-7, S-10, S-13 |
| 2 (admin/MFA/payment) | 3 | ~1.5h (S-4 + hotfix) | S-4, S-6 (already covered), S-8 |

**Faktisk effort:** ~4h över Slice 1+2 (audit-uppskattning var ~5-8h). Auditen överskattade S-6 och S-8 eftersom djupare granskning visade att kärnan redan var implementerad.

## Vad som säkrats

### Slice 1 — Stänger demo-bypass-ytor

| # | Säkrat |
|---|---|
| S-2 | Voice-Log, route-planning, announcements, due-for-service, group-bookings — alla 5 hidden routes redirectar till `/provider/profile` i demo. Demo-user kan inte längre nå AI-flöden via direkt-URL. |
| S-7 | `[DEMO_PUSH_BLOCKED]` i `PushDeliveryService.sendToUser()` — APNs anropas aldrig i demo. Symmetriskt med email-blocker från Slice 0. |
| S-10 | Staging robots.txt → `Disallow: /` — staging indexeras inte av sökmotorer. |
| S-13 | `DELETE /api/native/customers/[id]` returnerar 403 + `[DEMO_DELETE_BLOCKED]` i demo. Seed-data kan inte raderas av demo-användare. |

### Slice 2 — Admin/auth-härdning

| # | Säkrat |
|---|---|
| S-4 | Ny RSC `src/app/admin/layout.tsx` med server-side `isAdmin`-check. Icke-admin user → `/`. Anonym user → `/login`. Stänger UI-information-disclosure som identifierades i auditen. |
| S-6 | iat-baserad 15-min admin-session-timeout var redan implementerad i `requireAdminRole` med 6 tester (varav 4 specifikt för iat-gränsvärden). Audit-fyndet var false positive. Dokumenterat i backlog. |
| S-8 | `findBookingForPayment(bookingId, customerId)` har atomisk WHERE som blockerar IDOR. Lagt till 2 invariant-tester i `PaymentService.test.ts` som låser ownership-kontraktet mot framtida regression. |

## Commits som ingår

Alla på `staging`-branchen, alla deployade till `equinet-staging.johanlindengard.com`:

| Commit | Beskrivning | Slice |
|---|---|---|
| `a42a81c6` | test(payment): lock in ownership invariant | S-8 |
| `ccce1df5` | fix(admin): redirect anonymous admin access to login | S-4 hotfix |
| `7639a4d2` | fix(admin): guard admin UI server-side | S-4 |
| `a3a1be26` | fix(demo): close demo bypass surfaces | S-2 + S-7 + S-10 + S-13 (Slice 1 paket) |
| `d9dc2063` | fix(demo): block outbound emails in demo mode | Slice 0 (förberedande) |
| `a47ef40b` | docs(demo): add provider demo capability audit | Slice 0 (audit) |

Vercel deployments (alla READY, alla `target: production` på staging-projektet):

| Deploy | Commit | Build-tid |
|---|---|---|
| `dpl_AkPCt8YJ4WNJR9FZyUESsC8yjK7V` | `a42a81c6` | ~98s |
| `dpl_3fVsrF8EKkwn3XuYTP4fYeCdtZ5p` | `ccce1df5` | ~115s |
| `dpl_BcKEzrSmbqh47gW1nJbV5HFPXamZ` | `7639a4d2` | 117s |
| `dpl_9hYihusnjj9cPzFNZdKrA1ewrxDB` | `a3a1be26` | 106s |
| `dpl_Cn1Nk1PA6Nsvbie1bFF1mJvvSyun` | `d9dc2063` | 105s |

## Verifiering i staging

| Sub-slice | Verifieringsmetod | Resultat |
|---|---|---|
| S-2 | Playwright: navigera alla 5 hidden routes som Erik | Alla redirectar till `/provider/profile` |
| S-7 | Klicka Acceptera booking → kolla Vercel runtime logs | `[DEMO_PUSH_BLOCKED]` log, 0 `api.push.apple.com`-träffar |
| S-10 | `curl /robots.txt` | `User-Agent: *\nDisallow: /` |
| S-13 | `DELETE /api/native/customers/...` som Erik | HTTP 403 + log, kund kvar i DB |
| S-4 | `curl -L /admin` anonym + Playwright som Erik | Anon → `/login`, Erik → `/` |
| S-6 | (kod-inspektion + befintliga unit-tester) | 6 tester redan i `roles.test.ts` täcker iat-invariant |
| S-8 | `PaymentService.test.ts` + befintliga route-tester | 17 + 23 tester gröna |

**Tester totalt i suite:** 4453 → 4455 (+2 nya invariant-tester från Slice 2). Inga regressions.

## Manuella checks som återstår

| # | Vad | Varför |
|---|---|---|
| 1 | **Riktig admin loggar in → navigerar till `/admin`** | Verifiera att S-4 layout-guarden släpper igenom admin korrekt. Endast Erik (icke-admin) har testats automatiskt. Logga in via vanligt login-flöde, gå till `/admin/users` och `/admin/audit-log` — förvänta full admin-UI utan redirect. |
| 2 | **MFA-timeout-test för riktig admin** | Logga in som admin, vänta 16+ min utan aktivitet, försök göra admin-action → förvänta 401 "Admin-session utgången". |
| 3 | **Stripe-betalningsflöde i staging om `stripe_payments`-flag är på** | S-8 invariant testar bara ownership. Faktisk Stripe-flow med mock-gateway täcks av integration-test, men live Stripe har inte verifierats sedan rotation. |

## Topp-risker kvar inför extern demo

| # | Risk | Severity (audit) | Status | Krävs innan extern demo? |
|---|---|---|---|---|
| **S-1** | AI cost-control saknas (28 800 LLM-anrop/dag/IP möjligt) | HIGH | OPEN | **JA** — Anthropic-fakturan okontrollerad om demo öppnas brett |
| **S-3** | IP-baserad rate-limit för auth AI-routes | HIGH | OPEN | **JA** — kompletterar S-1 |
| S-5 | 139 av 182 routes utan `withApiHandler` | MEDIUM | OPEN | Nej (latent risk) |
| S-9 | Cron-routes saknar Vercel-header-validering | LOW | OPEN | Nej |
| S-11 | CustomerInsight prompt-injection-yta | LOW | OPEN | Nej (output Zod-validerad) |
| S-12 | `access-control-allow-origin: *` på root-HTML | LOW (INFO) | OPEN | Nej (statisk content) |

**Bedömning:** Innan bredare extern demo bör S-1 + S-3 (AI cost-control) implementeras. Övriga fynd är acceptabla för demo men ska adresseras innan production-launch.

## Process-observationer

### Vad fungerade bra

- **Read-only-analys före implementation** — sparade tid genom att hitta att S-6 redan var klar och S-8 bara behövde regression-skydd, inte ny kod.
- **Sub-slice-storlek** — varje sub-slice 15-30 min implementation + verifiering. Snabb feedback-loop.
- **Pattern-återanvändning** — `reviews/page.tsx` → 5 nya redirect-pages, email-blocker-mönster → push-blocker. Konsekvent kod.
- **Staging-isolation** — inga prod-risker eftersom staging-deploy:s gick direkt utan PR/main-merge. Snabbt att verifiera.
- **`isolation: "demo-mode" som env-flag`** — `NEXT_PUBLIC_DEMO_MODE=true` permanent i staging är en bra signal som flera guards kunde lyssna på utan koordination.

### Vad kunde gjorts bättre

- **Audit-djupet** — auditen S-6 och S-8 var "ytlig" (läste bara funktioner, inte testfiler). Djupare granskning vid analys-fasen sparade 4-5h implementation. Lärdom: vid framtida audits, kolla även befintliga tester.
- **Hotfix på S-4 anonymous-redirect** — kunde fångats vid första implementation om jag tänkt på unauth-scenariot uttryckligen. För kommande RSC-layouts: separera `!user` från `!authorized` från första början.
- **Lint-warnings (102 pre-existing)** — bär med sig från tidigare. Inte vår sprint att fixa, men brus i pre-push-output gör det svårare att se nya regressions.

## Nästa steg

**Beslut behövs:**

1. Pausa Slice 3 (AI cost-control S-1 + S-3) tills vi planerar för extern demo, **eller**
2. Fortsätta direkt med S-1 + S-3 som Slice 3 (~10h effort)

Vid alternativ 1: stäng sprinten här, dokumentera i sprint-status, återuppta vid demo-mognadsbeslut.

Vid alternativ 2: börja read-only-analys av:
- AI cost-counter-design (Upstash Redis key-design, daily reset, env-cap)
- Per-user rate-limit-design (parallellt med IP-limit)
- Budget-larm via Anthropic dashboard

**Övriga fynd (S-5, S-9, S-11, S-12)** kan vänta till en framtida sprint eller adresseras opportunistiskt vid annan kontakt med kod.

---

**Sprint-status: Slice 1+2 KLARA. Slice 3 pendar beslut.**
