---
title: Production Env Guard / Env Docs-plan (Workstream C)
description: Körbar plan för att få production env i parity-läge — NEXT_PUBLIC_DEMO_MODE av (slutför demo_mode), check-prod-env.ts-härdning (STRIPE_WEBHOOK_SECRET + non-empty), .env.example-fix, saknade vars. Planering — ingen env-ändring förrän PO-Go.
category: sprint
status: draft
last_updated: 2026-06-10
tags: [production, env, vercel, parity, demo-mode, check-prod-env]
depends_on:
  - docs/sprints/production-relaunch-plan.md
related:
  - docs/sprints/production-feature-flag-reconciliation-plan.md
  - scripts/check-prod-env.ts
sections:
  - Scope och status
  - 1. Nuläge
  - 2. Vad som måste ändras
  - 3. Verifiering före/efter
  - 4. Go/No-Go — Workstream C
  - 5. Docs/kod vs faktisk prod-env
  - 6. C-env audit 2026-06-10
  - 7. REST API-åtgärdsrunbook
---

# Production Env Guard / Env Docs-plan (Workstream C)

> Detaljering av **Workstream C** i [Production Parity-planen](production-relaunch-plan.md).
> **PLAN — ingen prod-env ändras, ingen deploy, ingen seed, ingen flaggändring** förrän §4
> Go/No-Go är grön och Johan ger explicit klartecken. Förutsätter A (klar) + B (klar).
>
> **2026-06-10:** prod-env auditerad + **åtgärdad** (hybrid: Johan skrev i Vercel, agent verifierade).
> 3 blockerare lösta (DATABASE_URL/DIRECT_DATABASE_URL satta, PAYMENT_PROVIDER→mock via split) + demo-hygien.
> Se [§6 audit + utfall](#6-c-env-audit-2026-06-10). Kvar: rebuild i Workstream E för full demo-av i klienten.

## Scope och status

Två syften:
1. **Slutföra demo_mode AV i prod** — Workstream B sätter DB-flaggan, men `NEXT_PUBLIC_DEMO_MODE`
   (env, build-time) måste också vara av och bakas ut vid rebuild (E). Detta är C:s viktigaste punkt.
2. **Härda env-guarden + env-dokumentationen** så parity-deployen är trygg och reproducerbar.

> **Begränsning:** Faktiska Vercel-värden (prod) kan **inte** läsas härifrån — prod är bakom
> Vercel Security Checkpoint och `vercel`-CLI kräver inloggning som bara Johan kan göra. Steg som
> kräver detta är märkta **[Johan-manuellt]**.

## 1. Nuläge

### 1a. `NEXT_PUBLIC_DEMO_MODE` i prod (kritisk för demo_mode)
- `demo_mode`-flaggan läser **både** DB-overriden och env `NEXT_PUBLIC_DEMO_MODE`. Env-värdet
  **bakas in i klient-bundeln vid build**.
- Prod-värdet är **okänt härifrån** (kräver `vercel env pull` / dashboard). Eftersom prod idag
  visar demo-läge (DB-flagga `true`) är det **sannolikt** att `NEXT_PUBLIC_DEMO_MODE=true` även i
  prod-env. **Måste verifieras.**
- `.env.example` saknar `NEXT_PUBLIC_DEMO_MODE` helt (odokumenterad).

### 1b. `scripts/check-prod-env.ts` (faktiskt kodläge 2026-06-10)
- `REQUIRED_PROD_VARS` (11): APP_URL, DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, FROM_EMAIL,
  STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN.
- Validering: `REQUIRED_PROD_VARS.filter(v => !env[v])`.
  - **Korrigering mot tidigare antagande:** `!env[v]` fångar **både** `undefined` **och tom sträng**
    (`!'' === true`). Den gamla noten "tom string passerar" stämmer **inte** för nuvarande kod.
  - **Kvarvarande luckor:** (a) **whitespace-only** värden (`'   '`) är truthy → passerar;
    (b) **`STRIPE_WEBHOOK_SECRET` saknas** i listan.
- `checkCronsEnabled`: blockerar `DISABLE_CRONS=true` på prod (utom `STAGING_PROJECT=true`). OK.

### 1c. `.env.example` (faktiskt läge)
- **Fel namn:** rad 131 `# STRIPE_PUBLISHABLE_KEY=""` — koden använder `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- **Saknas helt:** `NEXT_PUBLIC_DEMO_MODE`, `PAYMENT_PROVIDER` (endast `SUBSCRIPTION_PROVIDER` finns),
  `NEXTAUTH_SECRET`, `MODAL_API_URL`, `FORTNOX_CLIENT_ID/SECRET/REDIRECT_URI`,
  `EDGE_CONFIG`/`EDGE_CONFIG_ID`/`VERCEL_API_TOKEN`, `DISABLE_SW`, `ANALYZE`, `DISABLE_CRONS`,
  `STAGING_PROJECT`.
- Finns redan (kommenterade): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_BASIC,
  SUBSCRIPTION_PROVIDER, FEATURE_PROVIDER_SUBSCRIPTION, DISABLE_EMAILS.

### 1d. Required prod-vars — faktiska Vercel-värden
- **[Johan-manuellt]** Okänt härifrån. Måste verifieras att de 11 (snart 12) required vars finns och
  har icke-tomma värden i prod, **särskilt efter att prod-Supabase varit pausad** (DB-URLs, Supabase-keys).

## 2. Vad som måste ändras

### Grupp A — Kodändring i repo (✅ LEVERERAD i PR #392, ej mergad)
1. **`check-prod-env.ts`: `STRIPE_WEBHOOK_SECRET` villkorligt required** — endast när
   `PAYMENT_PROVIDER === 'stripe'` (separat `STRIPE_REQUIRED_VARS`). Blockerar inte parity-deployen. ✅
2. **`check-prod-env.ts`: non-empty/trim-validering** — whitespace-only fångas nu (`isMissing`-helper). ✅
   - 6 nya unit-tester (RED→GREEN). `npm run check:all` 4/4 grön.

> **✅ PARITY-DEPLOY-BLOCKER LÖST — val A (PO-beslut 2026-06-10, implementerad i PR #392):**
> `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` flyttade till `STRIPE_REQUIRED_VARS`
> → required **endast** när `PAYMENT_PROVIDER=stripe`. `REQUIRED_PROD_VARS` 11 → 9; `STRIPE_REQUIRED_VARS`
> 1 → 3 (secret + publishable + webhook). Med Stripe AV i parity blockerar guarden inte längre
> prod-deployen. Enforced igen när Stripe Live aktiveras (Post-Parity). Tester uppdaterade, `check:all` 4/4.
> *(Val B — test-nycklar i prod — valdes bort: hade infört oanvänd Stripe-config i prod.)*

### Grupp B — Docs-ändring i repo (`.env.example`)
3. **Rätta** rad 131: `STRIPE_PUBLISHABLE_KEY` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
4. **Lägg till** `NEXT_PUBLIC_DEMO_MODE` med kommentar (prod = av/unset; demo-server = true).
5. **Lägg till** övriga saknade vars som dokumentations-platshållare: `PAYMENT_PROVIDER`,
   `NEXTAUTH_SECRET`, `MODAL_API_URL`, `FORTNOX_*`, `EDGE_CONFIG`/`EDGE_CONFIG_ID`/`VERCEL_API_TOKEN`,
   `DISABLE_SW`, `ANALYZE`, `DISABLE_CRONS`, `STAGING_PROJECT` (dummy-värden, ingen secret).

### Grupp C — Faktisk prod-env-ändring i Vercel **[Johan-manuellt / REST API]**
6. **`NEXT_PUBLIC_DEMO_MODE`** i prod → **`false` eller borttagen.** (Slutför demo_mode AV ihop med B.)
   - Full effekt först efter **rebuild/redeploy** (Workstream E) eftersom värdet är build-time.
7. **Verifiera (och vid behov sätt) de required prod-vars** så inga är tomma/whitespace —
   särskilt DB-URLs + Supabase-keys efter pausen.
8. **Bekräfta `DISABLE_CRONS`** inte är `true` på prod (annars blockerar guarden).
9. **Regel:** använd **Vercel REST API** (`DELETE` + `POST` `type:"plain"`/`encrypted`) för skrivningar —
   inte CLI `--value`/stdin (sparar tyst tomt). Splitta delade rader via UI, inte CLI `rm`.

> **stripe_payments-koppling:** Eftersom Stripe är AV i parity (§B) behöver `STRIPE_WEBHOOK_SECRET`
> **inte** sättas i prod nu — den villkorliga guarden (punkt 1) ska inte kräva den när Stripe är av.
> Sätts först i Workstream D (Stripe Live, Post-Parity).

## 3. Verifiering före/efter

**Före (read-only):**
- [ ] **[Johan-manuellt]** `npm run audit:prod-env:safe` → läs statusrapporten: är `NEXT_PUBLIC_DEMO_MODE` `TRUE`/`FALSE`/`UNSET`? några required `MISSING`/`EMPTY`?
- [ ] **[Johan-manuellt]** Bekräfta de 9 required vars = `SET` (DB-URLs, Supabase-keys, APP_URL, Redis, Resend); Stripe-vars endast om `PAYMENT_PROVIDER=stripe`
- [ ] Bekräfta `check-prod-env.ts` + `.env.example` nuläge (denna plan, §1) oförändrat före ändring

**Efter (kod, grupp A+B):**
- [ ] `npm run typecheck` + ev. nytt unit-test för whitespace-fall grönt
- [ ] `check-prod-env.ts` flaggar nu whitespace-only; STRIPE_WEBHOOK_SECRET villkorligt required
- [ ] `.env.example`: korrekt Stripe-namn + nya vars närvarande; `npm run docs`/lint grönt

**Efter (prod-env, grupp C) [klart 2026-06-10]:**
- [x] `npm run audit:prod-env:safe` → `NEXT_PUBLIC_DEMO_MODE` = `FALSE`
- [x] Alla required vars icke-tomma (9/9 `SET`)
- [x] `DISABLE_CRONS` ej `true` (UNSET)
- [ ] (Effekt på demo_mode i klient verifieras efter rebuild i Workstream E + smoke F)

## 4. Go/No-Go — Workstream C

Får STARTA när (uppfyllt 2026-06-10):
- [x] §2-ändringarna godkända av PO (kod + docs + prod-env-lista)
- [x] **[Johan-manuellt]** prod-env utläst (`npm run audit:prod-env:safe`) så nuläget för `NEXT_PUBLIC_DEMO_MODE` + required vars är känt
- [x] Metod för prod-env-skrivning bekräftad (hybrid: UI-split + interaktiv CLI)
- [x] Johan gav explicit klartecken

Räknas KLAR när:
- [x] Grupp A (check-prod-env härdning) mergad (PR #392)
- [x] Grupp B (.env.example) uppdaterad (PR #392)
- [x] Grupp C: `NEXT_PUBLIC_DEMO_MODE` = false i prod + required vars verifierade icke-tomma
- [x] Inget annat env rört av misstag; dev/preview/staging-rader oförändrade

> **Beroende-not:** demo_mode blir **helt** av först när C (env av) + E (rebuild bakar ut värdet) +
> F (smoke bekräftar) är klara. C ensam är nödvändig men inte tillräcklig.

## 5. Docs/kod vs faktisk prod-env

| # | Ändring | Typ | Var | Status |
|---|---------|-----|-----|--------|
| 1 | check-prod-env: STRIPE_WEBHOOK_SECRET (villkorlig) | **Kodändring** | `scripts/check-prod-env.ts` | ✅ PR #392 (ej mergad) |
| 2 | check-prod-env: non-empty/trim | **Kodändring** | `scripts/check-prod-env.ts` (+ test) | ✅ PR #392 (ej mergad) |
| 3 | Rätta NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | **Docs/repo** | `.env.example` | ✅ PR #392 (ej mergad) |
| 4 | Lägg till NEXT_PUBLIC_DEMO_MODE | **Docs/repo** | `.env.example` | ✅ PR #392 (ej mergad) |
| 5 | Lägg till övriga saknade vars | **Docs/repo** | `.env.example` | ✅ PR #392 (ej mergad) |
| 1b | STRIPE_SECRET_KEY + publishable villkorliga (val A) | **Kodändring** | `scripts/check-prod-env.ts` (+ test) | ✅ PR #392 (löst blocker) |
| 6 | NEXT_PUBLIC_DEMO_MODE = false/borttagen | **Faktisk prod-env** | Vercel (REST API) | **[Johan-manuellt]** + rebuild E |
| 7 | Verifiera/sätt required prod-vars icke-tomma | **Faktisk prod-env** | Vercel | **[Johan-manuellt]** |
| 8 | Bekräfta DISABLE_CRONS ≠ true | **Faktisk prod-env** | Vercel | **[Johan-manuellt]** |

**Sammanfattning:** punkt 1–5 + 1b är repo-ändringar levererade i **PR #392** (ej mergad) — inkl. den
tidigare parity-deploy-blockern (löst via val A). Punkt 6–8 är faktiska prod-env-ändringar i Vercel som
kräver Johans inloggning — ingen av dem görs nu.

### Johan-manuella kommandon (när Go ges)

**Verifiering — använd det säkra audit-scriptet** (`scripts/audit-prod-env-safe.mjs`):
```
npm run audit:prod-env:safe
```
Scriptet kör `vercel env pull --environment=production .env.prod.audit`, skriver ut **endast status**
per variabel (`SET` / `MISSING` / `EMPTY` / `WHITESPACE_ONLY`), visar icke-hemliga beslutsvariabler
(`NEXT_PUBLIC_DEMO_MODE`, `PAYMENT_PROVIDER`, `DISABLE_CRONS`, `STAGING_PROJECT`) som `TRUE`/`FALSE`/
status, och **raderar audit-filen efteråt**. Inga secret-värden skrivs ut — utskriften är säker att
klistra in i chatten. Kräver `vercel login` + `vercel link` (prod-projektet); annars tydligt felmeddelande.
Var-listorna importeras från `check-prod-env.ts` så de aldrig driftar isär.

Skrivningar (`NEXT_PUBLIC_DEMO_MODE`, ev. saknade vars) görs av Johan via Vercel REST API eller
dashboard — jag tar fram exakta anrop/värden på begäran, men kör dem inte.

## 6. C-env audit 2026-06-10

Resultat från `npm run audit:prod-env:safe` mot prod (status, **inga värden**):

### 🔴 Blockerare för parity-deploy

| # | Variabel | Status | Konsekvens | Åtgärd |
|---|----------|--------|-----------|--------|
| 1 | `DATABASE_URL` | **EMPTY** | Prod-app kan **inte ansluta till DB** vid runtime; hardenade guarden failar bygget (tom = saknad) | Sätt prod-pooler-sträng (secret) |
| 2 | `PAYMENT_PROVIDER` | **stripe** | (a) Riktig Stripe-gateway aktiv (emot parity); (b) guarden kräver då `STRIPE_WEBHOOK_SECRET` = **MISSING** → bygget failar | Sätt **`mock`** (löser båda) |
| 3 | `DIRECT_DATABASE_URL` | **EMPTY** | Behövs för Prisma-migrationer mot prod | Sätt prod direct-sträng (secret) |

### 🟡 Hygien (ej blocker)

| # | Variabel | Status | Not | Åtgärd |
|---|----------|--------|-----|--------|
| 4 | `NEXT_PUBLIC_DEMO_MODE` | **OTHER** | Demo är **redan av** — `isDemoMode()` = `NEXT_PUBLIC_DEMO_MODE === "true"` (strikt), och DB-flaggan är false | Sätt `false` eller ta bort (tydlighet) |

### 🟢 Ingen åtgärd
`STRIPE_WEBHOOK_SECRET` = MISSING krävs **endast** för att `PAYMENT_PROVIDER=stripe`. När #2 → `mock`
är den inte längre required (hör till Workstream D / Stripe Live).

### ✅ OK
`APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY`, `FROM_EMAIL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` = `SET`.
`DISABLE_CRONS` = UNSET (bra). `STAGING_PROJECT` = UNSET (korrekt — prod är inte staging).

> **Kodtolkning verifierad:** `src/lib/demo-mode.ts` (`=== "true"`) + `src/domain/payment/PaymentGateway.ts`
> (switch på `PAYMENT_PROVIDER`).

### ✅ Utfall — åtgärder körda 2026-06-10 (hybrid: Johan skrev, agent verifierade)

Alla 3 blockerare lösta + hygien klar. Verifierat per ändring via `npm run audit:prod-env:safe`.

| Variabel | Före | Efter | Metod |
|----------|------|-------|-------|
| `PAYMENT_PROVIDER` (prod) | stripe (delad rad Dev/Preview/Prod) | **mock** | UI-split: krympte delad rad till Dev/Preview (= stripe, omtypat) + ny Production-only rad = mock |
| `DATABASE_URL` (prod) | EMPTY | **SET** (129 tkn, pooler, `connection_limit=1`) | interaktiv CLI (`vercel env rm/add`) — UI-paste landade tomt |
| `DIRECT_DATABASE_URL` (prod) | EMPTY | **SET** (87 tkn, direct, utan pgbouncer) | interaktiv CLI |
| `NEXT_PUBLIC_DEMO_MODE` (prod) | OTHER | **FALSE** | interaktiv CLI |

**Verifierat oförändrat:** Dev/Preview `PAYMENT_PROVIDER` = stripe; Preview/staging `DATABASE_URL`/
`DIRECT_DATABASE_URL`-rader; "Preview (staging)" `NEXT_PUBLIC_DEMO_MODE` = true.

**Slutverifiering:** alla 9 required = `SET`, `PAYMENT_PROVIDER` = mock (Stripe-block hoppas över →
bygget ej längre blockerat), `NEXT_PUBLIC_DEMO_MODE` = FALSE, `DISABLE_CRONS`/`STAGING_PROJECT` = UNSET.

**Lärdomar:**
- **UI-paste-buggen är reell** för krypterade/sensitive vars i Vercel UI (53.1.1) — även "Add New",
  inte bara "Edit". `DATABASE_URL` sparades tomt via UI; **interaktiv `vercel env add` löste det**
  (till skillnad från `--value`/stdin som också sparar tomt). Detta är troligen varför DB-URL:erna
  var tomma från början.
- **Delad rad-split:** `PAYMENT_PROVIDER` krävde split via UI (omtypat icke-hemligt värde `stripe`
  för att inte blanka Dev/Preview). Fungerade.
- **`vercel env rm <var> production`** på Production-only-rader tog bara Production (inte de separata
  Preview-/staging-raderna) — rm-delad-rad-faran gäller bara genuint delade rader.

**Kvarstår för full demo-av i klienten:** `NEXT_PUBLIC_DEMO_MODE` är build-time → bakas in vid nästa
**rebuild/redeploy (Workstream E)**. Env är nu korrekt (`false`); effekten syns efter E.

## 7. REST API-åtgärdsrunbook

> **Instruktioner — körs av Johan, INTE nu. Paus före varje riktig ändring.** Inga secrets i detta
> dokument. Per projektregel: Vercel **REST API** (`type:"plain"` config / `"encrypted"` secret),
> aldrig CLI `--value`/stdin; **delade rader splittas via UI**, inte API-delete.
> Variabler: `$VERCEL_TOKEN` (Vercel-token), `$PID` = prod-projektet (`equinet-app`, eller dess ID).

### Steg 0 — Discovery (read-only, inga värden)
Identifiera varje vars `id`, `type` och `target` (avslöjar **delade rader**):
```bash
curl -s "https://api.vercel.com/v9/projects/$PID/env" -H "Authorization: Bearer $VERCEL_TOKEN" \
 | jq -r '.envs[] | select(.key|IN("PAYMENT_PROVIDER","DATABASE_URL","DIRECT_DATABASE_URL","NEXT_PUBLIC_DEMO_MODE"))
          | "\(.key)\t\(.id)\t\(.type)\t\(.target|join(","))"'
```
- Om `target` för en rad innehåller fler än `production` (t.ex. `production,preview,development`) =
  **DELAD RAD** → ändra **inte** via API (det påverkar alla miljöer). **Splitta via UI Edit först**
  (sätt prod-specifikt värde där). Detta gäller särskilt `DATABASE_URL`/`DIRECT_DATABASE_URL` (2026-05-06-incidenten).
- Spara varje `id` (kallas `$ENV_ID` nedan).

### Steg 1 — `PAYMENT_PROVIDER` → `mock` (plain, non-secret) — VIKTIGAST
```bash
curl -s -X PATCH "https://api.vercel.com/v9/projects/$PID/env/$ENV_ID_PAYMENT_PROVIDER" \
  -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \
  -d '{"value":"mock","type":"plain"}'
```
(Om raden inte finns: `POST "https://api.vercel.com/v10/projects/$PID/env?upsert=true"` med
`{"key":"PAYMENT_PROVIDER","value":"mock","type":"plain","target":["production"]}`.)

### Steg 2 — `DATABASE_URL` (encrypted, secret) — endast prod-target
> Om Steg 0 visade delad rad: splitta via UI först, sätt prod-värdet där, hoppa över API-anropet.
> Klistra **aldrig** connection-strängen i chatten. Hämta från Supabase Dashboard → Database →
> Connection string (pooler, `&connection_limit=1`).
```bash
# Kör i ditt terminal — strängen syns bara där, inte i chatten:
read -rsp 'DATABASE_URL (pooler): ' DBURL; echo
curl -s -X PATCH "https://api.vercel.com/v9/projects/$PID/env/$ENV_ID_DATABASE_URL" \
  -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \
  -d "$(jq -nc --arg v "$DBURL" '{value:$v,type:"encrypted"}')"; unset DBURL
```

### Steg 3 — `DIRECT_DATABASE_URL` (encrypted, secret) — direct connection, utan pgbouncer
Samma mönster som Steg 2 (`read -rsp` + PATCH med `$ENV_ID_DIRECT_DATABASE_URL`). Splitta delad rad via UI vid behov.

### Steg 4 — `NEXT_PUBLIC_DEMO_MODE` → `false` (plain) eller ta bort (hygien)
```bash
# Sätt false:
curl -s -X PATCH "https://api.vercel.com/v9/projects/$PID/env/$ENV_ID_DEMO_MODE" \
  -H "Authorization: Bearer $VERCEL_TOKEN" -H "Content-Type: application/json" \
  -d '{"value":"false","type":"plain"}'
# ELLER ta bort helt:
# curl -s -X DELETE "https://api.vercel.com/v9/projects/$PID/env/$ENV_ID_DEMO_MODE" -H "Authorization: Bearer $VERCEL_TOKEN"
```

### Efter ändringarna — verifiera (read-only)
```bash
npm run audit:prod-env:safe
```
Förvänta: `DATABASE_URL`/`DIRECT_DATABASE_URL` = `SET`, `PAYMENT_PROVIDER` = `mock`,
`NEXT_PUBLIC_DEMO_MODE` = `FALSE`/`UNSET`, Stripe-blocket **hoppas över**. Full klient-effekt på
demo-läget syns först efter **rebuild/redeploy (Workstream E)**.

> **Paus-regel:** kör ett steg i taget, verifiera med audit-scriptet mellan, och rapportera
> status (inte värden) — inget annat env rörs, ingen deploy.
