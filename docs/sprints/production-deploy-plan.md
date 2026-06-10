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

- `main` HEAD = `c75d17df`; `staging` HEAD aktuell. **staging ~179 commits före main.**
- **KORRIGERING (2026-06-10):** main har **divergerat** — 18 commits på main saknas på staging
  (Dependabot-dep-bumpar + README + några kod-commits som staging redan hade). Alltså **inte** en
  fast-forward. Reconcilerat via **merge `origin/main` → `staging`**: 2 triviala konflikter lösta
  (`backlog.md` = stagings hygien-version; `CustomerInsightService.ts` = kosmetisk kommentar, ingen
  funktionell ändring). **Net-delta av reconcile = endast `package.json` + `package-lock.json` (deps)
  + `README.md`.** Efter reconcile: staging→main blir en ren merge utan konflikter.
- Enda staging-only-migrationen (`20260608120000_horse_provider_booking_read`) är **redan applicerad
  på prod** (Workstream A). Efter merge: main:s 46 migrationsfiler = prod:s 46 applicerade → **ingen drift**.
- Prod-DB redan migrerad; **detta steg är kod-deploy, ingen migration körs här**.

> **Effekt:** Stänger 177-commit-gapet. Demo-koden följer med men är **av i prod** (flagga `demo_mode=false`
> + `NEXT_PUBLIC_DEMO_MODE=false` bakas in vid denna build). Stripe-betalningar av (`PAYMENT_PROVIDER=mock`,
> `stripe_payments=false`). Detta är **paritet/backup**, inte publik lansering.

> **Seed-beslut (PO 2026-06-10) — Alternativ C:** prod **demo-seedas inte** i denna sprint och
> prod-seed-guarden lämnas oförändrad. Full stall-/rutt-demo verifieras på **staging**; prod-smoke
> körs mot befintlig prod-testdata (utan stall-data). Se §4. ("Ingen prod seed/reset" i huvudplanens
> §6 Out of scope **kvarstår** — omprövades och bekräftades.)

## 1. Pre-checks (alla MÅSTE vara gröna före merge)

| # | Check | Hur | Förväntat |
|---|-------|-----|-----------|
| 1 | **Migrationer (A)** | MCP `SELECT count(*)...` mot prod | 46 applied, 0 pending/failed |
| 2 | **Flaggor (B)** | MCP `SELECT ... FROM "FeatureFlag"` | 5 GA på, stable_profiles/demo_mode/stripe_payments av |
| 3 | **Prod-env (C)** | `npm run audit:prod-env:safe` | 9 required `SET`, `PAYMENT_PROVIDER`=mock, `NEXT_PUBLIC_DEMO_MODE`=FALSE, DB-URL:er `SET`, Stripe-block hoppas över |
| 4 | **check-prod-env passerar** | implicit i prod-build (prebuild) | Inga saknade required (mock → Stripe-vars ej krävda) |
| 5 | **CI grön på staging→main-PR** | GitHub Actions | check:all-grindar gröna (unit, typecheck, build, lint, migration-from-scratch, security). **KORRIGERING:** E2E + Offline Smoke **SKIPPAS** på staging→main (CI-villkoret skippar tunga Playwright-jobb när `staging` är inblandad) — de kördes på feature-PR:erna in i staging. |
| 6 | **`migration-from-scratch` grön** | CI-jobb | 46 migrationer applicerar rent på färsk DB |
| 7 | **Rent working tree på main-sidan** | `git status` | Inga ocommittade ändringar |
| 8 | **Reconcile klar** | `git merge origin/main → staging` | Konflikter lösta, pushad → PR mergeable (annars validerar CI bara staging-HEAD, ej merge-resultatet) |

> Pre-check 1–3 verifierades 2026-06-10. Kör om dem **direkt före** merge (env/flaggor kan ha rörts).
> **CI-not:** så länge PR:en är `DIRTY` (okonfliktlöst) kör CI mot **staging-HEAD**, inte mot merge-commiten.
> Efter reconcile (pre-check 8) blir merge ren och CI validerar det faktiska resultatet.

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

> **Seed-beslut (PO 2026-06-10) — Alternativ C: prod demo-seedas INTE i denna parity-sprint.**
> Prod-seed-guarden (`assertStagingSeedSafe`) lämnas **oförändrad** (ingen försvagning). Full
> **stall-/rutt-demo verifieras på staging** ([stall-route-provider](../ux/visual-audit/stall-route-provider/README.md), grön).
> Prod-smoke använder **befintlig prod-testdata** och fokuserar på boot/login/rendering/feature-env-sanity.
> Prod har 1 Stable men **0 stall-kopplade hästar** → "Stall: X" visas inte i prod — **förväntat, ej fel**.

**Förutsättningar [Johan-manuellt — kan ej göras av agent]:**
- [ ] **Vercel Attack Challenge Mode AV** under smoke-fönstret (equinet-app → Settings → Firewall →
      Attack Challenge Mode → Off). IP-bypass saknas på planen → toggla av/på. **Slå PÅ igen** direkt efter.
      *(Säkerhetsinställning — agenten ändrar inte firewall.)*
- [ ] **Smoke-persona:** sätt temp-lösenord på **`provider@example.com`** (Lindgrens Hovslageri & Ridskola
      — 12 bokningar, 5 tjänster) via Supabase Auth-dashboard (prod `xybyzflfxnqqyxnvjklv` → Authentication
      → Users). *(Credentials — agenten sätter inte lösenord.)*
- [ ] (valfritt) Admin/kund-check via **`johan@jaernfoten.se`** (admin, din mail).

**Smoke-checklista (agenten verifierar när prod är åtkomligt):**
- [ ] **Appen bootar** — ingen 500 vid start (DATABASE_URL nu satt → första riktiga prod-runtime).
- [ ] **Login** med `provider@example.com`.
- [ ] **Bokningslista** renderar utan fel (12 bokningar finns).
- [ ] **Dagens rutt** (`/provider/today`) **renderar utan 500**.
- [ ] **Inga 500 från tidigare saknade tabeller** (StripeWebhookEvent, Conversation, Message — nu finns).
- [ ] **demo_mode AV** — ingen demo-UX/demo-knappar (NEXT_PUBLIC_DEMO_MODE=false bakad i denna build).
- [ ] **Betalningar av** — ingen betalningsyta (stripe_payments=false, PAYMENT_PROVIDER=mock).
- [ ] **Loggar rena** — Vercel runtime logs + Sentry inga nya fel efter deploy.
- [ ] **N/A — stall-data verifieras EJ på prod** (ingen stall-data); stall-featuren grön på staging.
- [ ] **Återställ Attack Challenge Mode (PÅ).**

## 5. Go/No-Go — Workstream E

Deploy får STARTA endast när:
- [ ] Pre-checks 1–7 (§1) gröna — omkörda direkt före
- [ ] Rollback-plan (§3) bekräftad aktuell
- [ ] Smoke-förutsättningar (§4) klara: Attack Mode-toggle-plan + temp-lösenord på `provider@example.com`
- [x] **Seed-beslut: Alternativ C** (ingen prod-seed, guard oförändrad) — PO 2026-06-10
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
