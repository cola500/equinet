---
title: Production Deploy-plan (Workstream E)
description: Separat deploy-plan för Workstream E — merge staging→main → prod-deploy. Pre-checks, exakta merge/deploy-steg, rollback, smoke-test, Go/No-Go. Ingen deploy förrän PO-Go.
category: sprint
status: draft
last_updated: 2026-06-10
tags: [production, deploy, parity, vercel, rollback, smoke-test]
depends_on:
  - docs/sprints/production-relaunch-plan.md
related:
  - docs/sprints/production-migration-apply-plan.md
  - docs/sprints/production-feature-flag-reconciliation-plan.md
  - docs/sprints/production-env-guard-plan.md
  - docs/operations/incident-runbook.md
sections:
  - Scope och status
  - 1. Pre-checks
  - 2. Merge/deploy-steg
  - 3. Rollback
  - 4. Smoke-test
  - 5. Go/No-Go — Workstream E
  - 6. Riskregister
---

# Production Deploy-plan (Workstream E)

> Detaljering av **Workstream E** i [Production Parity-planen](production-relaunch-plan.md).
> **PLAN — ingen deploy** förrän §5 Go/No-Go är grön och Johan ger explicit klartecken.
> Förutsätter A (migrationer ✅), B (flaggor ✅), C (env-guard + prod-env ✅) klara.

## Scope och status

Workstream E = lyft prod-koden till staging-nivå genom att **merga `staging` → `main`**; prod
(`equinet-app`) auto-deployar från `main`.

- `main` HEAD = `c75d17df`; `staging` HEAD aktuell. **staging ~177 commits före main.**
- main är **direkt förfader** till staging → ren historik, **fast-forward-merge, inga konflikter**.
- Enda staging-only-migrationen (`20260608120000_horse_provider_booking_read`) är **redan applicerad
  på prod** (Workstream A). Efter merge: main:s 46 migrationsfiler = prod:s 46 applicerade → **ingen drift**.
- Prod-DB redan migrerad; **detta steg är kod-deploy, ingen migration körs här**.

> **Effekt:** Stänger 177-commit-gapet. Demo-koden följer med men är **av i prod** (flagga `demo_mode=false`
> + `NEXT_PUBLIC_DEMO_MODE=false` bakas in vid denna build). Stripe-betalningar av (`PAYMENT_PROVIDER=mock`,
> `stripe_payments=false`). Detta är **paritet/backup**, inte publik lansering.

## 1. Pre-checks (alla MÅSTE vara gröna före merge)

| # | Check | Hur | Förväntat |
|---|-------|-----|-----------|
| 1 | **Migrationer (A)** | MCP `SELECT count(*)...` mot prod | 46 applied, 0 pending/failed |
| 2 | **Flaggor (B)** | MCP `SELECT ... FROM "FeatureFlag"` | 5 GA på, stable_profiles/demo_mode/stripe_payments av |
| 3 | **Prod-env (C)** | `npm run audit:prod-env:safe` | 9 required `SET`, `PAYMENT_PROVIDER`=mock, `NEXT_PUBLIC_DEMO_MODE`=FALSE, DB-URL:er `SET`, Stripe-block hoppas över |
| 4 | **check-prod-env passerar** | implicit i prod-build (prebuild) | Inga saknade required (mock → Stripe-vars ej krävda) |
| 5 | **CI grön på staging→main-PR** | GitHub Actions | Alla jobb gröna **inkl. E2E + Offline Smoke** (körs på main-PR, till skillnad från staging-PR) |
| 6 | **`migration-from-scratch` grön** | CI-jobb | 46 migrationer applicerar rent på färsk DB |
| 7 | **Rent working tree på main-sidan** | `git status` | Inga ocommittade ändringar |

> Pre-check 1–3 verifierades 2026-06-10. Kör om dem **direkt före** merge (env/flaggor kan ha rörts).

## 2. Merge/deploy-steg

> Prod deployar från `main` automatiskt vid merge. Stegen körs av tech lead/Johan efter Go.

1. **Skapa PR `staging` → `main`:**
   ```bash
   gh pr create --base main --head staging \
     --title "Production Parity: merge staging → main (Workstream E)" \
     --body "Stänger 177-commit-gapet. Migrationer redan på prod (A), flaggor (B) + env (C) klara. Paritet, ej publik lansering."
   ```
2. **Vänta på full CI** (main-PR kör de tunga jobben: E2E + Offline Smoke utöver check:all). **Alla gröna.**
   - Vid rött: STOPP, åtgärda, deploya inte.
3. **Merge** (merge-commit, ej squash — bevara historik):
   ```bash
   gh pr merge <PR> --merge
   ```
   (Fast-forward-historik → ren merge, inga konflikter förväntade.)
4. **Vercel auto-deploy:** `equinet-app` bygger `main`. `prebuild` kör `check-prod-env` (passerar nu).
   Följ bygget i Vercel-dashboarden.
5. **Verifiera deployen:**
   - Rätt commit live (Vercel → Deployments → Production = merge-commit).
   - Build **Ready**, `check-prod-env` loggade OK (Vercel build-logs).
   - `migrate:status`-ekvivalent redan grön (ingen migration i detta steg).

> **OBS prod-firewall:** prod ligger bakom **Vercel Security Checkpoint** (Attack Challenge Mode, 429
> mot automatik). För smoke-test (steg 4) kan det behöva **tillfälligt sänkas** i Vercel → Firewall —
> [Johan-manuellt], återställ efteråt.

## 3. Rollback

Prod-deploy är snabbt reverterbar; DB-ändringar är additiva och kräver normalt ingen rollback.

- **Kod (snabbast):** Vercel → Deployments → föregående Production-deployment → **Promote to Production**
  (eller `vercel rollback <url>`). Direkt revert till föregående build.
- **DB:** migrationerna (A) är **additiva** (nya tabeller/policies). Gammal kod ignorerar dem → **ingen
  DB-rollback behövs** vid kod-rollback. Vid behov: forward-fix-migration (aldrig radera filer).
- **Flaggor:** stäng av en trasig feature via `FeatureFlag`-DB **utan** redeploy.
- **Env:** oförändrat vid rollback (runtime-env läses live; `NEXT_PUBLIC_*` följer den promotade buildens
  bakade värden — en äldre build kan ha annat `NEXT_PUBLIC_DEMO_MODE`).
- Se [incident-runbook.md](../operations/incident-runbook.md) "Rollback-procedurer".

## 4. Smoke-test (direkt efter deploy)

> Förutsätter: prod-firewall tillfälligt sänkt + ett **prod-testkonto** (prod har testdata: 72 bokningar
> / 21 users — bekräfta inloggning finns). Detta är Workstream F-checklistan, fokuserad post-deploy.

- [ ] **Appen bootar** — ingen 500 vid start (DATABASE_URL nu satt → första riktiga prod-runtime).
- [ ] **Login** med prod-konto (INTE demo-seed).
- [ ] **Bokningslista** renderar utan fel.
- [ ] **Dagens rutt** (`/provider/today`) renderar.
- [ ] **Häst/stall-data** syns (RLS-migration 7 applicerad).
- [ ] **Inga 500 från tidigare saknade tabeller** (StripeWebhookEvent, Conversation, Message — nu finns).
- [ ] **demo_mode AV** — ingen demo-UX/demo-knappar (NEXT_PUBLIC_DEMO_MODE=false bakad i denna build).
- [ ] **Betalningar av** — ingen betalningsyta (stripe_payments=false, PAYMENT_PROVIDER=mock).
- [ ] **Loggar rena** — Vercel runtime logs + Sentry inga nya fel efter deploy.
- [ ] **Återställ prod-firewall** (om sänkt).

## 5. Go/No-Go — Workstream E

Deploy får STARTA endast när:
- [ ] Pre-checks 1–7 (§1) gröna — omkörda direkt före
- [ ] Rollback-plan (§3) bekräftad aktuell
- [ ] Prod-testkonto + firewall-plan för smoke (§4) klara
- [ ] **Johan ger explicit klartecken**

Räknas KLAR när:
- [ ] PR `staging→main` mergad, CI var grön
- [ ] Prod-build Ready, `check-prod-env` OK, rätt commit live
- [ ] Smoke-test (§4) grön — inga 500, demo av, betalning av
- [ ] Loggar rena

## 6. Riskregister

| Risk | Sannolikhet | Konsekvens | Mitigering |
|------|-------------|------------|------------|
| CI rött på stor main-PR (177 commits, tunga E2E) | Medel | Blockerar deploy | Åtgärda före merge; deploya aldrig på rött |
| Första riktiga prod-runtime (DATABASE_URL nyss satt) felar | Medel | App bootar ej | Verifiera DB-URL-format (gjort i C); watch logs; rollback redo |
| Vercel Security Checkpoint blockerar smoke | Hög | Kan ej smoke-testa | Sänk Attack Mode tillfälligt [Johan]; återställ efter |
| Saknat prod-testkonto | Medel | Kan ej login-smoke | Bekräfta/återskapa konto före deploy |
| demo-UX läcker i prod trots flagga | Låg | Demo syns publikt | Smoke verifierar; NEXT_PUBLIC_DEMO_MODE=false bakad |
| Merge-konflikt | Mycket låg | Försenar | main är förfader → fast-forward, inga konflikter |
| Prod-data (testdata) exponeras | Låg | — | Fas 0: bedöms testdata; ingen reset/seed |

> **Efter Workstream E:** prod = staging-paritet (deploybar, schema/kod/feature/env, smoke-testad).
> Detta är **inte** publik lansering — Stripe Live, kommersiell lansering m.m. är Post-Parity (Fas 0).
