---
title: "Sprint 67: iOS staging capability — separat Vercel-projekt för publik staging"
description: "Sprint-mål: iOS staging demo fungerar end-to-end utan Vercel SSO-blockering. Lösningen är ett separat Vercel-projekt där staging-domänen är production-custom-domain (automatiskt SSO-undantagen) istället för dagens preview-mappning som tvingar SSO-skydd."
category: sprint
status: planned
last_updated: 2026-05-08
tags: [sprint, ios, staging, vercel, infra, demo-mode, sso]
sections:
  - Sprint Overview
  - Current State
  - Root Cause
  - Target Architecture
  - Proposed Stories
  - Risks
  - Rollout Plan
  - Verification Plan
  - Rollback Strategy
  - Out of Scope
  - STOPP — inväntar Johan
---

# Sprint 67: iOS staging capability

## Sprint Overview

**Mål:** iOS staging demo fungerar end-to-end utan Vercel SSO-blockering. Erik Järnfot-flödet ska kunna verifieras från native login → dashboard → tjänster → bokningar i simulator utan workarounds.

**Källa:** S66-6 visuell verifiering (2026-05-07) bekräftade att PR #327:s AppConfig-fix räcker för native auth via Supabase, men att alla HTTP-anrop till `equinet-staging.johanlindengard.com` returnerar 401 från Vercel SSO — inklusive native API-anrop med Bearer JWT som inte kan använda `_vercel_jwt`-bypass-cookien.

**Strategi:** Separat Vercel-projekt där staging-branchen deployas som production. Då blir `equinet-staging.johanlindengard.com` en production-custom-domain på det nya projektet och undantas automatiskt av befintlig `ssoProtection: all_except_custom_domains`-policy. Inga plan-uppgraderingar, inga kodändringar, ingen bypass-token-hantering.

**Förväntad effort:** ~1-1.5 dagar fördelade över 7-9 stories. Mycket Vercel-konfiguration, lite kod.

---

## Current State

### Vercel topology (verifierat 2026-05-08 via REST API)

| Aspekt | Värde |
|---|---|
| Team | `cola500s-projects` (Pro, legacy billing) |
| Projects | 6 totalt; relevant projekt är `equinet-app` (id `prj_HKujmIYaLJopCS3VjJGDckM8riFB`) |
| Framework | Next.js |
| Region | `fra1` (Frankfurt) — definerat i `vercel.json` för låg-latency mot Supabase staging Frankfurt |
| Custom Environments | 0 (bara default Production/Preview/Development) |
| Total env-rader | 31 |
| `ssoProtection.deploymentType` | `all_except_custom_domains` |
| `passwordProtection` | null |
| `protectionBypass` | null |
| `botIdEnabled` | false |
| `firewallEnabled` | true |

### Custom domains (alla i `equinet-app`)

| Domain | Branch | Roll | SSO-status |
|---|---|---|---|
| `equinet.johanlindengard.com` | (production) | Production-custom-domain | Undantagen |
| `equinet-staging.johanlindengard.com` | `staging` | Preview-branch-mappning | **Skyddad (HTTP 401)** |
| `equinet-app-test.johanlindengard.com` | (oklar) | Legacy | Skyddad |
| `equinet-app.vercel.app` | (default) | Vercel-default | Skyddad |

### Branches

- `main` → deployas som Production i `equinet-app` → `equinet.johanlindengard.com`
- `staging` → deployas som Preview i `equinet-app` → `equinet-staging.johanlindengard.com` (SSO-skyddad)

### GitHub workflows

- `quality-gates.yml` — typecheck/test/lint
- `ios-tests.yml` — XCTest-svit
- `dependabot-auto-merge.yml` — dependabot-merge
- Inga deploy-specifika workflows (Vercel deployar direkt på push via Vercel-Github-integration)

### iOS-app

Efter PR #327 (`6cb86745`):
- `AppConfig.staging.baseURL` → `https://equinet-staging.johanlindengard.com`
- `AppConfig.staging.supabaseURL` → `https://zzdamokfeenencuggjjp.supabase.co`
- `AppConfig.production.baseURL` → `https://equinet.johanlindengard.com`
- `AppConfig.production.supabaseURL` → `https://xybyzflfxnqqyxnvjklv.supabase.co`
- 12 AppConfigTests gröna
- Bara `Equinet.xcscheme` — ingen separat staging-scheme. `-STAGING` är manuell launch-arg.

### Erik Järnfot demo-data

I staging Supabase (`zzdamokfeenencuggjjp`): 1 leverantör (Erik), 5 tjänster, 9 kunder, 14 hästar, 18 bokningar, 7 recensioner, 1 bokningsserie, Smart Reply-konversation. Login: `erik.jarnfot@demo.equinet.se` / `DemoProvider123!`.

---

## Root Cause

`ssoProtection.deploymentType = "all_except_custom_domains"` tolkar Vercel som:

> Production-custom-domains är publika. Alla andra deployments (inklusive preview-mappade custom domains) är SSO-skyddade.

`equinet-staging.johanlindengard.com` mappas till `staging`-branchen i `equinet-app`, vilket Vercel klassar som **preview**-deployment. Custom domain-statusen påverkar inte den klassificeringen.

Vercel SSO sitter som ett edge-lager **före** Next.js. Alla HTTP-anrop returnerar 401 oavsett app-logik — även publika no-auth-endpoints som `/api/feature-flags`. iOS APIClient skickar `Authorization: Bearer ...` (Supabase JWT), men Vercel SSO bryr sig inte om Bearer-tokens — den vill ha `_vercel_jwt`-cookie eller Vercel-team-medlemskap.

`_vercel_jwt`-cookie fås via Share Link och fungerar för WebView (cookie-baserad auth-väg), men:
- iOS APIClient har egen `URLSession` som inte delar cookies med WKWebView
- Bypass-cookien är HttpOnly och kan inte läsas/sättas av app-koden manuellt
- Strukturellt: Bearer-flow ≠ Cookie-flow

**Slutsats:** Inga app-sidan workarounds löser detta utan stor kodändring (custom Cookie-jar, hybrid auth-flow). Den kortaste vägen är att ändra Vercel-klassificeringen så staging-domänen INTE räknas som preview.

---

## Target Architecture

### Nytt Vercel-projekt: `equinet-staging-app`

| Egenskap | Värde |
|---|---|
| Vercel project name | `equinet-staging-app` (förslag) |
| GitHub repo | Samma som idag (`cola500/equinet`) |
| Production branch | `staging` |
| Preview branches | (alla utom `staging` — okej eftersom inget annat byggs här i normalfall) |
| Custom domain (production) | `equinet-staging.johanlindengard.com` |
| Region | `fra1` (samma som equinet-app) |
| Framework | Next.js |
| `ssoProtection` | `all_except_custom_domains` (samma som equinet-app — då blir vår staging-domain undantagen automatiskt) |
| Build command | Default (`next build` via vercel.json) |
| Vercel-konfig | Samma `vercel.json` (cron jobs aktiva — se Risk 4) |

### Branch-strategi

| Branch | Vad händer |
|---|---|
| `main` | Deployar som Production i `equinet-app` → `equinet.johanlindengard.com`. **Oförändrad.** |
| `staging` | Deployar som Production i **`equinet-staging-app`** → `equinet-staging.johanlindengard.com`. **Ny mappning.** |
| Feature branches (`feature/*`) | Deployar som Preview i `equinet-app` (oförändrat). Får `DATABASE_URL` Preview default mot staging-DB (satt 2026-05-07). |

`staging`-branchen blir **inte** längre Preview i `equinet-app` — vi tar bort branch-mappningen där och låter `equinet-staging-app` ta över.

### Domain-strategi

- `equinet.johanlindengard.com` förblir på `equinet-app` (production)
- `equinet-staging.johanlindengard.com` flyttas från `equinet-app` till `equinet-staging-app` (production där)
- Andra subdomäner (legacy `equinet-app-test`) förblir orörda

### Env-strategi

Nya Vercel-projektet `equinet-staging-app` får sin egen env-namespace. Vi kopierar **selektivt** från `equinet-app`:s `preview/staging`-branch-override-rader (4 rader) + andra staging-relevanta vars:

- `DATABASE_URL` → staging Supabase pooler (port 6543, transaction)
- `DIRECT_DATABASE_URL` → staging Supabase pooler (port 5432, session)
- `NEXT_PUBLIC_SUPABASE_URL` → `https://zzdamokfeenencuggjjp.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → staging anon key
- `SUPABASE_SERVICE_ROLE_KEY` → staging service role
- `NEXT_PUBLIC_APP_URL` → `https://equinet-staging.johanlindengard.com`
- `NEXT_PUBLIC_DEMO_MODE=true`
- `DEMO_MODE_SEED_FALLBACK=true`
- `STRIPE_SECRET_KEY` → test-mode key (sk_test_...)
- `STRIPE_WEBHOOK_SECRET` → ev. ny webhook-endpoint för staging-projektet
- `RESEND_API_KEY` → samma som staging idag
- Övriga: feature flag overrides, sentry-DSN, etc.

**Allt sätts som `target: ["production"]`** i nya projektet (eftersom `staging`-branchen är production där). Inga preview-rader behövs initialt.

### Upstash Redis: temporär delning med prod (Batch 5, 2026-05-08)

Staging delar Upstash Redis-instansen (`strong-mut*****`) med prod via samma `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Bakgrund: Upstash Free tier tillåter bara en Redis-DB per konto, så att skapa separat staging-instans skulle kräva uppgradering.

**Accepterat för Sprint 67 eftersom:**
- Staging-volym är minimal (Erik Järnfot demo-data, lågfrekvent manuell testning)
- `DISABLE_CRONS=true` (Batch 1) eliminerar all bakgrundstrafik från staging
- Cache-keys är SHA-256-hashade per input (geocoding deterministiskt OK; provider/customer/insights-cache differs per ID) → låg risk för cross-contamination
- Rate-limit-namespace delas men staging-trafik är försumbar mot prod

**Triggers för separat Upstash (future improvement):**
- Free tier-quota närmar sig 10k commands/dag
- Cache-key-kollision observeras (felaktig cache-data i staging eller prod)
- Säkerhetskrav kräver strikt isolation
- Upstash plan uppgraderas till plan som rymmer flera DB:er

**Lösning vid trigger:** Skapa ny Redis via Upstash Dashboard (rekommenderat namn `equinet-staging-redis`, region EU - Frankfurt) eller via Vercel Marketplace-integration. POST de nya `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` till `equinet-staging-app` target=production. Inte i scope för Sprint 67.

### CI/CD-strategi

Vercel deployar direkt på push via GitHub-integration. Inga GitHub Actions-ändringar krävs. Gamla `quality-gates.yml` + `ios-tests.yml` förblir oförändrade.

Effekt: en push till `staging` triggar **två** Vercel-deploys (en i varje projekt):
- `equinet-app` Preview (om staging fortfarande är mappad där under övergångsfas)
- `equinet-staging-app` Production

Efter migration tas equinet-app:s staging-mappning bort → bara en deploy per push.

### Hur prod skyddas

- Inga ändringar i `equinet-app` Production-rader — `equinet.johanlindengard.com` förblir på samma projekt med samma env
- Inga ändringar i prod Supabase (`xybyzflfxnqqyxnvjklv`)
- Nya projektet får INGEN access till prod-DB
- Stripe live-keys förblir i `equinet-app` Production
- Risk för korskontaminering minimeras genom att namespacing är på Vercel-projekt-nivå (separata env-storage)

---

## Proposed Stories

| Story | Beskrivning | Effort | Risk | Verification | Rollback |
|---|---|---|---|---|---|
| **S67-1** | Skapa nytt Vercel-projekt `equinet-staging-app`, koppla till GitHub-repo `cola500/equinet`, sätt production-branch till `staging`, sätt `regions: ["fra1"]`, **hantera cron-risken (se guardrail nedan)** | 30 min – 2h | **Hög** (pga cron-dubblering) | Se DoD-bullets under tabellen | Delete project |
| **S67-2** | Kopiera env-vars från `equinet-app` Preview/staging-rader till `equinet-staging-app` Production. Använd REST API DELETE+POST-pattern. Validera att alla värden landar med innehåll (sensitive var-fällan). | 1-1.5h | Medel | `vercel env pull --environment=production` mot nya projektet returnerar fyllda värden | DELETE rader via REST API |
| **S67-3** | Ge nya projektet `ssoProtection: all_except_custom_domains` (samma som equinet-app) | 5 min | Låg | GET project visar samma policy | PATCH-tillbaka till null |
| **S67-4** | Kontrollera Stripe webhook-konfiguration. Om webhooks pekar på `equinet-staging.johanlindengard.com/api/webhooks/stripe` behövs ev. ny webhook-endpoint för nya projektet (testa med ny `STRIPE_WEBHOOK_SECRET`) | 30 min | Medel | Stripe webhook-test event når nya projektet med 200 | Återgå till gammal webhook-config |
| **S67-5** | **DNS-flytt:** flytta `equinet-staging.johanlindengard.com` från `equinet-app` (preview-staging mappning) till `equinet-staging-app` (production-custom-domain). Vercel hanterar DNS-CNAME automatiskt om domain redan är verifierad i team. | 15 min + 5-30 min DNS-propagation | Hög | `dig equinet-staging.johanlindengard.com` returnerar nya targets | Flytta tillbaka till equinet-app via UI eller REST API |
| **S67-6** | Verifiera webb-staging publikt fungerar: curl utan SSO-cookie returnerar HTTP 200 + react-shell. Logga in som Erik via DemoLoginButton i incognito browser. | 15 min | Låg | curl `equinet-staging.johanlindengard.com/` → 200, login → dashboard laddas | Återgå till S67-5 rollback |
| **S67-7** | Verifiera iOS staging end-to-end i simulator: Erik login → dashboard renderar bokningar/kunder, kalender + tjänster + bokningar laddar, native API returnerar 200 (inte 401). Mobile-MCP screenshots. | 30 min | Låg | Screenshots visar Erik:s data i iOS, inga 401-felmeddelanden | Inget — verifiering, inte ändring |
| **S67-8** | Cleanup i `equinet-app`: ta bort `staging`-branch-mappning från preview (annars 2 deploys per push). Behåll Preview default DATABASE_URL för feature-branch-PR:er. | 15 min | Låg | GET project domains visar `equinet-staging.johanlindengard.com` borta från equinet-app | POST tillbaka mappningen |
| **S67-9** | Dokumentera nya topology i `docs/operations/environments.md` + `docs/operations/staging-environment-setup.md` + uppdatera `CLAUDE.md` Key Learnings | 30 min | Låg | npm run docs:validate grön | Revertera commit |

**Totalt:** 8-9 stories, ~1-1.5 dagar realistic effort inkl. DNS-väntan och verifiering.

**Föreslagen ordning:** S67-1 → S67-2 → S67-3 → S67-4 → S67-5 → S67-6 → S67-7 → S67-8 → S67-9.

S67-5 (DNS-flytt) är den mest känsliga — bör göras med Johan online och med direkt rollback-möjlighet.

### Guardrail för S67-1: Crons får inte aktiveras i nya staging-projektet förrän risken är hanterad

**Hård regel:** Det nya `equinet-staging-app`-projektet får INTE deployas med aktiva cron-jobb förrän cron-strategin är beslutad och verifierad. Bakgrund: `vercel.json` på `staging`-branchen har idag tre cron-jobb (`/api/cron/send-reminders`, `/api/cron/booking-reminders`, `/api/cron/data-retention`). Om båda projekten plötsligt kör samma cron mot staging-DB → dubbla reminder-mail till staging-kunder, dubblerade data-retention-jobb, oförutsägbara sidoeffekter.

S67-1 är **inte** klar (`done`) förrän minst EN av följande är sann:

1. **Cron-strategi beslutad och verifierad.** Vi har valt en lösning (t.ex. branch-specifik `vercel.json`, env-flag `DISABLE_CRONS=true`, eller annan mekanism) och bevisat empiriskt att crons EJ exekveras i `equinet-staging-app` (verifiering: kontrollera Vercel UI Crons-tab är tom **eller** Cron-loggarna visar inga executions efter 24h schedule-fönster).

2. **Initial deploy verifierad utan aktiva crons.** Första deploy:en av `equinet-staging-app` har gått igenom utan crons aktiverade (verifiering: GET project crons-konfig returnerar tom array eller saknat fält, **plus** Vercel Crons-tab i UI bekräftar tomt).

3. **Crons explicit blockerade i staging.** En guard-mekanism är på plats som garanterar att även om crons-config råkar landa i nya projektet, så kommer endpoint-koden att returnera tidigt utan att exekvera (t.ex. `if (process.env.STAGING_PROJECT) return` i cron-route-handlers, eller motsvarande). **Och** verifierat med en test-trigger som bekräftar early-return.

**Inget av punkterna 1-3 uppfyllt = S67-1 är `in_progress`, inte `done`. Sprinten flyttar inte vidare till S67-2 förrän gateway:n är passerad.**

Om alla tre alternativ visar sig vara tekniskt komplicerade: stoppa S67-1 och eskalera till Johan för beslut om sprint-pivot eller scope-justering. Acceptera **inte** "vi tittar på det senare"-lösning.

---

## Risks

| Risk | Konsekvens | Sannolikhet | Mitigering |
|---|---|---|---|
| **DNS-propagation-väntetid** | `equinet-staging.johanlindengard.com` kan vara icke-nåbar i 5-30 min vid flytt | Hög | Schemalägg DNS-flytt under lugn period (kväll/helg). Kommunicera till sambo/extern delning innan. Vercel cachar oftast snabbt, faktisk DNS-TTL kan vara kort. |
| **Sensitive var-fällan vid env-kopiering** | DATABASE_URL kan landa tom på nya projektet, build kraschar | Hög | Använd REST API DELETE+POST-mönster (per CLAUDE.md learnings 2026-05-06). Verifiera varje var med pull + non-empty-check innan deploy. Pre-build-guard-script (S64-4) bör utökas att validera new project. |
| **Branch drift** | Om `staging`-branch hamnar bakom `main` kan staging visa fel kod | Låg | Status quo idag — staging är aktivt branchat från main vid varje sprint. Lägga till GitHub Action som varnar om staging är >5 commits bakom main. |
| **Dubbla Vercel builds under övergångsfas** | Två deploys av samma kod = 2x build-tid + Vercel resource-användning | Låg | Tillfälligt OK under S67-1 till S67-7. Cleanup i S67-8 stoppar dubbletter. Uppskattad merkostnad: ~5-10 min build × ~5 staging-pushar = 25-50 min ackumulerat under sprint. |
| **Stripe webhook-konfiguration** | Om webhooks i Stripe Dashboard pekar på gammal staging-URL, levereras inte event till rätt projekt | Medel | Auditera Stripe Dashboard webhooks innan S67-5. Om webhooks pekar på staging-URL: skapa ny webhook för nya projektet i S67-4, testa med Stripe CLI `stripe trigger`. |
| **Resend mail-leverans** | `RESEND_API_KEY` är samma men FROM-adress kan vara konfigurerad mot specifik domän | Låg | Resend FROM använder typiskt `equinet.app` eller liknande, inte `johanlindengard.com`. Verifiera att Resend-domain är verifierad och oförändrad. |
| **Anon key / service role-key kollision** | Felaktigt POST:ad nyckel kan exponera service-role till klient eller blocka login | Medel | Kontrollera JWT-claims (`role`, `ref`) före POST — samma validering som för iOS AppConfig prod-key. Anon-key är public OK, service-role får ALDRIG i client-vars. |
| **Nya projektet behöver Custom Access Token Hook i Supabase** | iOS native auth lyckas men `providerId`/`userType`-claims saknas → app-koden får 500 | Låg | Custom Access Token Hook installeras i Supabase-projektet (zzdamokfeenencuggjjp), inte i Vercel. Eftersom vi använder samma Supabase-projekt, är hooken redan aktiv. Inga ändringar behövs. |
| **iOS prod-läge skadas av staging-experiment** | iOS Release-build råkar peka på fel projekt | Låg | Inga AppConfig-ändringar i denna sprint. Prod-build pekar fortfarande på `equinet.johanlindengard.com` + prod-Supabase. |
| **Cron-jobb dubblas** | `vercel.json` har 3 cron jobs (reminders, booking-reminders, data-retention). Om båda projekten kör samma cron mot staging-DB → dubblerade meddelanden | Hög | **Hard guardrail i S67-1** — projektet får inte vara `done` förrän crons är hanterade. Se "Guardrail för S67-1" ovan. Rotorsak: Vercel klassar staging-branch som production i nya projektet, så vanliga `VERCEL_ENV`-kontroller räcker inte. Kandidater: branch-specifik `vercel.json`, env-flag `DISABLE_CRONS`, eller route-handler-tidig-retur. Sprinten stannar i S67-1 tills detta är löst. |
| **Kostnad** | Pro-plan har resurs-limits per team. Två projekt = mer build-tid, mer Vercel Edge Function-invocations | Låg | Pro-plan har generösa limits. Staging-trafik är minimal. Realistiskt ingen kostnadspåverkan. |

---

## Rollout Plan

### Förfas (innan S67-1)

- Bekräfta med Johan att DNS-flytt är OK under planerad period
- Kontrollera Stripe webhook-config — finns det webhooks pekande på staging-URL?
- Backupera `equinet-app` env-vars-snapshot via `vercel env pull` (bara default Production för säkerhets skull, **inte sensitive Preview** som inte returnerar värden)

### Fas 1: Setup nytt projekt (S67-1 till S67-3)

- Skapa projekt
- **Lös cron-risken (S67-1 guardrail)** — bekräfta minst en av de tre DoD-punkterna innan vidare
- Sätt env-vars
- Konfigurera SSO
- Verifiera bygge lyckas (med staging-data) **och att inga oönskade cron-executions sker**

Inga DNS-ändringar än. `equinet-staging-app` är bara nåbar via Vercel-default-URL (`equinet-staging-app.vercel.app` eller liknande). Det räcker för smoke-test.

### Fas 2: Externa beroenden (S67-4)

- Stripe webhooks, Resend, eventuella andra externa integrationer
- Test-event för att verifiera att webhook når nya projektet

### Fas 3: DNS-flytt (S67-5)

**Schemaläggs separat med Johan.** 5-30 min downtime förväntat.

### Fas 4: Verifiering (S67-6 + S67-7)

Webb först (snabbast), iOS sen (kräver simulator + bygge).

### Fas 5: Cleanup (S67-8 + S67-9)

Ta bort gammal mappning + uppdatera dokumentation.

---

## Verification Plan

### Webb (Slice S67-6)

| Check | Förväntat |
|---|---|
| `curl -I https://equinet-staging.johanlindengard.com/` | HTTP 200 (inte 401) |
| Inga `_vercel_sso_nonce`-cookie i Set-Cookie | OK |
| `curl https://equinet-staging.johanlindengard.com/api/feature-flags` | HTTP 200, JSON |
| Incognito browser → DemoLoginButton fungerar | Erik:s dashboard visas |
| Robots noindex header | Tas inte bort (separat slice senare) |

### iOS Simulator (Slice S67-7)

| Check | Förväntat |
|---|---|
| Build med `-STAGING --debug-autologin --debug-email erik.jarnfot@demo.equinet.se --debug-password DemoProvider123!` | Native login lyckas |
| Native dashboard | Visar Erik:s 18 bokningar (eller minst 1) |
| Native kalender | Renderar utan "Kunde inte ladda" |
| Native tjänster | 5 tjänster visas |
| Native API curl-test | `/api/native/dashboard` med Bearer JWT → 200 |
| Mobile-MCP screenshot | Bekräftar visuellt |

### Smoke checks (Slice S67-7 + S67-8)

| Check | Förväntat |
|---|---|
| Stripe webhook-test (om relevant) | 200 från nya projektet |
| Resend mail vid Erik:s booking-bekräftelse | Mail levererad |
| Cron-jobb körs INTE från `equinet-staging-app` | Verifiera Vercel cron-tab är tom |
| `equinet-app` staging-deployment INTE längre triggas vid push | Verifiera bara `equinet-staging-app` deployar |

### Erik demo login

| Steg | Förväntat |
|---|---|
| 1. Öppna `https://equinet-staging.johanlindengard.com` i incognito | Landing-sida laddas, inget SSO |
| 2. Klicka "Demo-login" | Loggar in som Erik direkt |
| 3. Navigera till bokningar | 18 bokningar visas |
| 4. Avsluta session via "Logga ut" | Tillbaka till landing |

---

## Rollback Strategy

| Vid fel i steg | Rollback-åtgärd |
|---|---|
| S67-1 (skapa projekt) | Delete project via UI eller REST API DELETE `/v9/projects/<id>` |
| S67-2 (env-kopiering) | DELETE alla rader via REST API. Project-shellet kvar är harmlöst utan env. |
| S67-3 (SSO-konfig) | PATCH `ssoProtection` tillbaka till null eller olika värde |
| S67-4 (Stripe webhook) | Tillbaka till befintlig webhook-config i Stripe Dashboard |
| S67-5 (DNS-flytt) | **Mest kritisk.** Flytta domain tillbaka till `equinet-app` via UI eller REST API. DNS-propagation tar 5-30 min. |
| S67-6 (webb verifiering failar) | Behåll nya projektet, debugga env-konfiguration. Om olösbar inom 30 min: rollback S67-5. |
| S67-7 (iOS verifiering failar) | iOS-fel betyder app-kod-bug, inte infra. Logga och fixa separat. |
| S67-8 (cleanup) | POST tillbaka mappningen i `equinet-app` |
| S67-9 (docs) | Revertera commit |

**Master-rollback:** Om sprinten halv-genomförd och Johan vill abort:a, säkerställ att DNS pekar tillbaka till `equinet-app` (S67-5 rollback) → all gammal funktionalitet återställd. Nya projektet kan deletas i lugn ordning.

---

## Out of Scope

| Vad | Varför inte denna sprint |
|---|---|
| Native DemoLoginButton i iOS | Demo-login finns bara i webb. Separat slice S67-X eller framtida sprint. |
| Bundle ID-strategi för iOS App Store | iOS App Store-publik kräver Apple Developer Program. Inte demo-blocker. |
| `noindex`-header på staging | Föreslogs i webb-audit men är förbättring, inte blocker. Separat slice. |
| Prod custom domain-flytt | Prod fungerar redan. Inga ändringar i `equinet.johanlindengard.com`. |
| Maria Lindgren rebrand till `maria.lindgren@demo.equinet.se` | Maria är teknisk fixture, inte demo-persona. Out of scope. |
| Pre-build-guard som rejecter tomma critical env vars | Föreslogs efter S64-4 + 2026-05-06-incident. Separat slice. |
| Ta bort `equinet-app-test.johanlindengard.com` (legacy custom domain) | Cleanup, inte demo-blocker. |
| Migrera Stripe live-mode keys till nya projektet | Nya projektet är staging — får aldrig live-keys. |
| iOS Release-build-test mot prod | Out of scope — vi verifierar staging, inte prod-iOS. |
| Sentry-projekt-separation (staging vs prod) | Idag kan staging logga till samma Sentry — separat slice om det blir bullrigt. |

---

## STOPP — inväntar Johan innan någon infra ändras

Inga ändringar utförda i:
- Vercel (inga nya projekt, inga env-skrivningar, inga DNS-flyttar)
- Supabase (inga env, inga RLS, inga seed)
- Webb-koden (inga commits)
- iOS-koden (inga commits)
- Git (denna fil är untracked tills Johan godkänner commit)

Working tree:
- `docs/sprints/sprint-67-ios-staging-capability.md` (ny — denna fil)

Säg:
- **"plan godkänt — committa sprint-doc"** — committa direkt till `staging` (lifecycle-doc per `commit-strategy.md`)
- **"redigera plan"** — vad ska ändras
- **"kör S67-1 — skapa Vercel-projekt"** — starta första story
- **"vänta, fundera"** — annan riktning

Inväntar.
