---
title: "Equinet Technical Reset – Demo Mode, Login & Production Readiness"
description: "Senior tech lead-genomlysning av demo mode (lokal + prod), login/auth, environment och Vercel-config — fakta vs hypotes, sannolika rotorsaker till produktionsproblemet samt prioriterad plan"
category: operations
status: superseded
last_updated: 2026-05-02
tags: [audit, demo-mode, auth, supabase, vercel, production-readiness]
sections:
  - Status update 2026-05-01 (post-incident)
  - 1. Executive summary
  - 2. Vad som verkar klart (fakta)
  - 3. Vad som är osäkert
  - 4. Vad som verkar trasigt eller riskabelt
  - 5. Sannolika rotorsaker till produktions-login-problemet
  - 6. Fakta vi behöver verifiera manuellt
  - 7. Rekommenderad prioritering
  - 8. Förslag på minsta möjliga nästa tekniska slice
  - 9. Test- och verifieringsplan
  - 10. Appendix
  - Top 5 risks
  - Top 5 next actions
  - Do not change yet
---

# Equinet Technical Reset – Demo Mode, Login & Production Readiness

> **Status update 2026-05-01:** Login i produktion är manuellt verifierad av Johan och **fungerar**. Incidenten avslutas. Rapporten nedan behålls som teknisk referens, men de akuta sektionerna (5 = sannolika rotorsaker, 6 = manuell verifiering, 8 = nästa tekniska slice) är **inte längre aktiva spår**. Fortsatt arbete styrs av `docs/operations/demo-readiness-next-steps.md`. S65-1 callback-hotfix kvarstår som viktig städning men är **inte akut incident** så länge `/auth/callback` inte är aktiverad i Supabase Redirect URLs.
>
> Genomlysning utförd 2026-05-01 av tech lead-session. **Inga kodändringar gjorda.** Underlaget är repo-state på `main` (HEAD = `c711079a`), med särskilt fokus på Sprint 64 (mergad 2026-04-30) och planerad Sprint 65 (post-merge tech-lead-review samma kväll).
>
> Notation: **[Fakta]** = direkt bevisat i repo/config/dokumentation. **[Hypotes]** = härledd slutsats som måste verifieras mot körande system.

---

## 1. Executive summary

Equinet har **just genomlevt en akut login-incident i produktion 2026-04-30** där Johan inte kunde logga in. Felsökningen avslöjade en kedja på sju oberoende fel som maskerade varandra. Sprint 64 levererade hotfixar på alla sju, mergades, och login fungerar nu i prod **enligt sprintplanens nuläge-text**. Men:

- Tech-lead-review samma kväll hittade **3 BLOCKERS + 7 MAJORS + 5 MINORS** i den nyligen mergade koden. Sprint 64 är **inte release-klar**, och en separat Sprint 65 finns planerad för follow-through. **[Fakta — `docs/sprints/sprint-65.md` rad 14–47]**
- Den **nya `/auth/callback`-routen (S64-6)** har en open-redirect-svaghet, ingen `redirectTo`-validering och hardkodad provider-routing. Den får INTE aktiveras i Supabase Redirect URLs förrän hotfix S65-1 mergats. Om någon i panik lagt in callback-URL:en där ändå kan magic link-flödet stå för den nu rapporterade login-incidenten. **[Fakta — `src/app/auth/callback/route.ts` + `sprint-65.md` S65-1]**
- "Fire-and-forget"-fixet i S64-1 byter ut tyst leveransbortfall mot 15 sekunders latency + samma tysta leveransbortfall vid Resend-timeout. Användaren får "kontot skapat"/"reset-mail skickat" även när mailet aldrig levererats. **[Fakta — `sprint-65.md` S65-2 + `src/domain/auth/AuthService.ts:300-303`]**
- Demo-läget är **enbart en UI-skärm** (kosmetik) och styrs av två oberoende mekanismer: env-flagga `NEXT_PUBLIC_DEMO_MODE` och databas-feature-flag `demo_mode`. Tekniskt finns ingen risk att demo-läget blockerar login eller skadar prod-data. Men UX-glapp mellan lokal och prod kan uppstå om de två mekanismerna sätts olika. **[Fakta — `src/lib/demo-mode.ts` + `src/lib/feature-flags.ts:75-77`]**

**Viktigast:** Det går **inte** att från repo ensam avgöra om login är trasig i prod just nu. Spårningen visar att Sprint 64 stängde det kända problemet, men S65-1/S65-2 är ännu inte gjorda. **Verifiering mot live-prod är nödvändig innan teknisk åtgärd tas.**

---

## 2. Vad som verkar klart (fakta)

### 2.1 Demo mode

- **Var implementerat:** `src/lib/demo-mode.ts` (44 rader, hela ytan). Två funktioner: `isDemoMode()` (env-only) och `isDemoModeWithFlags(flags)` (env + DB-flagga). En allowlist `DEMO_ALLOWED_PATHS` med 9 provider-routes.
- **Två oberoende aktiverings-vägar:**
  1. Miljövariabel `NEXT_PUBLIC_DEMO_MODE=true`
  2. Databas-feature-flag `demo_mode` (default `false`, togglas via `/admin/system`)
- **Specialhantering i feature-flag-resolverare:** `src/lib/feature-flags.ts:75-77` läser `NEXT_PUBLIC_DEMO_MODE` istället för förväntad konvention `FEATURE_DEMO_MODE`. Det är **enda flaggan** med denna avvikelse.
- **Påverkar BARA UI:** Provider-nav, Header, BottomTabBar, BugReportFab, CustomerNav samt 9 sidor som villkorligt renderar. **Ingen API-route blockeras** och **ingen data filtreras** (CLAUDE.md har explicit regel: "Demo-läge — filtrera ALDRIG data"). **[Fakta — `docs/demo-mode.md` + grep i `code-map.md`]**
- **Lokalt:** Dokumenterat flöde `NEXT_PUBLIC_DEMO_MODE=true` i `.env.local` + `npm run db:seed:demo:reset` + `provider@example.com` / `ProviderPass123!`.
- **Prod:** Aktiveras via admin → `/admin/system` togglar databas-flaggan `demo_mode`. Default `false` i kod.

### 2.2 Demo seed

- **Fil:** `prisma/seed-demo.ts` (641 rader). Idempotent för tjänster/kunder/hästar (upsert/findFirst), bokningar bara om inga `@demo.equinet.se`-bokningar finns. `--reset` raderar och återskapar.
- **Förutsätter:** `provider@example.com` finns redan (skapas av `seed-test-users.ts`). Om provider saknas → `process.exit(1)`.
- **Skapar:** Maria Lindgren / Lindgrens Hovslageri & Ridskola, 4 tjänster, 4 kunder (`@demo.equinet.se`), 3 hästar, 7 bokningar (mix bekräftade/pending/genomförda/avbokade), 3 reviews, schema mån–fre 08–17.
- **Kommandon:** `npm run db:seed:demo`, `npm run db:seed:demo:reset`, `npm run db:seed:demo-provider`. **[Fakta — `package.json` rad 17–20]**
- **Identifiering:** Bokningar via customer-email `@demo.equinet.se`, hästar via `specialNeeds: "DEMO-SEED"`, kunder via email-suffix.
- **Prod-anrop:** Manuellt kommando, körs **aldrig** av CI eller deploy-scriptet. Måste köras med `DATABASE_URL` pekande på prod-Supabase. **[Fakta — `docs/demo-mode.md` rad 152]**

### 2.3 Login/auth

- **Auth-provider:** Supabase Auth (cookie-baserat via `@supabase/ssr`) + Bearer JWT för iOS native. Ingen NextAuth, ingen tredjeparts-OAuth aktiv idag. **[Fakta — `src/lib/auth-dual.ts` rad 1–22, `middleware.ts` rad 1–7]**
- **Login-flöde (web):** `(auth)/login/page.tsx` → `createSupabaseBrowserClient().auth.signInWithPassword(email, password)` → cookies sätts av `@supabase/ssr` → `router.push("/dashboard")`. **[Fakta — `src/app/(auth)/login/page.tsx:49-72`]**
- **Middleware:** `middleware.ts` använder `getUser()` (server-validerar JWT, refreshar token, skriver om cookies). Vid valid user läses `app_metadata` för `userType` och `isAdmin`. Vid admin → kollas MFA-AAL.
- **Auth-helper i routes:** `src/lib/auth-dual.ts` delegerar till Supabase men **gör alltid en DB-lookup** mot `User`-tabellen för `providerId`/`stableId`/`isAdmin`. JWT-claims betros aldrig — DB är source of truth. **[Fakta — `auth-dual.ts:67-95`]**
- **Skyddade paths:** Middleware täcker `/api/bookings/*`, `/api/routes/*`, `/api/route-orders/*`, `/api/services/*`, `/api/provider/*`, `/api/admin/*`, `/provider/*`, `/customer/*`, `/dashboard/*`, `/admin/*`. **[Fakta — `middleware.ts:73-89`]**
- **Callback-route:** `/auth/callback` (S64-6, mergad 2026-04-30) — anropar `supabase.auth.exchangeCodeForSession(code)` och redirectar till `/provider/dashboard`. **Hardkodad redirect**, **läser `origin` från request URL**, **ingen `next`-validering**. **[Fakta — `src/app/auth/callback/route.ts:1-24`]**
- **CSP `connect-src`:** Läser från `NEXT_PUBLIC_SUPABASE_URL` (post-hotfix `9410dd21`, 2026-04-30). Tidigare hardkodad → spärrade alla auth-anrop när Supabase-projekt-URL ändrades. **[Fakta — `sprint-64.md` rad 21–24]**

### 2.4 Production / Vercel-config

- **Vercel.json:** Bara `regions: ["fra1"]` (matchar Supabase `eu-central-2`) + 3 cron-jobs (`send-reminders`, `booking-reminders`, `data-retention`). Inga rewrites/redirects/headers. **[Fakta — `vercel.json`]**
- **Build-command:** Default `next build --webpack` via `package.json` "build". Pre-build körs alltid: `tsx scripts/check-prod-env.ts`. **[Fakta — `package.json:10` + `prebuild`-step rad 9]**
- **Pre-build env-guard:** `scripts/check-prod-env.ts` (S64-4) faller bygget om någon av 11 vars saknas i `VERCEL_ENV=production`. Listan **saknar `STRIPE_WEBHOOK_SECRET`** — kvar i Sprint 65 som S65-4. **[Fakta — `scripts/check-prod-env.ts:1-13`]**
- **Krävda prod-env (11):** `APP_URL`, `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `FROM_EMAIL`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- **Sentry:** Konfigurerad i `sentry.{client,server,edge}.config.ts` — felfångst aktiv om `NEXT_PUBLIC_SENTRY_DSN` är satt.
- **Edge Config:** Feature flags läses först från `@vercel/edge-config` (`<1ms`), sedan DB-fallback med 30s cache. **[Fakta — `src/lib/feature-flags.ts:39-67`]**

### 2.5 Feature flags

18 flags definierade i `src/lib/feature-flag-definitions.ts`. Av dessa är följande relevanta för demo/auth/booking/payment:

| Flag | Default | Risk för demo/login |
|------|---------|---------------------|
| `demo_mode` | `false` | UI-only, ingen risk för login |
| `customer_invite` | (saknas i array, var GA i S62) | Ingen risk |
| `messaging` | `true` | Påverkar inte login |
| `stripe_payments` | `false` | Aktiverar Stripe i checkout. Bryter inte login. |
| `provider_subscription` | `false` | Hela subscription-flödet av/på |
| `data_retention` | `false` | Cron som städar gamla konton — **risk att demo-användare raderas om aktiverad i prod** |
| `supabase_auth_poc` | `false` | Test-route, oviktig |
| `push_notifications` | `false` | iOS-only, ingen webb-impact |
| Övriga 10 (route_planning, voice_logging, customer_insights, due_for_service, group_bookings, m.fl.) | `true` | UI-features, inga auth-effekter |

**[Fakta — `src/lib/feature-flag-definitions.ts`]**

### 2.6 Tester / E2E / CI

- **Unit/integration:** 4375 tester i Vitest (per MEMORY.md, 2026-04-25). **[Fakta — `MEMORY.md` rad ~52]**
- **E2E (Playwright):** 29 specs, körs serial (workers: 1). Auth-tester finns: `e2e/auth.spec.ts`. Smoke-set = `auth.spec.ts + exploratory-baseline.spec.ts`. Critical-set = `booking + payment + provider`.
- **Demo mode-flöde i E2E:** **Inget dedikerat E2E-test för demo mode-flödet.** **[Fakta — `package.json` rad 44–45 + `playwright.config.ts`]**
- **CI kör:** Unit + coverage, E2E, Offline E2E smoke, TypeScript, build (per CLAUDE.md "Automated Quality Gates").
- **CI-databas:** Lokal Supabase CLI (port 54322), inte prod-databas. Ingen E2E körs mot prod.

---

## 3. Vad som är osäkert

| # | Osäkerhet | Varför |
|---|-----------|--------|
| 1 | Är Sprint 64-merge faktiskt deployad till prod? | `git log` visar merge-commit, men ingen automatiserad deploy-bekräftelse i repot |
| 2 | Är `demo_mode`-flaggan på eller av i prod-Supabase just nu? | DB-state inte i repot |
| 3 | Är `https://equinet-app.vercel.app/auth/callback` redan inlagd i Supabase Redirect URLs? | Sprint-65-noteringen säger "FÅR INTE läggas in", men det är en social regel, inte teknisk |
| 4 | Vilken är den faktiska prod-domänen? | `docs/demo-mode.md:128` säger `equinet-app.vercel.app`, `CLAUDE.md` "iOS Prod URL" säger `equinet.vercel.app`. Två olika strängar nämns i repot |
| 5 | Existerar `provider@example.com` i prod-databasen? | Demo-seeden förutsätter det. Inget i repo bekräftar/dementerar |
| 6 | Är CSP-hotfixet (commit `9410dd21`) faktiskt levt i prod? | Mergad till main 2026-04-30 men deploy-status osäker från repo |
| 7 | Är Vercel-env-värdena rena från literal `\n` i preview/development? | Sprint 64-2 markerad `done` ("verifierat: NEXT_PUBLIC_SUPABASE_URL + ANON_KEY rena i preview+dev"), men prod-statusens slutkontroll lutar på Johans inrapportering |
| 8 | Pekar `APP_URL` i Vercel prod på exakt rätt hostname? | Var huvud-rotorsaken 2026-04-30; uppgraderat sedan dess men inte verifierat i denna session |
| 9 | Påverkar S64-6:s `/auth/callback` det vanliga email/password-login-flödet? | Tekniskt nej (inget existerande flöde anropar callbacken), men om Supabase Site URL ändrats till `/auth/callback` följer email/password-redirect den nya regeln — **kan vara faktiska rotorsaken** |
| 10 | Är fire-and-forget i S65-3-routes (reschedule, invites, booking-series) levande i prod? | Om ja → kunder får inte boknings-mail. Inte login-blocker men viktig demo-blocker |

---

## 4. Vad som verkar trasigt eller riskabelt

### 4.1 Tekniskt trasigt — bekräftade fynd från tech-lead-review (sprint-65.md)

| ID | Område | Allvar | Status |
|----|--------|--------|--------|
| B1 | `auth/callback`-routen läser `origin` från `request.url` → open redirect via manipulerad Host-header på Vercel preview | **Blocker** | Inte fixad |
| B2 | `auth/callback` saknar `redirectTo`/`next`-validering. Hardkodad `/provider/dashboard` | **Blocker** | Inte fixad |
| B3 | Alla användare → `/provider/dashboard` oavsett `userType`. Kund som loggar in via magic link → 403/blank screen | **Blocker** | Inte fixad |
| M4 | Fire-and-forget-fixet i AuthService → "konto skapat"-success även vid Resend-timeout | Major | Sprint 65 S65-2 |
| M5 | Fire-and-forget kvar i `bookings/[id]/reschedule`, `stable/invites`, `provider/customers/[customerId]/invite`, `booking-series/route` | Major | Sprint 65 S65-3 |
| M1 | "Byt lösenord" invaliderar inte sessioner på andra enheter | Major | Sprint 65 S65-5 |
| M2 | Change-password delar rate-limiter med forgot-password (3/h per IP, CGNAT-gemensam) | Major | Sprint 65 S65-6 |
| M3 | Change-password är öppen för **alla** auth:ade userType, trots att UI bara finns för leverantör | Major | Sprint 65 S65-7 |
| M6 | `STRIPE_WEBHOOK_SECRET` saknas i `check-prod-env.ts` | Major | Sprint 65 S65-4 |
| Mi1 | `Cache-Control: no-store` saknas i auth-routens responses | Minor | Sprint 65 S65-1 |
| Mi4 | Engelsk Supabase-felmeddelanden läcker via redirect-URL ("code already used") | Minor | Sprint 65 S65-1 |

### 4.2 Konfigurations-risker

- **Domänkonfusion:** `equinet-app.vercel.app` (i `docs/demo-mode.md`, `sprint-64.md` rad 50, `sprint-65.md` rad 49) vs `equinet.vercel.app` (i `CLAUDE.md` exempel-URL). **Om Vercel-deploymentens hostname inte exakt matchar APP_URL/Supabase Site URL/Supabase Redirect URLs är login trasig.** **[Fakta + Hypotes]**
- **`.env.local` skuggar `.env`:** Vercel CLI:s `vercel env pull` skriver till `.env.local` med prod-credentials, vilket trumfar `.env`. CLAUDE.md varnar om detta — men gäller bara dev-maskiner, inte prod.
- **NEXT_PUBLIC_-prefix krävs för demo_mode env:** Om någon i Vercel UI satt `FEATURE_DEMO_MODE` istället för `NEXT_PUBLIC_DEMO_MODE` får klient-bundeln aldrig värdet (bara feature-flag-resolveraren), vilket ger inkonsistent upplevelse mellan SSR och CSR.
- **Demo-seed kräver provider@example.com:** Om den raderats i prod (GDPR-cleanup, manuell rensning, `data_retention`-cron) → seed-skript exit 1. **Risk: en cron-aktivering kan radera demo-grunden.**

### 4.3 Process-risker

- **Sprint 64-stories markerade `done` trots Blockers:** Status.md visar "done (4932c0f1)" på S64-6 med kommentaren "**3 BLOCKERS i route**, FÅR INTE aktiveras". Om någon snabbtittar på status.md kan de tro att routen är säker. Risk för deploy-misstag.
- **Inget E2E-test täcker demo-läget end-to-end:** Demo är bara visuellt verifierat manuellt. Regression i UI-filtreringen kan slinka igenom.
- **Inget E2E-test simulerar prod-domän eller produktions-Supabase.** Smoke- och critical-svit körs alltid mot lokal Supabase CLI på 54322.

---

## 5. Sannolika rotorsaker till produktions-login-problemet

> Användaren rapporterar "login/inloggning verkar strula i produktion". Källan saknar exakt felmodus (toast? blank? redirect-loop? 401? cookies sätts ej?), så listan rangordnas efter sannolikhet givet känd repo-state.

### Hypotes 1 — `/auth/callback` aktiverad för tidigt i Supabase Redirect URLs (HÖG sannolikhet)

**Mekanism:** Sprint 64 mergade routen 2026-04-30. Sprint 65-noten säger uttryckligen "FÅR INTE aktiveras". Om Johan ändå lade in `https://<domain>/auth/callback` (eller om Site URL ändrades) **och** Supabase nu skickar verifieringsmail/password-reset-mail som pekar mot callback-URL:en, så hamnar användaren på en route med 3 BLOCKERS:
- Open redirect via manipulerad Host
- Hardkodad redirect till `/provider/dashboard`
- Kund-användare får 403 vid landning

**Symptom som matchar:** Användare klickar på email-länk → landar i blank/403 på provider-dashboard, eller redirectas felaktigt. Login via formulär fungerar fortfarande.

**Verifiering:** Kontrollera Supabase Dashboard → URL Configuration → Redirect URLs allowlist. Kontrollera Supabase Site URL.

### Hypotes 2 — Domän-mismatch mellan `APP_URL`, Supabase Site URL och faktisk Vercel-hostname (HÖG)

**Mekanism:** Repot refererar både `equinet-app.vercel.app` och `equinet.vercel.app`. Om APP_URL pekar på en variant och Supabase Site URL/Redirect URLs på en annan → email-länkarna pekar på en URL som Supabase inte accepterar, eller cookies sätts på fel domän.

**Symptom som matchar:** Användare loggar in, cookies sätts, men nästa anrop tappar session pga cross-site-cookie-restriktioner. Eller email-bekräftelse-länkar pekar på fel hostname → 404.

**Verifiering:** Kör `vercel inspect <prod-deployment>` eller titta i Vercel UI → Deployments → senaste deployment → Domains. Jämför med APP_URL och Supabase URL Configuration.

### Hypotes 3 — Fire-and-forget i password reset / register dödar email tyst (MEDEL)

**Mekanism:** S64-1 bytte ut `.catch(() => {})` mot blocking await med 15s timeout. Vid Resend-timeout returnerar AuthService **fortfarande** `Result.ok({ sent: true })`. Användaren ser "konto skapat / mail skickat" men inget mail kommer.

**Symptom som matchar:** Inte ett akut "login-fel", men användaren kan inte komma in eftersom verify-email-mail aldrig anländer. Räknas av användaren som "login funkar inte".

**Verifiering:** Kontrollera Resend dashboard → har de senaste 10 password reset-anropen levererats? Kontrollera Sentry för `EMAIL_DELIVERY` warnings.

### Hypotes 4 — Vercel env-värden med literal `\n` i prod (LÅG, men dokumenterat hänt)

**Mekanism:** Sprint 64-2 städade preview/dev efter att prod städats. Om en deploy därefter **återinjicerade** `\n` (t.ex. via `vercel env pull` + `vercel env add` round-trip), bryts Supabase URL:en igen.

**Symptom som matchar:** **Alla** auth-anrop failar samtidigt (CSP-block + DNS-resolve-fel på `https://abc.supabase.co\n`).

**Verifiering:** `vercel env pull --environment=production` + cat-inspektion (utan att skriva ut nyckeln, bara längd och slutkaraktärer).

### Hypotes 5 — Custom Access Token Hook (PL/pgSQL) borttagen eller bruten (LÅG)

**Mekanism:** Custom Access Token Hook ger JWT-claims `providerId`, `userType`, `isAdmin`. `auth-dual.ts` litar inte på claims (DB-lookup), men `middleware.ts:38-50` läser `app_metadata.userType` och `app_metadata.isAdmin` direkt. Vid saknade claims → default `customer` + `isAdmin: false` → admin loggar in men hamnar fel.

**Symptom som matchar:** Vissa userTypes kan logga in (kund), andra (admin/provider) får märkliga redirect-loopar.

**Verifiering:** Supabase Dashboard → Authentication → Hooks → Access Token Hook installerad och aktiv?

### Hypotes 6 — Migration drift på prod-DB (LÅG)

**Mekanism:** MEMORY.md noterar "5 migrationer saknas på prod, 1 failed post". Om `User`-tabellen eller `auth.users`-trigger inte är synkad → `auth-dual.ts` DB-lookup returnerar `null` → 500 i routes.

**Symptom som matchar:** Login lyckas (cookies sätts), men varje subsequent API-anrop returnerar "Ej inloggad" eller 500.

**Verifiering:** `npm run migrate:status` (jämför lokala vs Supabase namnbaserat).

---

## 6. Fakta vi behöver verifiera manuellt

> Listan är ordnad så att de billigaste verifieringarna kommer först.

| # | Fakta att verifiera | Hur (kommando / UI) | Tar |
|---|---------------------|---------------------|-----|
| 1 | Exakt feltext + screenshots från det som upplevs som "login funkar inte" | Be Johan reproducera och bifoga konsoll-loggar | 5 min |
| 2 | Aktuell prod-hostname i Vercel | `vercel inspect --prod` eller Vercel UI → Deployments | 2 min |
| 3 | Värdet på `APP_URL` i prod | Vercel UI → Project Settings → Environment Variables | 2 min |
| 4 | `NEXT_PUBLIC_SUPABASE_URL` rent från `\n` i prod | Vercel UI eller `vercel env pull --environment=production` (skriv inte ut nyckel) | 5 min |
| 5 | Supabase Site URL och Redirect URLs | Supabase Dashboard → URL Configuration | 3 min |
| 6 | Är `/auth/callback` redan i Redirect URLs allowlist? | Supabase Dashboard | 1 min |
| 7 | Custom Access Token Hook installerad och aktiv | Supabase Dashboard → Authentication → Hooks | 2 min |
| 8 | Senaste prod-deploy = post-CSP-hotfix `9410dd21`? | `git log --oneline 9410dd21^..HEAD` + Vercel deploy-logg | 3 min |
| 9 | Resend dashboard — senaste 24h leveransstatus | Resend.com Dashboard → Emails | 5 min |
| 10 | Sentry — senaste 24h auth-relaterade fel | Sentry → Issues → tag:auth | 5 min |
| 11 | `provider@example.com` finns i prod-DB | Supabase Dashboard → SQL Editor: `SELECT email FROM "User" WHERE email = 'provider@example.com'` | 2 min |
| 12 | Migration drift mot prod | `npm run migrate:status` | 2 min |
| 13 | `demo_mode`-flaggan i prod-DB | `/admin/system` eller SQL: `SELECT * FROM "FeatureFlag" WHERE key = 'demo_mode'` | 2 min |

**Total verifieringstid: ~40 minuter, helt utan kodändring.**

---

## 7. Rekommenderad prioritering

### Akut (idag)

1. **Reproducera login-felet i prod.** Be Johan: vilken URL? Vilken e-post? Vilket felmeddelande? Konsoll-output?
2. **Kontrollera Supabase URL Configuration.** Site URL + Redirect URLs. Om `/auth/callback` ligger där: ta **bort** den tills S65-1 är mergad.
3. **Verifiera APP_URL i Vercel prod = exakt prod-hostname.**
4. **Verifiera NEXT_PUBLIC_SUPABASE_URL ren från `\n`.**

Inga kodändringar krävs i steg 1–4. Verktygsstegen är repo-externa.

### Hög (1–3 dagar)

5. **S65-1: Hotfix `/auth/callback`** — open redirect, redirectTo-validering, userType-routing, `Cache-Control: no-store`. Ej onödig att vänta på.
6. **S65-2: Riktig fire-and-forget-fix** (fail loud i AuthService).
7. **S65-3: Eliminera kvarstående fire-and-forget** i reschedule + invites + booking-series.

### Medel (innan demo)

8. Lägg till **dedikerat E2E-test** för demo mode-flöde (login → dashboard → bokningar → kunder → tjänster).
9. Lägg till **smoke-test mot Vercel preview** efter varje deploy, som verifierar att login-rutten returnerar 200 (utan att faktiskt logga in).
10. **S65-4–S65-7** (CI-guard, session-invalidering, rate-limiter, userType-guard).

### Senare (post-demo)

11. **URL-konfigurationsmatris** (S64-7) — redan klar, men referera från CLAUDE.md.
12. Lägg till **demo-seed-validering** (förvarna om `provider@example.com` saknas i target-DB).

---

## 8. Förslag på minsta möjliga nästa tekniska slice

> Mål: bevisa att login fungerar i prod på en känd, deterministisk rutt. Rör inte koden.

**Slice 0 — Diagnos (0 kod, ~40 min):**

1. Be Johan reproducera felet med stegen i sektion 6, items 1–6. Logga skärmdumpar.
2. Slå av eventuell felaktig Redirect URL i Supabase. Logga datum/tid.
3. Verifiera APP_URL och Supabase URL Configuration matchar exakt deployment-hostname.
4. Försök login igen. Om fix → dokumentera i `docs/retrospectives/2026-05-01-login-incident.md`.

**Slice 1 — S65-1 hotfix (1–2 timmar kod, ~3 timmar inkl. test/PR):**

Bara om Slice 0 inte löser problemet, eller om callback-routen identifieras som kritisk:

- Refaktorera `src/app/auth/callback/route.ts` enligt S65-1:s acceptanskriterier (i sprint-65.md rad 76–91).
- Skriv integration-test som verifierar happy path + open redirect-försök.
- Ej deploy förrän test:e2e:smoke + manuell verifiering av magic-link-flöde lyckats.

**Inte i denna slice:** S65-2 (fire-and-forget fail loud) — viktig men separat. S65-3..-7 — separata. Demo-seed-förändringar — onödigt.

---

## 9. Test- och verifieringsplan

### Manuell verifiering

| Steg | Förväntat resultat |
|------|--------------------|
| 1. Öppna prod-URL → /login | Sidan renderas, ingen dev-banner, "Logga in på Equinet" syns |
| 2. Logga in med fungerande kontotyp `provider` | Redirect till `/dashboard` (eller `/provider/dashboard`), cookies satta (`sb-*`) |
| 3. Refresha sidan | Inloggning behålls (middleware refreshar token, dashboard renderas) |
| 4. Logga ut | Cookies rensade, redirect till `/login` |
| 5. Klicka "Glömt lösenord" | Email skickat (verifiera i Resend dashboard), success-toast |
| 6. Klicka länken i mailet | **Förväntat före S65-1:** ENDAST OM `/auth/callback` är aktiverad → potentiellt felaktig redirect. Annars: använder `/reset-password`-flödet |
| 7. Sätt nytt lösenord | Lyckas, redirect till login |
| 8. Logga in med admin-konto | Redirect till `/admin/mfa/verify` (om MFA enrolled) |
| 9. Logga in med kund-konto | Redirect till kund-dashboard (`/dashboard` eller `/customer/...`) |

### Automatiserad

- **Aktivera Playwright `auth.spec.ts`** mot Vercel preview-URL via en CI-job som körs efter varje deploy. Idag körs bara mot localhost.
- **Lägg till smoke-test** som hämtar `https://<prod-domain>/login` och verifierar 200 + förväntad text.
- **E2E-test för demo-flödet** (saknas idag): login → dashboard → bokningar → kunder → tjänster, verifiera att inga sekundära nav-element renderas, inga "DEMO-SEED"-strängar i UI.

### Telemetri

- **Sentry-alert** för auth-fel >5/min.
- **Vercel-analytics** kontrollera om `/login`-sidan har 4xx-toppar.
- **Resend-leverans-rate** över rullande 7 dagar.

---

## 10. Appendix

### 10.1 Filer analyserade

| Fil | Roll i analysen |
|-----|----------------|
| `src/lib/demo-mode.ts` | Kärnan i demo mode |
| `docs/demo-mode.md` | Operations-doc för demo |
| `docs/demo-seed.md` | Beskriver seed-script |
| `docs/demo-go-no-go.md` | Demo-go/no-go-bedömning |
| `docs/product-audit/demo-readiness.md` | Tidigare demo-audit |
| `docs/archive/demo-flow-issues-demo-mode-round-2.md` | Demo round 2-iteration |
| `prisma/seed-demo.ts` | Demo-seed-script |
| `package.json` | Scripts (`db:seed:demo`, `prebuild`, `test:e2e:*`) |
| `src/lib/auth-dual.ts` | Auth-helper för API-routes |
| `middleware.ts` | Edge auth-middleware |
| `src/app/(auth)/login/page.tsx` | Login-form (klient-komponent) |
| `src/app/auth/callback/route.ts` | S64-6 callback-route med 3 BLOCKERS |
| `src/app/api/auth/register/route.ts` | Register-route + AuthService-anrop |
| `src/app/api/auth/session/route.ts` | Session-state-endpoint |
| `src/lib/supabase/server.ts` | Supabase server client (SSR) |
| `src/lib/supabase/browser.ts` | Supabase browser client |
| `src/lib/feature-flag-definitions.ts` | 18 feature flags |
| `src/lib/feature-flags.ts` | Server-resolverare med Edge Config + DB |
| `vercel.json` | Region + crons |
| `.env.example` | Dokumenterade env-variabler |
| `scripts/check-prod-env.ts` | Pre-build env-guard (S64-4) |
| `playwright.config.ts` | E2E-konfig + webServer-env |
| `docs/sprints/sprint-64.md` | Sprint 64 — 7 hotfix-stories |
| `docs/sprints/sprint-65.md` | Sprint 65 — 7 follow-through-stories |
| `docs/sprints/status.md` | Aktuell sprint-status |

### 10.2 Env-variabler översikt

#### Krävs i prod (gate via prebuild)

| Variabel | Roll | Senaste incident |
|----------|------|------------------|
| `APP_URL` | Bas-URL för email-länkar | **Saknades 2026-04-30** → alla mail-länkar pekade på localhost |
| `DATABASE_URL` | Prisma + Supabase pooler | Måste innehålla `&connection_limit=1` |
| `DIRECT_DATABASE_URL` | Prisma migrate (utan pgbouncer) | — |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase REST/auth, klient-bundle, CSP | **Hade `\n`-suffix 2026-04-30** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Klient JWT-signering | **Hade `\n`-suffix 2026-04-30** |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin (Bearer-validering) | — |
| `RESEND_API_KEY` | Email-skicke | — |
| `FROM_EMAIL` | Avsändaradress | — |
| `STRIPE_SECRET_KEY` | Server Stripe | — |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Klient Stripe | — |
| `UPSTASH_REDIS_REST_URL` | Rate-limit | — |
| `UPSTASH_REDIS_REST_TOKEN` | Rate-limit | — |

#### Saknas idag i prebuild-listan men används

| Variabel | Roll | Story att fixa |
|----------|------|----------------|
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook-validering | S65-4 |
| `CRON_SECRET` | Cron-job-validering | — |
| `ENCRYPTION_KEY` | Fortnox OAuth-token | — (om Fortnox används i prod) |
| `APNS_*` | Push-notiser iOS | — |
| `ANTHROPIC_API_KEY` | Voice-logging | — |
| `NEXT_PUBLIC_SENTRY_DSN` | Felfångst | — |
| `SENTRY_AUTH_TOKEN` | Source-map upload | — |

#### Demo-specifik

| Variabel | Roll |
|----------|------|
| `NEXT_PUBLIC_DEMO_MODE` | UI-only demo-switch (klient + server). **Specialhanterad** i feature-flag-resolveraren — använd INTE `FEATURE_DEMO_MODE` |
| `ALLOW_TEST_ENDPOINTS` | Dev/CI-only — exponerar `/api/test/*`. **Får ej sättas i prod.** |

### 10.3 Scripts relevanta för demo / login

| Script | Vad den gör | När |
|--------|-------------|-----|
| `npm run db:seed` | Bas-seed (test-användare) | Lokalt, CI |
| `npm run db:seed:demo` | Demo-data ovanpå provider@example.com | Manuellt |
| `npm run db:seed:demo:reset` | Rensa + återskapa demo-data | Manuellt |
| `npm run db:up` / `db:down` | Supabase CLI lokalt | Dev |
| `npm run migrate:status` | Pending/drift mot Supabase | Före deploy |
| `npm run env:status` | Visa aktiv DATABASE_URL | Felsökning |
| `npm run check:all` | typecheck + tests + lint + check:swedish | Före push |
| `npm run test:e2e:smoke` | auth.spec + exploratory-baseline | Snabb regression |
| `npm run test:e2e:critical` | booking + payment + provider | Innan release |

### 10.4 Tester relevanta för login/auth/demo

- `e2e/auth.spec.ts` — primär login-spec (ej läst i denna session, men listad i smoke-set)
- `src/app/auth/callback/route.test.ts` — finns enligt S65-1-acceptanskriterier ("Bara unit-test, inget integration-test")
- `src/app/api/auth/register/route.test.ts` — register-route-tester
- `src/__tests__/rls/rls-proof.integration.test.ts` — 24 RLS-bevistester (men kräver Supabase CLI lokal)
- **Saknas:** dedikerat demo-mode-flow-test, prod-hostname-mot-Supabase-URL-konsistens-check, callback-route open-redirect-test

### 10.5 Lokal demo vs produktionsdemo — jämförelsetabell

| Aspekt | Lokal demo | Produktionsdemo |
|--------|-----------|-----------------|
| **Demo-aktivering** | `NEXT_PUBLIC_DEMO_MODE=true` i `.env.local` | Admin togglar `demo_mode` i `/admin/system` (databas-flag) eller env i Vercel |
| **DB** | Supabase CLI (port 54322) | Supabase hostad (`eu-central-2`) |
| **Auth-cookies** | `127.0.0.1:54321` Supabase | Hostad Supabase URL + prod-domän |
| **CSP `connect-src`** | Lokal Supabase URL | Prod Supabase URL (post `9410dd21`) |
| **Email-leverans** | Mock (DISABLE_EMAILS=true) eller Resend test | Resend live |
| **Rate-limit** | In-memory fallback (om Upstash saknas) | Upstash Redis |
| **Demo-seed** | `npm run db:seed:demo:reset` | Manuell körning mot prod-DB med Supabase pooler-URL |
| **Feature flags** | Default + `.env.local` overrides | Default + Edge Config + DB |
| **Custom Access Token Hook** | Installerad via `supabase/auth-triggers.sql` (manuellt steg) | Manuellt installerad i Supabase Dashboard |
| **`/auth/callback`** | Aldrig nådd (testas inte lokalt) | **Aktiv om Supabase Redirect URLs allowlist tillåter** — RISK |
| **Custom domains / cookies** | localhost, inga cross-domain-issues | Vercel preview vs prod-domän kan ge cookie-mismatch |
| **APP_URL** | `http://localhost:3000` | Förväntat `https://<prod-host>` — **historiskt felkonfigurerad** |
| **Tester (E2E)** | Körs alltid (workers: 1) mot localhost:3000 | Körs aldrig automatiserat |
| **Sentry** | Av (om DSN saknas) | På |
| **Cron-jobs** | Körs ej (Vercel-feature) | Körs (3 jobs) — `data_retention` kan radera demo-användare om aktiverad |
| **Kända risker** | `.env.local` skuggning, `provider@example.com` saknas | URL-mismatch, `\n`-suffix i env, callback-route BLOCKERS, fire-and-forget tyst leveransbortfall |

---

## Top 5 risks

1. **`/auth/callback` aktiverad i Supabase Redirect URLs trots 3 BLOCKERS** — open redirect, fel userType-landning, hardkodad redirect. Kan vara faktiska rotorsaken till nuvarande prod-login-incidenten.
2. **APP_URL / Supabase Site URL / Vercel prod-hostname asynkrona** — historik visar att detta tappades 2026-04-30, kan tappas igen vid varje domänändring eller env-rotation.
3. **Fire-and-forget i 4 routes (reschedule, invites, booking-series, customers/invite)** — kunder får inte kritiska bokningsmail i prod. Demo-blocker, möjligen launch-blocker.
4. **`STRIPE_WEBHOOK_SECRET` inte gate:ad i prebuild** — bygget passerar, men subscription-flödet kraschar i runtime om variabeln saknas. Samma kategori som APP_URL-buggen.
5. **`provider@example.com` är single point of failure för demo** — raderas den (manuellt eller via `data_retention`-cron) faller hela demo-seeden utan tydligt felmeddelande till operatören.

## Top 5 next actions

1. **Reproducera prod-login-felet med Johan** — be om exakt URL, kontotyp, felmeddelande, browser/konsoll-output. **(0 kod)**
2. **Verifiera Supabase URL Configuration** — Site URL + Redirect URLs. Avaktivera `/auth/callback` om den ligger där. **(0 kod)**
3. **Verifiera APP_URL och NEXT_PUBLIC_SUPABASE_URL i Vercel prod** — ren från `\n`, exakt deployment-hostname. **(0 kod)**
4. **Implementera S65-1** — hotfix av callback-routen (open redirect, redirectTo-validering, userType-routing, `Cache-Control: no-store`, integration-test). **(1–2h kod efter brief)**
5. **Lägg till smoke-E2E mot Vercel-preview** — efter varje deploy, GET `/login` + förvänta 200. **(30 min CI-konfig, post-incident)**

## Do not change yet

Följande **får inte ändras** innan diagnos är gjord eller utan explicit godkännande:

1. **`src/app/auth/callback/route.ts`** — väntar på S65-1 hotfix-story med tester. Ad hoc-fix riskerar nya regressions.
2. **`middleware.ts`** — den fungerar idag. JWT-validering + token-refresh + cookies sätts korrekt enligt repo. Rör inte under diagnos.
3. **`src/lib/auth-dual.ts`** — DB-lookup-mönstret är medvetet (lit aldrig på JWT-claims). Behåll.
4. **`prisma/seed-demo.ts`** — fungerar mot lokal demo. Ändringar utan koordination kan bryta `db:seed:demo:reset` lokalt.
5. **`vercel.json`** — region `fra1` är medvetet vald för Supabase `eu-central-2`. Ingen anledning att röra.
6. **`src/lib/feature-flags.ts`** — special-case för `NEXT_PUBLIC_DEMO_MODE` ser udda ut men är **medveten**. Att normalisera till `FEATURE_DEMO_MODE` skulle bryta klient-bundle-injektionen.
7. **`scripts/check-prod-env.ts`** — utöka först via S65-4. Lägg inte till variabler ad hoc.
8. **Supabase Redirect URLs (dashboard)** — om `/auth/callback` redan finns där: ta bort, men lägg INTE till nya URL:er innan S65-1.
9. **`docs/sprints/status.md` och sprint-65.md** — pågående koordinering. Avstå från redaktionella ändringar.
10. **CSP `connect-src` i `next.config.ts`** — hotfix `9410dd21` läser nu från env. Behåll.

---

**Slut på rapport. Skapad 2026-05-01 av tech lead-session som ren analys, utan kodändringar. Nästa steg: presentera för Johan, samordna verifiering i sektion 6, fatta beslut om Slice 0 vs Slice 1.**
