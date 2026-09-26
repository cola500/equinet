---
title: "Staging Environment Setup"
description: "Plan + utfall för isolerad staging-miljö (egen domain, egen Supabase, egen DB). Block 2 klart 2026-05-06."
category: operations
status: active
last_updated: 2026-09-26
tags: [staging, preview, vercel, supabase, environment, demo]
sections:
  - Historisk korrigering (2026-09-26)
  - Migrering till main-baserad staging — genomförd (2026-09-26)
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

> **Var verifierar man vad?** Se [deployment-verification-guide.md](./deployment-verification-guide.md)
> för beslutsguiden (demo-UX → staging; varför `equinet-staging-app` feature-branch-previews
> blir "Canceled by Ignored Build Step" — förväntat).

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

## Historisk korrigering (2026-09-26)

Miljöseparationen mellan staging och produktion (egna Vercel-projekt, egna Supabase-databaser/nycklar, Stripe test/live, egna domäner, `NEXT_PUBLIC_DEMO_MODE` true/false) infördes för att **isolera demo, kunddata, betalningar och hemligheter** från varandra. Den anledningen är fortfarande korrekt och ska bevaras.

Det som **inte** var nödvändigt för att uppnå den isoleringen var att koden skulle leva på en egen långlivad `staging`-Git-branch. Miljöisolering kräver separata Vercel-projekt/env-config — inte en separat kodgren. Den långlivade branchen ledde i praktiken till manuell tvåvägs-synk (`sync/*-to-staging`-PR:ar) och återkommande koddrift (t.ex. en sessionStorage-utloggningsfix som fanns på `main` men saknades på `staging` i flera veckor).

Målbilden framåt: `main` är enda långlivade kodgrenen. Samma Git-SHA byggs separat för staging (med stagingkonfiguration, demo aktiverat) och för produktion (med produktionskonfiguration, demo avstängt), och produktionsdeploy kräver att exakt samma SHA redan är verifierad i staging. Se migrationsplanen från 2026-09-26 (chattsession) för stegvis genomförande och rollback.

---

## Migrering till main-baserad staging — genomförd (2026-09-26)

> **Status:** `equinet-staging-app`s Production Branch är sedan 2026-09-26 `main`, inte längre `staging`. Detta ersätter alla tidigare påståenden i denna och andra docs om att staging bygger från en egen branch. Den gamla `staging`-branchen finns kvar orörd under en observationsperiod (se nedan) men är **inte längre den aktiva deploykällan**.

### Ny arkitektur

- **`main` är enda aktiva kodkälla** för både staging och produktion. Ingen mer manuell `sync/*-to-staging`-synk.
- **`equinet-staging-app`** bygger från `main` med stagingkonfiguration (egen Supabase, Stripe testläge, `NEXT_PUBLIC_DEMO_MODE=true`, övriga stagingvärden).
- **`equinet-app`** bygger samma verifierade Git-SHA med produktionskonfiguration (`NEXT_PUBLIC_DEMO_MODE=false`).
- Staging och produktion har fortfarande **separata Vercel-builds** — samma skäl som alltid: `NEXT_PUBLIC_*`, Supabase- och Stripe-nycklar bakas in vid build-tid och kan inte delas mellan miljöer i en och samma artefakt.
- **Demo är en stagingegenskap, inte stagingunik kod:** samma källkod kör i båda miljöerna. Vad som skiljer är `NEXT_PUBLIC_DEMO_MODE`, en separat stagingdatabas och separat testkonfiguration (Stripe testläge) — allt via miljökonfiguration, aldrig via branch-specifik kod.
- Demo-**ingången** (knapparna på login/landningssidan) styrs separat av `isStagingSafe()`/`IS_LIVE_PRODUCTION` — se `docs/ideas/epic-prodlik-staging-demo-per-session.md` för den bakgrunden. `NEXT_PUBLIC_DEMO_MODE` styr numera huvudsakligen nav-filtrering och Hjälpcenter-innehåll för demo-sessioner.

### Deployflöde

1. Merge till `main`.
2. Separat stagingbuild triggas (idag: manuellt/API-styrt under observationsperioden — se "Ignore Build Step" nedan; framtida mål: automatiskt vid varje `main`-merge).
3. Exakt SHA verifieras och registreras (idag: manuellt i denna dokumentation efter varje lyckad staging-deploy; framtida mål: en maskinläsbar "staging-verified"-markering, t.ex. en Git-tagg eller deployment-status).
4. Produktionsdeploy av **samma** SHA kräver uttryckligt godkännande — sker via det befintliga gated flödet (`scripts/deploy-production.sh`, se `docs/operations/deployment.md`), inte via Vercels native git-integration (`vercel.json`: `git.deploymentEnabled.main = false` stänger av automatisk deploy för `main` på **båda** projekten, eftersom båda läser samma `vercel.json` från samma repo).
5. Separat produktionsbuild med produktionsvärden.
6. **Oberoende rollback** per miljö: staging kan rullas tillbaka utan att röra produktionen och vice versa — de är fortfarande helt separata Vercel-deployments/alias.

### Previewflöde för kandidat-testning (`preview/candidate`)

Innan en `main`-SHA blir stagingens produktionsdeploy kan den testas isolerat:

- Branch: `preview/candidate` (dedikerad, återanvänds — force-pushas till önskad SHA).
- Vercel target: **Preview** (inte Production) — får en egen `*.vercel.app`-URL, rör aldrig stagingaliaset eller custom-domänen.
- Miljövärden: samma stagingvärden som produktions-scopet (Supabase, Stripe testläge, m.fl.), plus en dedikerad `NEXT_PUBLIC_DEMO_MODE=true`-rad scopad enbart till `preview`-target.
- Skydd: Vercel Authentication (SSO) på alla `*.vercel.app`-URL:er (undantar bara custom-domänerna), `gitForkProtection: true`.

**Nuvarande Vercel-plans kompromiss (dokumenterad avsiktligt avvikelse):** kontot är på Hobby-plan, som inte stödjer Custom Environments (`accountLimit.total: 0`) och inte tillåter att en variabel har både `gitBranch`-scopning och `target: ["production","preview"]` samtidigt (Vercel API: `"Environment Variables with gitBranch can only be used with target=preview"`). Konsekvensen: de återanvända stagingvärdena (`target: ["production","preview"]`) är **inte branch-scopade på env-nivå** — de är tekniskt tillgängliga för vilken preview-build som helst av detta projekt. Isoleringen upprätthålls istället av **Ignore Build Step**, som avgör vilka branches som överhuvudtaget får bygga något. **Om Vercel-planen senare uppgraderas till att stödja Custom Environments eller branch-scopad `target`-kombination ska vi återgå till strikt branch-scoping på env-nivå** — detta är en tillfällig, dokumenterad kompromiss, inte en målarkitektur.

### Ignore Build Step (tillfälligt tillstånd under observationsvecka)

Aktuell sträng på `equinet-staging-app` (ingen hemlig information — bara branchnamn):

```
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ] || [ "$VERCEL_GIT_COMMIT_REF" = "staging" ] || [ "$VERCEL_GIT_COMMIT_REF" = "preview/candidate" ]; then exit 1; fi; exit 0
```

- `main` — den nya, ordinarie deploykällan.
- `staging` — tillåten **tillfälligt under observationsveckan** efter migreringen, ifall den gamla branchen av någon anledning behöver byggas igen under övergången.
- `preview/candidate` — den dedikerade kandidat-preview-branchen.

**Efter observationsveckan:** ta bort `staging` ur denna sträng (så bara `main` och `preview/candidate` återstår). Arkivering/borttagning av själva `staging`-branchen sker **först efter separat, uttryckligt godkännande** — inte automatiskt när observationsveckan tar slut.

### Drift och rollback (nuläge efter genomförd migrering)

| Vad | Värde |
|---|---|
| Staging — Git-SHA | `4284202221f07216269659873cacf1f9b9f64f04` (branch `main`) |
| Staging — Vercel deployment-ID | `dpl_A1S3vbfA2M6fDjvZFEKRup1AgUH8` |
| Produktion — Git-SHA | `4284202221f07216269659873cacf1f9b9f64f04` (branch `main`, oförändrad genom hela migreringen) |
| Produktion — Vercel deployment-ID | `dpl_FTGX2HKHWLK5J3U6XdWiU1etfhqa` |
| Återställningstagg (gamla stagingläget) | `staging-pre-sync-2026-09-26` → commit `7b7c38e3f35d501fec509b821444689c4d7141fa` |

**Manuell återställning av Production Branch:** det finns **ingen publik Vercel REST-API-väg** för detta fält (verifierat — både `link.productionBranch` i `update_project`-anrop och i den officiella API-referensen saknas det). Måste göras i Vercel-dashboarden: `equinet-staging-app → Settings → Git → Production Branch → main → staging → Save`.

**Återställning av env-scope och Ignore Build Step:** görs via Vercel API (`edit_project_env` för att ta bort `preview` ur `target`-arrayen på de återanvända raderna, `update_project` för att återställa `commandForIgnoringBuildStep` till dess exakta tidigare värde). Exakta tidigare värden för varje variabel-ID finns i en maskerad rollback-inventering.

> **Rollback-inventeringen ligger utanför detta repo** (i en lokal, session-scopad katalog, inte incheckad) och **ska aldrig committas** — den innehåller Vercel-interna variabel-ID:n och projekt-/team-ID:n som inte behöver vara publika, även om den inte innehåller några hemliga värden. Be den som körde migreringen om den filen vid behov av rollback.

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

> **För leverantördemon (Erik Järnfot):** använd det säkra helper-scriptet istället för manuell
> `export DATABASE_URL=…` — det validerar staging-project-ref (`zzdamokfeenencuggjjp`), vägrar
> prod, och skriver aldrig connection-stringen till disk. Se
> [staging-demo-seed.md](./staging-demo-seed.md) (`npm run db:seed:staging-demo:safe`).

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
