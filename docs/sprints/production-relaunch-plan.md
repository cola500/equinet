---
title: Production Parity-plan (tidigare "Relaunch")
description: Handlingsbar sprintplan/checklista för att lyfta production till staging-paritet (deploybar, schema/kod/feature/env-paritet, smoke-testad) — INTE publik lansering. Baserad på Production Gap Audit 2026-06-09, PO-beslut 2026-06-10.
category: sprint
status: draft
last_updated: 2026-06-10
tags: [production, parity, relaunch, migration, feature-flags, stripe, deploy]
related:
  - docs/ux/visual-audit/stall-route-provider/README.md
  - docs/architecture/payment-production-readiness.md
  - docs/operations/incident-runbook.md
sections:
  - Fas 0 – Strategiskt beslut
  - Production Goal
  - Bakgrund
  - 1. Sprintmål
  - 2. Viktiga beslut före start
  - 3. Workstream-checklistor
  - 4. Riskregister
  - 5. Go/No-Go
  - 6. Out of scope
---

# Production Parity-plan (tidigare "Relaunch")

> **Status: PLAN — ingen implementation påbörjad.** Detta dokument gör Production Gap
> Audit (2026-06-09) handlingsbart som en avbockbar checklista. Inga ändringar i
> prod/staging, ingen deploy, migration eller seed sker förrän Go/No-Go (§5) är grön.
>
> **2026-06-10:** PO-beslut omdefinierar målet från *publik relansering* till
> **production parity** (se Fas 0 + Production Goal). Titeln behåller "Relaunch" inom
> citat för historik; fokus är nu paritet, inte lansering.

## Fas 0 – Strategiskt beslut

Beslut fattat 2026-06-10 (PO):

- [x] Målet är **production parity**.
- [x] **Inte** publik lansering.
- [x] **Stripe Live senare** (ingår inte i denna sprint).
- [x] **Staging fortsätter vara demo-/testmiljö.**

Konsekvens: prod-data bedöms vara gammal test-/demo-data utan känt affärsvärde (normal
försiktighet gäller ändå). Detta beslut styr scope i resten av planen.

## Production Goal

Production ska uppnå **staging-paritet**. Detta är **inte** en publik lansering.

Målet är:

- schema-paritet
- kod-paritet
- feature-flag-paritet
- env-paritet
- deploybarhet
- smoke-testad miljö

Följande ingår **inte**:

- Stripe Live
- kommersiell lansering
- betalande kunder
- supportberedskap
- marketing launch

> **Paritets-not:** "feature-flag-paritet" = prod matchar stagings effektiva flagg-config,
> med **ett medvetet undantag**: `demo_mode` är **AV i prod** (på i staging, eftersom staging
> är demo-miljön).

## Bakgrund

Production ligger långt efter staging (audit 2026-06-09):

- **Kod:** staging är **160 commits före** main (`aebab08a` vs `c75d17df`).
- **DB:** prod-DB:n står kvar på `20260404150000` (4 april). **7 migrationer saknas.**
  Prod-koden på main refererar tabeller (StripeWebhookEvent, Conversation, Message) som
  **inte finns i prod-DB:n**.
- **Infra:** prod-Supabase (`xybyzflfxnqqyxnvjklv`, Zürich) var pausad fram till 2026-06-09.
- **Flags:** prod-flaggor är stale/felkonfigurerade (`demo_mode=true`, `stable_profiles=true`,
  `stripe_payments=true`; GA-funktioner som `route_planning`/`voice_logging` = false).
- **Data:** prod har 72 bokningar / 7 providers / 21 users av oklart ursprung.

Projekt-referenser:
- Prod Supabase: `xybyzflfxnqqyxnvjklv` (eu-central-2, Zürich)
- Staging Supabase: `zzdamokfeenencuggjjp` (eu-central-1, Frankfurt)
- Prod app: `equinet.johanlindengard.com` (branch `main`)
- Staging app: `equinet-staging.johanlindengard.com` (branch `staging`)

---

## 1. Sprintmål

- Lyfta **production mot staging-paritet kontrollerat**, i ordningen migration → flags → env → deploy → verifiering.
- **Ingen prod-reset.**
- **Ingen demo-seed mot prod.**
- **Normal försiktighet med befintlig prod-data** (72 bokningar / 21 users) — bedöms som gammal test-/demo-data (Fas 0), men backup/PITR tas före migration ändå.
- Varje workstream är avbockbar och reversibel per steg; parity-deploy behandlas som formell go/no-go.

---

## 2. Viktiga beslut före start

**Besvarade av PO 2026-06-10 (se Fas 0):**

- [x] **Prod-data:** Bedöms som **gammal test-/demo-data**, inget känt affärsvärde i att bevara (normal försiktighet gäller).
- [x] **demo_mode på prod:** Ska vara **AV** — staging är demo-miljön, inte prod.
- [x] **Mål:** **Production parity**, inte publik lansering.
- [x] **Stripe live:** Skjuts till **senare slice** (Post-Parity).

> Besluten är tagna. Workstream A–F kan planeras klart, men ingen körning sker förrän
> Go/No-Go (§5) är grön och Johan ger explicit klartecken.

---

## 3. Workstream-checklistor

### A. Prod DB migration sync

> **✅ GENOMFÖRD OCH GRÖN 2026-06-10:** 7/7 migrationer applicerade, 46 applied / 0 failed,
> prod-data oförändrad (Booking=72, Provider=7, User=21), ingen deploy/seed/flag-ändring gjord.
> Fullt utfall i [apply-planen §Utfall](production-migration-apply-plan.md#utfall-körning-2026-06-10).
>
> **Detaljerad körbar apply-plan:** [production-migration-apply-plan.md](production-migration-apply-plan.md)
> (apply-ordning, verifierings-SQL före/efter, backup, risker per migration, rollback, egen Go/No-Go).

**De exakt 7 saknade migrationerna** (finns i repo, ej applicerade på prod; apply-ordning = kronologisk):

| # | Migration | Vad den gör | Kritikalitet |
|---|-----------|-------------|--------------|
| 1 | `20260405000000_admin_audit_log` | AdminAuditLog-tabell | Medel (admin-loggning) |
| 2 | `20260405100000_pg_cron_maintenance` | pg_cron-jobb (token-/notis-cleanup) | Medel |
| 3 | `20260411103204_stripe_webhook_event` | StripeWebhookEvent (dedup-tabell) | **Hög (betalningar)** |
| 4 | `20260418100000_add_conversation_message` | Conversation + Message-tabeller | **Hög (messaging-kod kraschar utan)** |
| 5 | `20260418200000_conversation_rls_policies` | RLS för Conversation/Message | Hög (säkerhet) |
| 6 | `20260419100000_add_message_attachment_fields` | Bilage-fält på Message | Medel |
| 7 | `20260608120000_horse_provider_booking_read` | RLS: leverantör läser häst på egen bokning (stall) | Medel (stall-vyer) |

Checklista:
- [ ] Bekräfta listan ovan mot prod via `migrate:status` / `_prisma_migrations` (förväntat: 39 applied, 7 pending)
- [ ] Fastställ apply-ordning (kronologisk, tabellen ovan)
- [ ] Ta fram verifierings-SQL per migration (tabell-existens + RLS-policy-existens), t.ex.:
  - `SELECT to_regclass('public."StripeWebhookEvent"');` (migration 3)
  - `SELECT to_regclass('public."Conversation"'), to_regclass('public."Message"');` (migration 4)
  - `SELECT policyname FROM pg_policies WHERE tablename='Horse' AND policyname='horse_provider_booking_read';` (migration 7)
- [ ] Ta backup/checkpoint av prod-DB FÖRE (Supabase PITR/backup; dokumentera tidpunkt)
- [ ] Applicera migrationerna i ordning (1→7) via Supabase MCP `apply_migration` eller `migrate deploy`
- [ ] Registrera varje i `_prisma_migrations` med korrekt checksum (om applicerad via MCP)
- [ ] Verifiera `migrate:status` = 0 pending, 0 failed
- [ ] Verifiera nyckeltabeller finns: StripeWebhookEvent, Conversation, Message, AdminAuditLog
- [ ] Verifiera RLS-policies aktiva (Booking, Horse, Conversation)

> **Beroende:** Måste göras FÖRE kod-deploy (E). Prod-koden förväntar redan dessa tabeller.

### B. Feature flag reconciliation

> **✅ GENOMFÖRD OCH GRÖN 2026-06-10:** 8 prod-flaggor reconcilade (5 GA-flaggor PÅ; stable_profiles,
> demo_mode, stripe_payments AV), verifierade i DB, inga andra flaggor påverkade. Full demo-av kräver
> fortfarande C-env (`NEXT_PUBLIC_DEMO_MODE`) + rebuild (E). Utfall i
> [B-planen §Utfall](production-feature-flag-reconciliation-plan.md#utfall-körning-2026-06-10).
>
> **Detaljerad körbar plan:** [production-feature-flag-reconciliation-plan.md](production-feature-flag-reconciliation-plan.md)
> (nuläge prod/staging/default, avsedd parity-config, exakt 8 flaggor att ändra, demo_mode/stripe_payments-särfall, verifiering, Go/No-Go).

**Nuläge per flagga** (DB-värden lästa 2026-06-09; runtime-env `FEATURE_*` i Vercel EJ lästa — verifiera separat):

| Flagga | Prod (DB) | Staging (DB/​default) | Kod-default | Avsedd prod | Not |
|--------|-----------|----------------------|-------------|-------------|-----|
| voice_logging | false | true | true | [ ] | GA-funktion, av i prod |
| route_planning | false | true | true | [ ] | GA-funktion, av i prod |
| route_announcements | false | true | true | [ ] | GA-funktion, av i prod |
| customer_insights | false | true | true | [ ] | av i prod |
| self_reschedule | false | true | true | [ ] | av i prod |
| offline_mode | true | true | true | [ ] | paritet |
| follow_provider | false | false | true | [ ] | medvetet av i båda |
| municipality_watch | false | false | true | [ ] | medvetet av i båda |
| provider_subscription | (default) | (default) | false | [ ] | |
| push_notifications | (default) | (default) | false | [ ] | |
| help_center | true | (default) | true | [ ] | paritet |
| **stable_profiles** | **true** | **false (default)** | **false** | [ ] | **prod PÅ, staging AV — för parity bör prod matcha staging (av), bekräfta** |
| **stripe_payments** | **true** | true | false | [ ] | **Stripe Live = Post-Parity (Fas 0); flagg-state för parity TBD i B** |
| **demo_mode** | **true** | true | false | **av (beslut)** | **AV i prod (Fas 0) — staging förblir demo-miljön** |
| supabase_auth_poc | (default) | (default) | false | [ ] | |
| data_retention | (default) | (default) | false | [ ] | |
| messaging | (default) | (default) | true | [ ] | kräver migration 4–6 applicerad |

**Föräldralösa flagg-rader** (borttagna ur kod, GA 2026-04-25 — rader kvar i DB, ignoreras av kod): `business_insights`, `due_for_service`, `group_bookings`, `recurring_bookings` (staging + prod), samt `customer_invite` (prod). Städa vid tillfälle, ej blocker.

Checklista:
- [ ] Lista prod/staging/default per flagga (tabell ovan — komplettera med Vercel `FEATURE_*`-env)
- [ ] Definiera avsedd prod-config: **parity = matcha stagings effektiva config**, med `demo_mode` som medvetet undantag (av i prod)
- [x] **demo_mode → AV** i prod (beslutat, Fas 0)
- [ ] **stable_profiles** → bekräfta (prod på idag, staging av; för parity bör prod matcha staging = av)
- [ ] **stripe_payments** → flagg-state för parity (Stripe **Live** är Post-Parity per Fas 0; test-mode/mock som staging kan behållas)
- [ ] GA-flaggor (voice_logging, route_planning, route_announcements, customer_insights, self_reschedule) → **på i prod** för parity med staging (bekräfta)
- [ ] Verifiera efter ändring (läs `FeatureFlag`-tabell + `/api/feature-flags`)

### C. Env guard / env docs

> **Detaljerad körbar plan:** [production-env-guard-plan.md](production-env-guard-plan.md)
> (NEXT_PUBLIC_DEMO_MODE-slutförande, check-prod-env-härdning, .env.example-fix, docs/kod vs prod-env, Go/No-Go).
>
> **Status 2026-06-10:** repo-delen (kod + .env.example) levererad i **PR #392** (ej mergad),
> inkl. **löst parity-deploy-blocker** (val A: STRIPE_SECRET_KEY + publishable villkorliga).

- [x] Lägg till `STRIPE_WEBHOOK_SECRET` (villkorligt, `PAYMENT_PROVIDER=stripe`) — **PR #392**
- [x] Lägg till **non-empty/trim-validering** (whitespace-only fångas nu) — **PR #392**
- [x] Rätta `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` i `.env.example` — **PR #392**
- [x] Lägg till saknade env-vars i `.env.example` (`NEXTAUTH_SECRET`, `PAYMENT_PROVIDER`, `MODAL_API_URL`, `FORTNOX_*`, `EDGE_CONFIG`/`EDGE_CONFIG_ID`/`VERCEL_API_TOKEN`, `DISABLE_SW`, `ANALYZE`, `DISABLE_CRONS`, `STAGING_PROJECT`, `NEXT_PUBLIC_DEMO_MODE`) — **PR #392**
- [x] **STRIPE_SECRET_KEY-blockern löst** (val A: villkorliga Stripe-vars) — **PR #392**
- [ ] Verifiera Vercel prod-env via `vercel env pull --environment=production` (särskilt efter pausen): Supabase-URL/keys, `APP_URL`, `DATABASE_URL`/`DIRECT_DATABASE_URL`, Upstash Redis — **[Johan-manuellt]**
- [ ] Sätt `NEXT_PUBLIC_DEMO_MODE` = false/borttagen i prod-env (slutför demo_mode, kräver rebuild i E) — **[Johan-manuellt]**
- [ ] Påminnelse: använd Vercel **REST API** för icke-triviala env-skrivningar (CLI `--value`/stdin sparar tyst tomt)

### D. Stripe / payment readiness — FUTURE SLICE / POST-PARITY

> **Ingår INTE i Production Parity-sprinten** (PO-beslut Fas 0: Stripe Live senare).
> Checklistan behålls som **framtida referens** för när live-betalningar aktiveras — efter
> att produkten fått användarfeedback. Ingen punkt nedan är blockerande för parity.

- [ ] Stripe **företagsverifiering** klar (ägs av Stripe/Johan — hård blocker för live)
- [ ] **Prod webhook-secret** satt i Vercel (webhook registrerad i Stripe prod-konto mot `equinet.johanlindengard.com/api/webhooks/stripe`)
- [ ] **Restricted key** (`rk_`) med least-privilege i stället för `sk_`
- [ ] CSP: lägg till `frame-src https://hooks.stripe.com` (krävs för 3DS/SCA — riktiga EU-kort)
- [ ] **Idempotency key** på `StripePaymentGateway.initiatePayment` (undvik övergivna PaymentIntents)
- [ ] Testa betalningsflöde enligt vald nivå (test-mode räcker om ej live; annars live-kort efter verifiering)
- [ ] Bekräfta webhook-verifiering aktiv (signatur + event-ID-dedup via StripeWebhookEvent — kräver migration 3)

### E. Deploy staging → main/prod

> Får INTE starta förrän A (migrationer), B (flags), C (env-guard) är gröna.

> **✅ PARITY-DEPLOY-BLOCKER LÖST (val A, PR #392):** `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
> gjordes villkorliga (required bara när `PAYMENT_PROVIDER=stripe`). `check-prod-env` blockerar inte längre
> prod-deployen när Stripe är av. Detaljer i [env-guard-planen §2](production-env-guard-plan.md).

- [x] **STRIPE_SECRET_KEY-blockern löst** (val A, PR #392 — väntar merge)
- [ ] CI grön på staging-branchen (`check:all` + E2E mot main-PR)
- [ ] Migrationer applicerade på prod-DB FÖRST (workstream A klar)
- [ ] Feature flags reconcilade (workstream B klar)
- [ ] Env-guard grön + Vercel prod-env verifierad (workstream C klar) — inkl. PR #392 mergad
- [ ] Merge `staging` → `main` (PR, CI grön)
- [ ] Verifiera prod-deploy (rätt commit live, build OK, `check-prod-env` passerade)

### F. Prod smoke-test

- [ ] Login (riktig persona — INTE demo-seed)
- [ ] Bokningslista renderar utan fel
- [ ] Dagens rutt (`/provider/today`) renderar
- [ ] Häst/stall-data syns (RLS-migration 7 verifierad)
- [ ] Betalningar (om enabled) — test/live enligt §2
- [ ] **Inga 500-fel från saknade tabeller** (StripeWebhookEvent, Conversation, Message)
- [ ] Loggar kontrollerade (Sentry/Vercel runtime logs rena efter deploy)

---

## 4. Riskregister

| Risk | Sannolikhet | Konsekvens | Mitigering | Ägare |
|------|-------------|------------|------------|-------|
| Prod-data visar sig ändå vara riktig (bedöms som testdata, Fas 0) | Låg | Medel (dataförlust) | Bedömd test-/demo-data; backup/PITR före migration ändå; ingen reset/seed | Johan |
| Kod deployas utan att migration körts först | Medel | Hög (500-fel, saknade tabeller) | Workstream-ordning A→E; migration-gate före prod-promote; deploy via `deploy.sh` (ej rå `git push`) | Tech lead |
| demo_mode kvar aktiv i prod efter deploy | Hög (är true idag) | Medel (demo-UX i prod; ej publik lansering) | Workstream B: demo_mode→av (beslutat) + verifiering före deploy | Tech lead |
| Stripe Live aktiveras av misstag i parity-sprinten | Låg | Hög (misslyckade betalningar/SCA) | Stripe Live är Post-Parity (Fas 0); D ej i scope; håll live-keys borta från prod | Johan/Tech lead |
| RLS-regression efter migration | Låg | Hög (dataläcka mellan providers) | Verifiera RLS-policies (A) + bevistester; smoke-test stall/bokning (F) | Tech lead |
| Seed-script körs mot prod av misstag | Låg | Kritisk (skriver över prod) | `seed-guard.ts` vägrar prod-ref `xybyzflfxnqqyxnvjklv`; använd ALDRIG legacy `seed-demo.ts` (ingen guard); ingen seed i denna sprint | Tech lead |
| Vercel prod-env tom/fel efter paus | Medel | Hög (app startar ej) | Workstream C: `vercel env pull` verifiering; non-empty-guard | Tech lead |
| Föräldralösa flagg-rader förvirrar config | Låg | Låg | Städa vid tillfälle (ej blocker) | Tech lead |

---

## 5. Go/No-Go

Deploy till prod får ske ENDAST när alla nedan är bockade:

- [ ] Alla **must-have** klara (workstream A, B, C, E, F — D är Post-Parity, ej krav)
- [ ] **Rollback-plan** dokumenterad och aktuell (Vercel promote-tidigare + forward-migration; se `docs/operations/incident-runbook.md`)
- [ ] **Smoke-test-plan** klar (workstream F definierad och redo att köras direkt efter deploy)
- [ ] **Johan godkänner deploy** explicit
- [x] **Prod-data-fråga besvarad** (Fas 0: bedöms testdata; backup/PITR ändå före migration)

---

## 6. Out of scope

Detta ingår INTE i Production Parity-sprinten:

- **Stripe Live / livebetalningar** (Post-Parity, se workstream D)
- **Kommersiell lansering, betalande kunder, supportberedskap, marketing launch**
- Nya features
- Stall-community
- Messaging GA (utöver att applicera redan-mergade migrationer)
- Group bookings GA
- **Prod seed / prod reset**
- Stora refactors (status-label-konsolidering, Checkout Sessions-migrering, MODAL_API_URL-dedup)
- Hydration #418 på Dagens rutt (separat backlog, icke-blockerande)
- Besöksplats-modell / Stall-epic Slice 4

---

> **Nästa steg:** §2-besluten är tagna (Fas 0). Därefter detaljeras workstream A (exakt
> apply-plan med verifierings-SQL) som första körbar slice — men ingen körning förrän
> Go/No-Go är grön och Johan ger explicit klartecken.
