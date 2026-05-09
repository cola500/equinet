---
title: "Staging Environment Setup"
description: "Plan + utfall för isolerad staging-miljö (egen domain, egen Supabase, egen DB). Block 2 klart 2026-05-06."
category: operations
status: active
last_updated: 2026-05-06
tags: [staging, preview, vercel, supabase, environment, demo]
sections:
  - Resultat 2026-05-06 (Block 2 klart)
  - 1. Målbild
  - 2. Environment model
  - 3. Nuläge och gap
  - 4. Riskbedömning
  - 5. Rekommenderad staging-strategi
  - 6. Steg-för-steg setup
  - Recommended next slice — S66-3B
  - 7. Verifieringschecklista
  - 8. Do-not-do-lista
---

# Staging Environment Setup

> **Status:** Block 2 implementerat och verifierat 2026-05-06. Staging är fullständigt isolerad från prod på alla lager (domain, Auth, DB). Plan-sektionerna nedan beskriver vägen dit.

## Resultat 2026-05-06 (Block 2 klart)

| Lager | Production | Staging |
|-------|------------|---------|
| Domain | `https://equinet.johanlindengard.com` | `https://equinet-staging.johanlindengard.com` |
| TLS-cert | Let's Encrypt via Vercel | Let's Encrypt via Vercel |
| Vercel env `APP_URL` | Production-rad → prod-domän | Preview branch=`staging` → staging-domän |
| Supabase Auth | `xybyzflfxnqqyxnvjklv` (prod) | `zzdamokfeenencuggjjp` (staging, separat projekt) |
| `DATABASE_URL` | Prod-pooler | Staging-pooler (Preview branch=`staging`) |
| `DIRECT_DATABASE_URL` | Prod-direct (delar med Development) | Staging-direct (Preview branch=`staging`) |
| Schema migrations | (synkade) | 45/45 applied (verifierat) |
| Custom Access Token Hook | aktiv | aktiv ✓ |
| Supabase Site URL | `equinet.johanlindengard.com` | `equinet-staging.johanlindengard.com` |
| End-to-end login | (oförändrat) | ✅ verifierat |

### Block 2 detaljerad status

| Block | Status |
|-------|--------|
| 2A — Custom domains live (prod + staging) | ✅ |
| 2B — `staging`-branch + Vercel auto-deploy | ✅ |
| 2C.1 — APP_URL split per environment | ✅ |
| 2C.2 — DATABASE_URL split (Production / Preview-staging) | ✅ (via Vercel UI efter CLI-incident; se Lärdom nedan) |
| 2C.3 — DIRECT_DATABASE_URL split | ✅ (via Vercel UI) |
| 2D — Supabase Site URL + Redirect URLs (båda projekt) | ✅ |
| 2E — End-to-end login verifierat i browser | ✅ |
| 2C.4 — Cleanup Development DB-vars | ⏳ Frivilligt — `DATABASE_URL` Development är redan tom; `DIRECT_DATABASE_URL` Development delar med Production |
| 2F — Cutover prod till `equinet.johanlindengard.com` (byta APP_URL Production + Supabase prod Site URL bort från `equinet-app.vercel.app`, ta bort gamla domain `equinet-app-test.johanlindengard.com`) | ⏳ Separat slice |

### Kvarvarande arbete (utanför Block 2)

- **Demo-seed mot staging** — staging-DB har 24 users, 5 providers, 8 services men 0 bookings/horses. För demo-walkthrough behöver vi köra `db:seed:demo:reset` mot staging.
- **Email-flow-test** — trigga password reset från staging-domain och verifiera att mail innehåller staging-URL. Bevisar Site URL-config end-to-end.
- **Skapa `johan@jaernfoten.se` i staging-Supabase** om eget login-konto önskas.
- **Sprint 65 stories** (S65-1..S65-7) — auth-säkerhet och leveransgarantier från Sprint 64-review. Inte staging-relaterat men kvarstår.
- **Doc-cleanup** — uppdatera `CLAUDE.md`, `docs/demo-mode.md`, `docs/operations/url-configuration.md` med nya domain-namn när cutover är gjord.
- **Vercel Deployment Protection-beslut** för staging-domänen — krävs Vercel-login idag, vilket hindrar att dela URL externt för demo. Toggle off om extern delning behövs.

### Lärdom: `vercel env rm` på delade rader

CLI-kommandot `vercel env rm <var> <env> --yes` **tar bort hela variabeln** för alla environments den delar rad med, inte bara den specifika environment-tilldelningen. Vid 2C.2 togs `DATABASE_URL` av misstag bort från Production + Development när vi försökte separera Preview. Återställdes via Vercel UI.

**Regel framåt:** Splittring av delade rader görs via **Vercel UI**, inte CLI. UI:s "Edit"-flöde tillåter att avmarkera environment-tilldelning utan att radera värdet. CLI är fortfarande OK för `add` av nya rader eller `rm` av rader med en enda environment-tilldelning.

---

> Plan, inte kod. Inga env-ändringar gjorda. Inga secrets i denna fil — bara `NEXT_PUBLIC_*`-värden (publika i klient-bundlen) och project-IDn som ändå syns publikt.

---

## 1. Målbild

Tre **fullt isolerade** miljöer som beter sig konsekvent:

| Miljö | Supabase | DB | Demo-data | Konton |
|-------|----------|----|-----|--------|
| **Local** | Lokal Supabase CLI (port 54321) | Lokal Postgres (port 54322) | Seedat lokalt | `provider@example.com` + demo-seed |
| **Staging** (= Vercel Preview) | Egen staging-Supabase | Egen staging-DB | Seedat mot staging | `provider@example.com` + ev. `johan@jaernfoten.se` (staging) + demo-seed |
| **Production** | Prod-Supabase | Prod-DB | Riktig kunddata | Riktiga konton |

**Ingen miljö delar Auth-instans eller DB med någon annan miljö.** Demos i staging är säkra utan risk för prod-data. Demos lokalt är säkra utan internetkrav.

---

## 2. Environment model

| Aspekt | Local | Staging (Preview) | Production |
|--------|-------|-------------------|------------|
| **Supabase Auth** | `127.0.0.1:54321` | `zzdamokfeenencuggjjp.supabase.co` | `xybyzflfxnqqyxnvjklv.supabase.co` |
| **DATABASE_URL host** | `127.0.0.1:54322` | **bör vara** staging-pooler (idag delas med prod — gap) | prod-pooler |
| **DIRECT_DATABASE_URL host** | `127.0.0.1:54322` | **bör vara** staging-direct (idag delas med prod — gap) | prod-direct |
| **APP_URL** | `http://localhost:3000` | `https://equinet-staging.vercel.app` (eller stabil staging-URL — idag är det branchnamn-genererat) | `https://equinet-app.vercel.app` |
| **Demo mode** | `NEXT_PUBLIC_DEMO_MODE=true` i `.env.local` | Egen Vercel-rad för Preview | Off (eller toggle via admin) |
| **Seed strategy** | `npm run db:seed` + `db:seed:demo:reset` | Manuell körning mot staging-pooler-URL — engångsetablering + på begäran | **Aldrig kör demo-seed mot prod** |
| **Test users** | Seed-konton (`provider@example.com`, etc.) | Seed-konton + ev. medvetna staging-användare (`johan-staging@...`, ej prod-mail) | Riktiga konton |

---

## 3. Nuläge och gap

### Vad vi vet (verifierat via `vercel env ls`, `vercel env pull` och Supabase Dashboard)

- ✓ Preview har **egen** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (28 dagar gamla rader, separata från Production).
- ✓ Preview Supabase = `zzdamokfeenencuggjjp.supabase.co`. Production Supabase = `xybyzflfxnqqyxnvjklv.supabase.co`. Olika projekt.
- ✗ **BEKRÄFTAT 2026-05-02 (S66-3A audit):** `DATABASE_URL` är delad rad i `vercel env ls` mellan Development, Preview och Production. `vercel env pull` (Development) extraherade username `postgres.xybyzflfxnqqyxnvjklv` → **prod-Supabase project-ref**. Eftersom raden delas → Preview och Development pekar också på prod-DB.
- ✗ **BEKRÄFTAT 2026-05-02 (S66-3A audit):** `DIRECT_DATABASE_URL` har samma delning och samma project-ref → migrations kan landa i prod-DB från preview eller dev.
- ✗ **NYTT FYND 2026-05-02 (S66-3A audit):** `APP_URL` Development-värde har literal `\n`-suffix (samma kategori som S64-2-buggen, fast S64-2 städade bara Supabase-vars).
- ✗ **NYTT FYND 2026-05-02 (S66-3A audit):** `APP_URL` saknas helt i Preview-environment (bara Production och Development har raden).

### Gap (måste verifieras eller åtgärdas)

| # | Gap | Status | Konsekvens om inte åtgärdat |
|---|-----|--------|------------------------------|
| G1 | **`DATABASE_URL` delas mellan Preview och Production** | **BEKRÄFTAT 2026-05-02** — username `postgres.xybyzflfxnqqyxnvjklv` (prod-ref) i Development-pull, delad rad i `vercel env ls` | Server-side Prisma-queries i preview hamnar i prod-DB. Client-side auth går mot staging-Supabase. **Inkonsekvent identitet — KRITISK.** |
| G2 | **`DIRECT_DATABASE_URL` delas** | **BEKRÄFTAT 2026-05-02** — samma metod | Migrations från preview-deployer kan landa i prod-DB. Allvarlig risk vid `prisma migrate`. |
| G3 | **Schema/migrations i staging-Supabase okänt** | Hypotes | Om staging-DB inte har alla migrations: routes faller på saknade tabeller/kolumner. |
| G4 | **`User`-tabell i staging-DB okänt** | Hypotes | Auth kan lyckas men `auth-dual.ts` returnerar null → 401 i routes. |
| G5 | **Inga seed-konton i staging** | Hypotes | `provider@example.com` saknas → demo-seed `process.exit(1)`. |
| G6 | **Ingen demo-seed körd mot staging** | Hypotes | Tomma listor → tom demo. |
| G7 | **`johan@jaernfoten.se` saknas i staging** | Bekräftat indirekt — login failar i preview med "Ogiltig email eller lösenord" | Det är detta vi observerade. |
| G8 | **`APP_URL` för Preview okänt** | **Konkretiserat — se G12** | Email-länkar från staging skickas med fel base-URL. Sprint 64-incidenten igen. |
| G9 | **Vercel Deployment Protection (SSO) på preview** | Bekräftat (sett 401 + `_vercel_sso_nonce` i smoke-check) | Krävs Vercel-login innan app-login. Hindrar dela-länk-i-podd-test. |
| G10 | **Ingen stabil staging-URL** | Bekräftat — branch-genererad URL | `equinet-en0jro9dh-cola500s-projects.vercel.app` är branch-genererad, ändras vid varje deploy. Staging-Supabase Site URL kan inte hänga med. |
| G11 | **`APP_URL` har literal `\n`-suffix i Development** | **BEKRÄFTAT 2026-05-02 (S66-3A audit)** | Email-templates som genereras i development bygger länkar med `\n` i URL:en → trasiga länkar i utvecklingstest. Samma kategori som S64-2-incidenten. |
| G12 | **`APP_URL` saknas helt i Preview-environment** | **BEKRÄFTAT 2026-05-02 (S66-3A audit)** — bara Production och Development har raden | Email-templates faller tillbaka på `'http://localhost:3000'` när preview skickar mail. Trasigt — emails från staging pekar på localhost. |

---

## 4. Riskbedömning

| Scenario | Sannolikhet idag | Påverkan | Allvar |
|----------|------------------|----------|--------|
| **A. Staging-auth + prod-DB** (G1) | Hög — sannolikt så just nu | En användare som registrerar sig via preview hamnar i prod-`User`-tabellen med UUID från staging-`auth.users`. Foreign-key-relationer mot riktiga prod-bokningar kan brytas. | **KRITISK** |
| **B. Prod-auth + staging-DB** | Låg — kräver omvänd misskonfiguration | Symmetrisk — användare loggar in mot prod men allt som skrivs hamnar i staging. | Hög |
| **C. `auth.users`-rad finns men `User`-rad saknas** | Hög — händer normalt vid första registrering om triggers inte synkat | Login lyckas men varje API-anrop returnerar null från `auth-dual.ts` → 500 i routes | Medel |
| **D. Demo-seed körd mot prod-DB av misstag** | Medel — om `DATABASE_URL` lokalt inte är inställt korrekt | 4 demo-kunder + 7 bokningar + 3 reviews skapas i prod. Förorenar riktig data. Måste rensas manuellt. | Hög |
| **E. Migrations körda mot fel DB** | Medel — `DIRECT_DATABASE_URL` delas (G2) | Schema-ändringar landar i prod-DB istället för staging-DB. Kan blockera framtida prod-deploy. | Hög |
| **F. Staging-data exponeras i klient-bundle** | Försumbar — `NEXT_PUBLIC_*` är medvetet publika | Endast project-IDn syns. Inga credentials. | Låg |

---

## 5. Rekommenderad staging-strategi

**Princip:** Staging är en självständig kopia av prod-arkitekturen, men med egen data och egen identitet. Staging ska kunna förstöras och byggas om utan att röra prod.

### Vercel Environment Variables (Preview)

| Variabel | Strategi |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | **Egen** för Preview → `zzdamokfeenencuggjjp.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Egen** för Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | **Egen** för Preview |
| `DATABASE_URL` | **Egen** för Preview (pooler-URL till staging-Supabase Postgres) |
| `DIRECT_DATABASE_URL` | **Egen** för Preview (direct-URL till staging-Supabase Postgres) |
| `APP_URL` | **Egen** för Preview — sätt till stabil staging-URL (se nedan) |
| `RESEND_API_KEY` | **Eget** test-konto i Resend om möjligt, annars delat. **`FROM_EMAIL`** ska peka på en domän där staging-mail inte når riktiga kunder. |
| `STRIPE_*` | Test-keys för Preview (sk_test_*, pk_test_*). Aldrig prod-keys i preview. |
| `UPSTASH_REDIS_*` | Egen Redis-instans för preview (eller delad — låg risk om bara rate-limit). |
| `SENTRY_*` | Egen Sentry-projekt för preview om Sentry används aktivt. |
| `NEXT_PUBLIC_DEMO_MODE` | `true` för Preview (staging är demo per default). |
| `ALLOW_TEST_ENDPOINTS` | **Aldrig** `true` i Preview eller Production (bara CI/local). |

### Stabil staging-URL

Branch-genererade preview-URL:er (`equinet-en0jro9dh-...`) ändras vid varje push. Det gör Supabase Site URL och email-länkar instabila. Två lösningar:

- **A:** Skapa en stabil alias-domän i Vercel: `equinet-staging.vercel.app` eller `staging.equinet-app.vercel.app`. Pekar alltid på senaste preview-deploy från en specifik branch (t.ex. `staging`). Site URL i staging-Supabase pekar på den stabila domänen.
- **B:** Behåll branch-genererade URL:er men acceptera att email-flöden inte testas i staging (manuell verifiering räcker).

**A rekommenderas.**

### Staging-konton

- Skapa `provider@example.com` (samma som lokalt) i staging-Supabase.
- Skapa `johan-staging@<egen-domän>` om Johan vill testa själv. **Inte** `johan@jaernfoten.se` — det är prod-identitet och kan förvirra.
- Skapa minst en `customer@example.com` för boknings-flöden.
- Lösenord: enbart för demo, dokumentera i 1Password/lösenordshanterare.

### Seed-strategi

- Engångsetablering vid uppsättning: kör `npm run db:seed` + `npm run db:seed:demo:reset` mot staging-pooler-URL (lokalt på dev-maskin med staging-DATABASE_URL exporterad i shell, INTE i .env-filer).
- Vid schema-ändringar: kör `prisma migrate deploy` mot staging-direct-URL **innan** prod.
- Vid behov av "ren staging": `prisma migrate reset` + re-seed.

---

## 6. Steg-för-steg setup

> **Inga kommandon mot prod. Inga ändringar utan din bekräftelse per steg.**

### Steg A: Audit av nuvarande Vercel-env (manuellt i Vercel UI)

1. Vercel UI → Project equinet-app → Settings → Environment Variables.
2. Filtrera på "Preview". Lista alla variabler. Identifiera vilka som idag är **delade** (`Production, Preview, Development` på samma rad) vs **separata**.
3. Förväntat fynd: `DATABASE_URL` och `DIRECT_DATABASE_URL` är delade. `NEXT_PUBLIC_SUPABASE_*` är separata.

### Steg B: Skapa staging-DB-credentials

1. Supabase Dashboard → Project `zzdamokfeenencuggjjp` (= staging-projektet).
2. Settings → Database → Connection string.
3. Kopiera **pooler-URL** (med `?pgbouncer=true&connection_limit=1`) — detta blir `DATABASE_URL` för Preview.
4. Kopiera **direct-URL** — detta blir `DIRECT_DATABASE_URL` för Preview.
5. Spara i lösenordshanterare. Skriv aldrig ut i klar text någon annanstans.

### Steg C: Lägg till Preview-specifika DB-vars i Vercel

1. Vercel UI → Environment Variables → `DATABASE_URL`.
2. Klicka "Edit" på den delade raden. Ändra Environment-tilldelning från "Production, Preview, Development" till **bara "Production"** (och Development om du vill behålla).
3. Klicka "Add New" för `DATABASE_URL` → välj environment **"Preview"** → klistra in staging-pooler-URL → spara.
4. Upprepa för `DIRECT_DATABASE_URL`.

### Steg D: Verifiera schema i staging-DB

1. På din lokala maskin, **i ett separat terminalfönster** (inte i din vanliga dev-terminal):
   ```
   export DATABASE_URL="<staging-pooler-url>"
   export DIRECT_DATABASE_URL="<staging-direct-url>"
   npx prisma migrate status
   ```
2. Om migrations saknas: `npx prisma migrate deploy`.
3. Verifiera att alla 41-ish migrations gått igenom utan fel.
4. **Stäng terminalen** efter du är klar — så att staging-credentials inte ligger kvar i miljön.

### Steg E: Seed staging-konton

1. Samma terminal (eller ny med exporterade staging-vars):
   ```
   npm run db:seed                  # skapar test-användare
   npm run db:seed:demo:reset       # demo-data
   ```
2. Logga in på Supabase Dashboard för staging → Authentication → Users → verifiera att `provider@example.com` finns och `email_confirmed_at` är satt.

### Steg F: Sätt APP_URL för Preview

1. (Valfritt men rekommenderat) Skapa stabil alias `equinet-staging.vercel.app` i Vercel UI → Settings → Domains.
2. Lägg till `APP_URL` i Vercel → environment **Preview** → värde = stabil staging-URL.
3. Supabase Dashboard `zzdamokfeenencuggjjp` → Authentication → URL Configuration → Site URL = stabil staging-URL.

### Steg G: Redeploy preview

1. Trigga ny deploy: `git commit --allow-empty -m "chore: redeploy after staging env split" && git push` (efter att branch-arbetet på S66 är mergat).
2. Vänta tills Vercel rapporterar Ready.

### Steg H: Validera (se sektion 7)

---

## Recommended next slice — S66-3B: Split database env vars per environment

**Mål:** Stänga den kritiska inkonsistensen där Preview-Auth pekar på staging-Supabase men Preview-DB pekar på prod. Detta är den enda slicen vi rekommenderar köra direkt; allt annat (schema-migrering, seed, stabil URL) hänger på att DB-targets är rätt först.

**Scope:** Bara environment-variabler i Vercel UI och en post-change audit. Ingen kod, inga migrations, ingen seed.

**Definition of Done:**

- [ ] `DATABASE_URL` Production-rad pekar på prod-Supabase (`postgres.xybyzflfxnqqyxnvjklv` username, prod-pooler-host).
- [ ] `DIRECT_DATABASE_URL` Production-rad pekar på prod-Supabase (samma project-ref).
- [ ] `DATABASE_URL` Preview-rad pekar på staging-Supabase (`postgres.zzdamokfeenencuggjjp` username, staging-pooler-host) — separat rad från Production.
- [ ] `DIRECT_DATABASE_URL` Preview-rad pekar på staging-Supabase — separat rad från Production.
- [ ] `DATABASE_URL` Development-rad pekar **inte** på prod (alternativ: lokal Supabase CLI `127.0.0.1:54322`, eller staging-pooler, eller helt borttagen så att lokal `.env`-fil tar över).
- [ ] `DIRECT_DATABASE_URL` Development-rad har samma princip som ovan.
- [ ] `APP_URL` finns i Preview-environment och pekar på preview/staging-URL (helst stabil alias som `equinet-staging.vercel.app` per G10).
- [ ] `APP_URL` i Development är städat — ingen literal `\n`-suffix kvar.
- [ ] **Ingen** staging-migration eller staging-seed körs **innan** DB-target är verifierat (audit nedan måste vara grön först).
- [ ] **Post-change audit körs och visar:**
  - Preview `DATABASE_URL` username innehåller `postgres.zzdamokfeenencuggjjp` (eller annat staging-ref) — **inte** `xybyzflfxnqqyxnvjklv`.
  - Production `DATABASE_URL` username innehåller `postgres.xybyzflfxnqqyxnvjklv` (oförändrat).
  - `vercel env ls` visar `DATABASE_URL` och `DIRECT_DATABASE_URL` som **separata rader** per environment, inte som en delad rad.

**Out of scope för S66-3B (egna slices senare):**

- S66-3C: Verifiera schema och kör migrations mot staging-DB (Steg D i sektion 6).
- S66-3D: Seeda staging med demo-data (Steg E).
- S66-3E: Stabil staging-URL och Supabase Site URL-uppdatering (Steg F + G10).
- S66-3F: Verifiera att Stripe/Resend/Upstash inte delar prod-keys till Preview (riskerna #7, #8 i audit-rapporten).
- S66-3G: Beslut om Vercel Deployment Protection ska behållas eller togglas av för podd-test (G9).

**Risker att vara extra försiktig med under S66-3B:**

- Ändringar görs i Vercel UI **per rad**. Om man råkar ändra Production-värdet istället för att lägga till en Preview-rad → prod tappar DB-anslutning → produktion ner. Verifiera environment-tag innan varje save.
- `DIRECT_DATABASE_URL` används av `prisma migrate`. Om Preview får denna pekande på staging-Supabase och någon kör migrate via Vercel-deploy är det rätt — men om någon utvecklare har den exporterad lokalt och kör `prisma migrate deploy` lokalt landar schema-ändringen i staging. Det är OK för staging, men ska vara avsiktligt.
- `DATABASE_URL` Development bör inte tas bort innan vi verifierat att alla utvecklare har egen `.env.local` som overridar. Annars kan `vercel env pull` ge tom variabel → Prisma-fel lokalt.

**Förväntad effekt:**

Efter slice:
- Preview-deploys talar med staging-Supabase både för Auth och DB. Konsistent identitet.
- Risk #1 (KRITISK) i S66-3A audit-rapporten: stängd.
- Risk #2 (KRITISK): stängd.
- Risk #3 (Hög): stängd om Development-värdena också flyttas.
- Risk #4 + #5 (G11, G12): stängda.
- Login med `johan@jaernfoten.se` i preview kommer **fortfarande** failas (kontot finns inte i staging-Supabase) — det löses i S66-3D (staging-seed) eller manuellt via Supabase Dashboard.

---

## 7. Verifieringschecklista

Kör dessa **efter** att stegen ovan är gjorda. Inga steg är kod-ändringar — bara läs och verifiera.

### Vercel-config

- [ ] Preview-rad för `NEXT_PUBLIC_SUPABASE_URL` → `zzdamokfeenencuggjjp` (oförändrat)
- [ ] Preview-rad för `DATABASE_URL` → host innehåller `zzdamokfeenencuggjjp` eller staging-pooler-host
- [ ] Preview-rad för `DIRECT_DATABASE_URL` → host innehåller staging-direct-host
- [ ] Production-rader för samma vars är **separata** och pekar på `xybyzflfxnqqyxnvjklv`
- [ ] `APP_URL` Preview = stabil staging-URL
- [ ] `ALLOW_TEST_ENDPOINTS` finns INTE i Preview eller Production

### Staging-Supabase

- [ ] Authentication → Users innehåller `provider@example.com` med `email_confirmed_at` satt
- [ ] SQL: `SELECT COUNT(*) FROM "User" WHERE email = 'provider@example.com'` → 1
- [ ] SQL: `SELECT COUNT(*) FROM "Booking"` → ≥ 7 (demo-bokningar)
- [ ] SQL: `SELECT COUNT(*) FROM "Service"` → ≥ 4 (demo-tjänster)
- [ ] Custom Access Token Hook installerad och aktiv (om används i prod)
- [ ] RLS aktiv på samma tabeller som prod (`pg_tables.rowsecurity = true`)

### Funktionell

- [ ] `APP_URL=<staging-url> npm run demo:check:prod` → `1 ok, 0-2 warn, 0 fail` (warns acceptabla för BotID/SSO; fails inte)
- [ ] Login med `provider@example.com` / `ProviderPass123!` på staging → lyckas, redirectar till dashboard
- [ ] Dashboard visar 4 tjänster, 3 kommande bokningar, 1 pending
- [ ] Inget "DEMO-SEED"/"Test Testsson" läcker till UI

### Säkerhet (måste vara TRUE för alla)

- [ ] Staging-deployment kan inte SELECT från prod-DB
- [ ] Prod-deployment kan inte SELECT från staging-DB
- [ ] Staging Resend-utskick går till test-domän (eller är avstängda)
- [ ] Staging Stripe använder test-keys (sk_test_*)

---

## 8. Do-not-do-lista

| ✗ Gör inte | Varför |
|-----------|--------|
| Peka Preview mot prod-Supabase eller prod-DB | Rådda data, brutna FK-relationer, GDPR-risk |
| Skapa `johan@jaernfoten.se` i staging-Supabase med samma identitet som prod | Förvirrar identitet, prod-mail kan triggas vid email-flöden |
| Köra `prisma migrate deploy` mot prod när din shell-env har staging-vars exporterade | Allvarlig — schema kan landa i fel DB. Stäng staging-terminalen direkt efter användning |
| Sätta `ALLOW_TEST_ENDPOINTS=true` i Vercel Preview | Exponerar `/api/test/*` på publika preview-URL:er |
| Använda `NEXT_PUBLIC_DEMO_MODE` för att gömma data | Demo-mode är UI-only. Använd separat staging-DB för datadrift, inte UI-flagga |
| Köra `db:seed:demo:reset` lokalt utan att verifiera `DATABASE_URL` med `npm run env:status` först | Kan radera prod demo-data om DATABASE_URL råkar peka på prod |
| Spara staging-DB-credentials i committade `.env`-filer | `.env.example` är committad. `.env.local`/`.env.staging` ska vara i `.gitignore` |
| Anta att Supabase Site URL hänger med när preview-URL ändras | Branch-genererade URL:er kräver stabil alias eller manuell uppdatering vid varje deploy |

---

**Status:** Plan klar. Inga env-ändringar utförda. Inga commits. Nästa steg är manuella i Vercel UI och Supabase Dashboard — koordineras separat med beslut per delsteg i sektion 6.
