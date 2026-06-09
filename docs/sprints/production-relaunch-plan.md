---
title: Production Relaunch / Parity-plan
description: Handlingsbar sprintplan/checklista för att lyfta production till staging-paritet kontrollerat, baserad på Production Gap Audit 2026-06-09. Ingen implementation förrän PO-godkännande.
category: sprint
status: draft
last_updated: 2026-06-09
tags: [production, relaunch, parity, migration, feature-flags, stripe, deploy]
related:
  - docs/ux/visual-audit/stall-route-provider/README.md
  - docs/architecture/payment-production-readiness.md
  - docs/operations/incident-runbook.md
sections:
  - Bakgrund
  - 1. Sprintmål
  - 2. Viktiga beslut före start
  - 3. Workstream-checklistor
  - 4. Riskregister
  - 5. Go/No-Go
  - 6. Out of scope
---

# Production Relaunch / Parity-plan

> **Status: PLAN — ingen implementation påbörjad.** Detta dokument gör Production Gap
> Audit (2026-06-09) handlingsbart som en avbockbar checklista. Inga ändringar i
> prod/staging, ingen deploy, migration eller seed sker förrän besluten i §2 är tagna
> och Go/No-Go (§5) är grön.

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
- **Skydda befintlig prod-data** (72 bokningar / 21 users) tills beslut om ursprung finns (§2).
- Varje workstream är avbockbar och reversibel per steg; relansering behandlas som formell go/no-go.

---

## 2. Viktiga beslut före start

Dessa MÅSTE besvaras av PO (Johan) innan workstream A–F startar:

- [ ] **Prod-data:** Är de 72 bokningarna / 21 användarna **riktig användardata** eller gammal testdata?
  *(Styr om prod kan röras fritt eller måste bevaras/migreras varsamt.)*
- [ ] **demo_mode på prod:** Var `demo_mode=true` på prod **avsiktligt** (prod användes som demo) eller en stale flagga som ska AV?
- [ ] **Mål:** Är målet **publik lansering** eller **prod som staging-paritet/backup-miljö**?
  *(Avgör hur hårt betalnings-/Stripe-blockaden måste lösas nu.)*
- [ ] **Stripe live:** Ska **Stripe live ingå nu** eller skjutas till senare slice?

> Tills dessa är besvarade: ingen migration, ingen flag-ändring, ingen deploy.

---

## 3. Workstream-checklistor

### A. Prod DB migration sync

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
| **stable_profiles** | **true** | **false (default)** | **false** | [ ] | **prod PÅ, staging AV — beslut** |
| **stripe_payments** | **true** | true | false | [ ] | **beslut: live nu eller senare** |
| **demo_mode** | **true** | true | false | [ ] | **MÅSTE bli AV i prod om publik lansering** |
| supabase_auth_poc | (default) | (default) | false | [ ] | |
| data_retention | (default) | (default) | false | [ ] | |
| messaging | (default) | (default) | true | [ ] | kräver migration 4–6 applicerad |

**Föräldralösa flagg-rader** (borttagna ur kod, GA 2026-04-25 — rader kvar i DB, ignoreras av kod): `business_insights`, `due_for_service`, `group_bookings`, `recurring_bookings` (staging + prod), samt `customer_invite` (prod). Städa vid tillfälle, ej blocker.

Checklista:
- [ ] Lista prod/staging/default per flagga (tabell ovan — komplettera med Vercel `FEATURE_*`-env)
- [ ] Definiera avsedd prod-config (fyll "Avsedd prod"-kolumnen efter §2-beslut)
- [ ] **demo_mode → av** i prod (om publik lansering)
- [ ] **stable_profiles** → beslut (prod är på idag; staging av)
- [ ] **stripe_payments** → beslut (kopplat till D + §2 Stripe-beslut)
- [ ] GA-flaggor (voice_logging, route_planning, route_announcements, customer_insights, self_reschedule) → beslut om de ska på i prod (paritet med staging)
- [ ] Verifiera efter ändring (läs `FeatureFlag`-tabell + `/api/feature-flags`)

### C. Env guard / env docs

- [ ] Lägg till `STRIPE_WEBHOOK_SECRET` i `REQUIRED_PROD_VARS` (`scripts/check-prod-env.ts`)
- [ ] Lägg till **non-empty-validering** (idag passerar tom sträng — S65-4)
- [ ] Rätta `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` i `.env.example` (idag fel namn `STRIPE_PUBLISHABLE_KEY`)
- [ ] Lägg till saknade env-vars i `.env.example`: `NEXTAUTH_SECRET`, `PAYMENT_PROVIDER`, `MODAL_API_URL`, `FORTNOX_CLIENT_ID/SECRET/REDIRECT_URI`, `EDGE_CONFIG`/`EDGE_CONFIG_ID`/`VERCEL_API_TOKEN`, `DISABLE_SW`, `DISABLE_CRONS`, `STAGING_PROJECT`, `NEXT_PUBLIC_DEMO_MODE`
- [ ] Verifiera Vercel prod-env via `vercel env pull --environment=production` (särskilt efter pausen): Supabase-URL/keys, `APP_URL`, `DATABASE_URL`/`DIRECT_DATABASE_URL`, Upstash Redis
- [ ] Påminnelse: använd Vercel **REST API** för icke-triviala env-skrivningar (CLI `--value`/stdin sparar tyst tomt)

### D. Stripe / payment readiness

> Endast om §2 "Stripe live" = ja nu. Annars: hoppa, men dokumentera beslutet.

- [ ] Stripe **företagsverifiering** klar (ägs av Stripe/Johan — hård blocker för live)
- [ ] **Prod webhook-secret** satt i Vercel (webhook registrerad i Stripe prod-konto mot `equinet.johanlindengard.com/api/webhooks/stripe`)
- [ ] **Restricted key** (`rk_`) med least-privilege i stället för `sk_`
- [ ] CSP: lägg till `frame-src https://hooks.stripe.com` (krävs för 3DS/SCA — riktiga EU-kort)
- [ ] **Idempotency key** på `StripePaymentGateway.initiatePayment` (undvik övergivna PaymentIntents)
- [ ] Testa betalningsflöde enligt vald nivå (test-mode räcker om ej live; annars live-kort efter verifiering)
- [ ] Bekräfta webhook-verifiering aktiv (signatur + event-ID-dedup via StripeWebhookEvent — kräver migration 3)

### E. Deploy staging → main/prod

> Får INTE starta förrän A (migrationer), B (flags), C (env-guard) är gröna.

- [ ] CI grön på staging-branchen (`check:all` + E2E mot main-PR)
- [ ] Migrationer applicerade på prod-DB FÖRST (workstream A klar)
- [ ] Feature flags reconcilade (workstream B klar)
- [ ] Env-guard grön + Vercel prod-env verifierad (workstream C klar)
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
| Prod-data är riktig användardata | Medel | Hög (dataförlust/GDPR) | §2-beslut FÖRE alla ändringar; backup/PITR före migration; ingen reset/seed | Johan |
| Kod deployas utan att migration körts först | Medel | Hög (500-fel, saknade tabeller) | Workstream-ordning A→E; migration-gate före prod-promote; deploy via `deploy.sh` (ej rå `git push`) | Tech lead |
| demo_mode aktiv i prod vid publik lansering | Hög (är true idag) | Hög (demo-UX exponeras) | Workstream B: demo_mode→av + verifiering före deploy | Tech lead |
| Stripe live ej redo men aktiveras | Medel | Hög (misslyckade betalningar/SCA) | §2 Stripe-beslut; D komplett eller stripe_payments av; 3DS-CSP + företagsverifiering | Johan/Tech lead |
| RLS-regression efter migration | Låg | Hög (dataläcka mellan providers) | Verifiera RLS-policies (A) + bevistester; smoke-test stall/bokning (F) | Tech lead |
| Seed-script körs mot prod av misstag | Låg | Kritisk (skriver över prod) | `seed-guard.ts` vägrar prod-ref `xybyzflfxnqqyxnvjklv`; använd ALDRIG legacy `seed-demo.ts` (ingen guard); ingen seed i denna sprint | Tech lead |
| Vercel prod-env tom/fel efter paus | Medel | Hög (app startar ej) | Workstream C: `vercel env pull` verifiering; non-empty-guard | Tech lead |
| Föräldralösa flagg-rader förvirrar config | Låg | Låg | Städa vid tillfälle (ej blocker) | Tech lead |

---

## 5. Go/No-Go

Deploy till prod får ske ENDAST när alla nedan är bockade:

- [ ] Alla **must-have** klara (workstream A, B, C + relevant D)
- [ ] **Rollback-plan** dokumenterad och aktuell (Vercel promote-tidigare + forward-migration; se `docs/operations/incident-runbook.md`)
- [ ] **Smoke-test-plan** klar (workstream F definierad och redo att köras direkt efter deploy)
- [ ] **Johan godkänner deploy** explicit
- [ ] **Ingen oklar prod-data-risk kvar** (§2 prod-data-fråga besvarad)

---

## 6. Out of scope

Detta ingår INTE i Production Relaunch-sprinten:

- Nya features
- Stall-community
- Messaging GA (utöver att applicera redan-mergade migrationer)
- Group bookings GA
- **Prod seed / prod reset**
- Stora refactors (status-label-konsolidering, Checkout Sessions-migrering, MODAL_API_URL-dedup)
- Hydration #418 på Dagens rutt (separat backlog, icke-blockerande)
- Besöksplats-modell / Stall-epic Slice 4

---

> **Nästa steg:** Johan besvarar §2. Därefter detaljeras workstream A (exakt apply-plan med
> verifierings-SQL) som första körbar slice — men ingen körning förrän Go/No-Go är grön.
