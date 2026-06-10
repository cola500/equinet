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
---

# Production Env Guard / Env Docs-plan (Workstream C)

> Detaljering av **Workstream C** i [Production Parity-planen](production-relaunch-plan.md).
> **PLAN — ingen prod-env ändras, ingen deploy, ingen seed, ingen flaggändring** förrän §4
> Go/No-Go är grön och Johan ger explicit klartecken. Förutsätter A (klar) + B (planerad).

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

**Efter (prod-env, grupp C) [Johan-manuellt]:**
- [ ] `npm run audit:prod-env:safe` → `NEXT_PUBLIC_DEMO_MODE` = `FALSE`/`UNSET`
- [ ] Alla required vars icke-tomma
- [ ] `DISABLE_CRONS` ej `true`
- [ ] (Effekt på demo_mode i klient verifieras efter rebuild i Workstream E + smoke F)

## 4. Go/No-Go — Workstream C

Får STARTA när:
- [ ] §2-ändringarna godkända av PO (kod + docs + prod-env-lista)
- [ ] **[Johan-manuellt]** prod-env utläst (`vercel env pull`) så nuläget för `NEXT_PUBLIC_DEMO_MODE` + required vars är känt
- [ ] Metod för prod-env-skrivning bekräftad (Vercel REST API)
- [ ] Johan ger explicit klartecken

Räknas KLAR när:
- [ ] Grupp A (check-prod-env härdning) mergad (i Workstream E:s PR eller egen)
- [ ] Grupp B (.env.example) uppdaterad
- [ ] Grupp C: `NEXT_PUBLIC_DEMO_MODE` av i prod + required vars verifierade icke-tomma
- [ ] Inget annat env rört av misstag; staging oförändrad

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
