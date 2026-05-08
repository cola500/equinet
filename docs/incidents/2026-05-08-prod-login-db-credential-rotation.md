---
title: "Post-mortem: Prod-login bröts efter DB-password-rotation (2026-05-08)"
description: "Efter att prod DB-password roterats följde flera env-uppdateringar och redeploys utan att login fungerade igen. Symptom: login blinkade, fält tömdes, användaren landade tillbaka oinloggad. Lösningen var en full Git-triggered deploy via tom commit. Hypotes: Vercel Lambda-instanser återanvände cachad process.env trots REST API redeploy med forceNew=1."
category: incident
status: active
last_updated: 2026-05-08
tags: [incident, post-mortem, vercel, prod, credentials, supabase, lambda, runtime-cache]
related:
  - ../operations/environments.md
  - ../operations/staging-environment-setup.md
sections:
  - 1. Summary
  - Key lessons
  - 2. Impact
  - 3. Timeline
  - 4. Root cause
  - 5. Contributing factors
  - 6. What went well
  - 7. What went poorly
  - 8. Detection
  - 9. Resolution
  - 10. Action items
  - 11. New runbook rule
  - 12. Open questions
---

# Post-mortem: Prod-login bröts efter DB-password-rotation

**Datum:** 2026-05-08
**Författare:** Tech lead (Claude) + Johan
**Status:** Stängd (login återställd)
**Allvarlighetsgrad:** P1 — produktion oanvändbar för login under incident-fönstret

---

## 1. Summary

Prod-login slutade fungera under några timmar efter att vi roterade prod DB-password. Symptomet var att login-formuläret blinkade till efter klick på "Logga in" — fälten tömdes och användaren hamnade tillbaka oinloggad utan synligt felmeddelande.

Diagnostiken visade att **Supabase Auth fungerade fullständigt** (POST `/auth/v1/token` → 200, Custom Access Token Hook OK, `last_sign_in_at` uppdaterades i `auth.users`), men app-lagret server-side returnerade `null` från `getSession()`. Trots flera REST API-redeploys via `forceNew=1` plockade Vercel runtime fortfarande inte upp den nya `DATABASE_URL`.

**Lösningen** var en **tom commit till `main`** följt av push, vilket triggade full Git-baserad Vercel-deployment med fresh Lambda-instanser och korrekt cachad `process.env`. Login fungerade omedelbart efter att den nya deployen blev READY.

**Hypotes om rotorsak:** Vercel Fluid Compute (default 2026) återanvänder Lambda-instanser mellan requests. Existerande Lambda-instanser hade gammalt `DATABASE_URL` cachat i `process.env` från sin instansiering. REST API redeploy med `forceNew=1` skapar ny build-artifact men **återanvänder Lambda function-pool** — bara ett fresh git-commit triggar full pool-recycling.

---

## Key lessons

Snabb-lista som underlag för runbooks och framtida incident-respons:

- **REST API redeploy (`forceNew=1`) verkar inte garantera full runtime/Lambda-recycling.** Build-artifact uppdateras men existerande Lambda-instanser fortsätter serva med gammal `process.env`.
- **Production credential-rotation kräver verifierad lokal DB-connect innan Vercel env-update.** Annars riskerar vi att POSTa felaktiga credentials och inte upptäcka det förrän efter redeploy.
- **Sensitive env-vars ska verifieras via struktur/hash/decode — aldrig rå output.** Användning av JWT-decode för project-ref + längd-check + URL-parsing räcker. Hela värdet ska aldrig printas till terminal.
- **Staging/prod-separation minskar blast radius vid infra-incidenter.** Idag var staging-env helt orört trots prod-incident — separation håller.
- **Runtime-env-cache måste betraktas som en möjlig felkälla efter credential-rotation.** Symtom kan vara att build/auth/DB-connect-tester alla ser OK men appen själv beter sig som om gamla värden gäller.
- **Git-triggerad full deployment är obligatorisk efter prod runtime-credential-rotation.** Tom commit + push på `main` är minsta möjliga trigger; det är inte den tomma commiten i sig som löser problemet, utan den fulla deployment-cykel den startar.

---

## 2. Impact

| Aspekt | Värde |
|---|---|
| **Miljö** | Production (`equinet.johanlindengard.com`) |
| **Funktion påverkad** | Login + alla autentiserade flöden (dashboard, bokningar, profil) |
| **Tid med trasig login** | ~1.5 timme (12:00–13:30 UTC ungefär) |
| **Användare påverkade** | Johan + alla provider/customer-konton som försökte logga in |
| **Dataförlust** | **Ingen** — DB-data oförändrad, inga skrivningar förlorades |
| **Staging/prod-data-mix** | **Ingen** — staging-data och prod-data hölls separerade hela tiden |
| **Externa beroenden** | Stripe-, Resend-, Sentry-funktionalitet inte påverkade (auth-bara incident) |

---

## 3. Timeline

Tider i UTC, ungefärliga.

| Tid | Händelse |
|---|---|
| ~10:30 | Under iOS S67-2-arbete körde tech lead `vercel env pull --environment=production` utan `--project`-flag → terminalen visade prod `DATABASE_URL` i klartext (med password). Exponerat i transkript. |
| ~10:35 | Incident mode startades. Johan informerades om läckaget. |
| ~10:45 | Prod DB-password roterades i Supabase Dashboard ([projektref](https://supabase.com/dashboard/project/xybyzflfxnqqyxnvjklv/settings/database)). |
| ~11:00 | Vercel Production `DATABASE_URL` + `DIRECT_DATABASE_URL` uppdaterades via REST API DELETE+POST. Splittade tidigare delad rad mellan production + development. |
| ~11:10 | Första redeploy via REST API `forceNew=1`. Status READY. |
| ~11:13 | Login-test → blink. Auth-loggar visade dock POST `/token` → 200. |
| ~11:20 | Lokal `pg`-connect mot pooler-URL failade med `28P01 password authentication failed`. Hypotes: Johan paste:ade fel password vid första försöket. |
| ~11:25 | Andra password-rotation i Supabase Dashboard (med eget anpassat password). |
| ~11:30 | Lokal `pg`-connect mot session-pooler (5432) → OK. Transaction-pooler (6543) → fortfarande FAIL — pooler-cache-delay misstänkt. |
| ~11:35 | Efter 90s-väntan: båda pooler-portar OK lokalt. Verifierat password matchar Supabase. |
| ~11:40 | Vercel env uppdaterades igen via REST API DELETE+POST med verifierat password. |
| ~11:45 | Andra redeploy via REST API `forceNew=1`. Status READY. |
| ~11:50 | Login-test → fortfarande blink. |
| ~12:00 | Diagnostik via Supabase MCP: auth-logs visar 200 (incl. Custom Hook OK). Postgres-logs visar inga 28P01. Cookie-inspektion i incognito visar att `sb-*-auth-token` cookies sätts korrekt med giltig JWT. SQL-verifiering: båda Erik och Johan finns i `public.User`. |
| ~12:15 | Hypotes: Prisma-binär eller env cachad i Vercel runtime. Annan hypotes: cookie-domain-mismatch (avvisad — cookies var korrekta). |
| ~12:25 | Tom commit `d9424cea` på `main` med meddelande "chore: rebuild prod with fresh prisma binary". Push till origin. |
| ~12:28 | Vercel auto-deploy triggad. |
| ~12:31 | Ny deployment `dpl_2opG7P6Y4qxFEd` blev READY (oväntat snabb — ~3 min). |
| ~12:33 | Browser-test: login fungerar. Dashboard laddar. **Incident stängd.** |

---

## 4. Root cause

**Hypotes / observed behavior:**

Vercel Fluid Compute (default-runtime 2026) återanvänder Lambda function-instanser mellan requests för att minska cold-starts. När en Lambda-instans startar laddas `process.env` **en gång** vid init-tid och cachas tills instansen avslutas eller pool:en recyclas.

Vid prod-credential-rotation:

1. **Vercel env-konfiguration uppdaterades** korrekt via REST API DELETE+POST (verifierat med GET-status och structurell check).
2. **Nya Lambda-instanser skulle** läsa det nya värdet från `process.env`.
3. **Existerande Lambda-instanser** fortsatte serva inkommande requests med gammalt cachat password i `process.env` — Vercel använde dem inte upp pga ingen kall start.
4. **REST API `forceNew=1`** skapar en ny build-artifact (commit-baserad) men **återanvänder samma Lambda function-pool** för att minska deploy-tid och cold-starts.
5. **Tom commit till `main`** triggade full Git-baserad deployment-cykel via Vercel-GitHub-integrationen. Det var inte själva tomma commiten som löste problemet — den fungerade som **trigger** för en deployment-typ som REST API `forceNew=1` inte verkar trigga. Den sannolika effekten var fresh Lambda/runtime lifecycle + ny `process.env`-init på alla nya instanser. Login fungerade omedelbart efter att deployen blev READY.

> **Viktigt:** Skillnaden mellan REST API `forceNew=1` redeploy och Git-triggad deployment är **observerad** — Vercel publicerar inte interna detaljer om Lambda-pool-recycling per deployment-typ. Vår slutsats baseras på beteende: två REST-redeploys gjorde inget, en Git-trigg löste det.

### Varför Postgres-loggar visade inga `28P01`-fel

Prisma-klienten kraschade troligen i ett tidigare lager — antingen vid connection-pool-init eller vid första query — innan den hann skicka credentials till Postgres. Eller: connection lyckades med gammalt password mot pooler men misslyckades vid Postgres-side-auth, men det skulle ha visats i postgres-logs. Mer troligt: Prisma-klienten exception:ade snabbt och fastnade i `getSession()` catch-block utan att Supabase Auth-flödet fortsatte.

### Varför det INTE var detta

- **Cookie-mismatch:** Avvisat — DevTools visade `sb-xybyzflfxnqqyxnvjklv-auth-token` korrekt satt på `equinet.johanlindengard.com` med giltig JWT-payload.
- **`NEXT_PUBLIC_*`-fel:** Avvisat — `vercel env pull --environment=production` (filtrerad) bekräftade `NEXT_PUBLIC_SUPABASE_URL = https://xybyzflfxnqqyxnvjklv.supabase.co` och anon-key med korrekt `ref`-claim.
- **Database password fel:** Avvisat — lokal `pg`-connect mot pooler 5432 + 6543 lyckades med samma värde som POSTades till Vercel.
- **Postgres-side-fel:** Avvisat — postgres-logs visade `connection authorized: user=pgbouncer` utan failures.
- **Supabase Auth Custom Token Hook fel:** Avvisat — auth-logs visade `Hook ran successfully` för varje login-attempt.

**Slutsats:** Det enda lager som inte direkt observerades men där hypotesen passar exakt är Vercel Lambda runtime-env-cache.

> **Status:** Hypotes baserad på observerat beteende. Vercel publicerar inte interna detaljer om Lambda-pool-recycling vid `forceNew=1` redeploy. Bekräftelse via deterministiskt experiment skulle kräva styrd repro vilket inte gjordes under incident.

---

## 5. Contributing factors

| Faktor | Beskrivning |
|---|---|
| **Vercel sensitive-var-bugs** | Tidigare denna vecka identifierade vi att CLI `vercel env add --value` sparar tomt + `vercel env pull` returnerar tomt för sensitive vars + UI Edit visar tomt fält vid paste. REST API DELETE+POST var den fungerande vägen — men den i sin tur introducerade behovet att splitta delade rader. |
| **Delade env-rader (Production+Development)** | `DIRECT_DATABASE_URL` hade target=`["production", "development"]` på samma rad. DELETE av delad rad raderar för båda environments. Krävde split-flöde innan rotation, vilket ökade antalet operations. |
| **DB-password i terminal/transkript** | Min `vercel env pull` (utan `--project`) gick mot `equinet-app` (lokalt linkat) istället för det jag ville titta på. Min curl-output med `head -c 80` var inte tillräckligt smal — 80 chars av en URL inkluderar password-segmentet. |
| **Runtime-cache var inte i runbook** | Teamet hade ingen dokumenterad regel om att Lambda-instanser cachar env. Förmodligen för att vi inte tidigare rotat sensitive prod-vars i runtime. |
| **Otydligt UI-symptom** | Login-blink utan synligt felmeddelande gjorde det svårt att skilja "fel password" från "session-validering failar". Användaren ser inte 401-svaret från `/api/auth/session`. |
| **Falska tröstande signaler** | Auth-logs 200, postgres-logs OK, cookies OK — alla signaler indikerade att problemet låg i en blind fläck mellan dessa lager. |

---

## 6. What went well

| Faktor | Detalj |
|---|---|
| **Snabb incident-respons** | Inom minuter från läckage roterades password. |
| **Säkrare path använd** | REST API DELETE+POST efter verifiering av att CLI-paths var bristfälliga. |
| **Lokal pg-connect-test före POST** | Etablerade som ny safety-net efter första misslyckade rotation. Bekräftade att password fungerar mot Supabase **innan** vi POSTade till Vercel. |
| **Maskerad output i diagnos-scripts** | Andra rotation-försöket använde JWT-decode för att verifiera `ref`+`role` utan att printa hela värden. |
| **Supabase MCP-aktivering** | Tillåt SQL-verifiering av `public.User`, auth-logs, och postgres-logs i realtid utan att exponera secrets. Avgörande för diagnostik. |
| **Inga prod-data-skrivningar förlorade** | Existerande deployments cachade gamla credentials → kraschade vid query → ingen partial-write. |
| **Staging orört** | Trots paralllellt arbete med staging-env tidigare på dagen blev staging-config aldrig blandat med prod under incident. |
| **Lärdom dokumenterades direkt** | Memory-fil + denna post-mortem skapades inom timmar. |

---

## 7. What went poorly

| Faktor | Detalj |
|---|---|
| **Secret exponerades i terminal** | Trots att tidigare safety-rules fanns på plats hände det igen. `head -c 80` var fel-konfigurerad bredd. |
| **Falsk trygghet från redeploys** | Vi triggade redeploy två gånger utan att första få en signal om att Lambda-cache var problemet. Båda redeploys returnerade READY → vi trodde varje gång att det var fixat. |
| **Saknad runbook för Vercel env-rotation** | Vi gick "by feel" — DELETE+POST→redeploy→test. Missade Lambda-recycling-steget eftersom det inte fanns dokumenterat. |
| **Saknad cache-bust-steg** | Tom commit + push var en ad-hoc-lösning som upptäcktes via uteslutning, inte via runbook. |
| **Login-error icke-diagnostiskt** | UI visar inget felmeddelande vid blink. Måste hand-läsas via Network-tab + cookies + server-logs. Kommer att hända igen om vi inte förbättrar. |
| **2 timmars diagnostik-tid** | Mycket tid spenderades på password-mismatch-hypoteser innan vi kom till runtime-cache-hypotesen. |

---

## 8. Detection

| Aspekt | Detalj |
|---|---|
| **Hur upptäcktes felet** | Manuell browser-test av Johan på `https://equinet.johanlindengard.com/login` efter password-rotation. |
| **Symptom** | Login-knappen klickades → fältet tömdes → sidan blinkade kort → tillbaka till login-skärmen. Inget felmeddelande visat för användaren. |
| **Console-error** | `[Error] Failed to load resource: the server responded with a status of 401 () (session, line 0)` (förväntat när inte inloggad — INTE indikator på fel). |
| **Network-tab** | POST `/api/auth/login` → 200, sen GET `/api/auth/session` → 401, sen redirect till `/login`. |
| **Tid till detektion** | Sekunder efter försök att logga in (Johan testade omedelbart efter rotation). |
| **Saknade detektorer** | Ingen automatiserad health-check som verifierar att login-flow lyckas end-to-end mot prod. Sentry-events var inte synliga via REST API i realtid. |

---

## 9. Resolution

### Sekvens

1. **Tom commit på main:**
   ```
   git commit --allow-empty -m "chore: rebuild prod with fresh prisma binary"
   ```
2. **Push till origin** (utlöste Vercel auto-deploy via GitHub-integration).
3. **Vercel deployment `dpl_2opG7P6Y4qxFEd` blev READY** efter ~3 min.
4. **Browser-test omedelbart därefter** → login-flow fullbordades, dashboard laddade, ingen blink.
5. Ingen ytterligare ändring krävdes.

### Vad som faktiskt löste det

Den tomma commiten i sig innehöll ingen kod-ändring och var **inte** den läkande effekten — den fungerade enbart som **trigger för en full Git-baserad deployment-cykel**. Den sannolika effekten av den deployment-typen (jämfört med REST API `forceNew=1` som vi körde två gånger utan resultat) var:

- Fresh Lambda-pool — nya function-instanser fick fresh `process.env`-init med uppdaterat `DATABASE_URL`
- Möjligen också ny build-cache-bust för Prisma-binärer (sekundär hypotes)

**Status:** Hypotes baserad på observerat beteende. Vercel publicerar inte interna detaljer om hur olika deployment-trigger-typer påverkar Lambda-pool-recycling. Bekräftelse skulle kräva styrd repro i kontrollerad miljö.

### Verifiering efter resolution

- Manuell login som Johan + Erik fungerade
- Auth-logs visar fortsatt 200 + Custom Hook OK
- Inga 5xx-fel i server-respons

---

## 10. Action items

### Immediate (idag)

- [x] Rensa `.env.local` från `PROD_TX_URL` och `PROD_DIRECT_URL` (rotation-tempvariabler)
- [x] Radera `docs/_prod-rotation-paste.md`
- [x] Spara lärdom i memory: `feedback_vercel_lambda_env_cache.md`
- [x] Skapa denna post-mortem
- [ ] Verifiera att gamla passwords inte finns kvar någonstans i `.env.local` eller andra lokala filer

### Short-term (denna sprint)

- [ ] **Skapa runbook** `docs/runbooks/vercel-prod-env-rotation.md` med exakt sekvens (Supabase reset → lokal verify → Vercel REST DELETE+POST → tom commit → verifiera login)
- [ ] **Lägg till regel i CLAUDE.md** under "Vercel & Supabase serverless": "efter prod env credential-rotation krävs full Git-triggered deploy/cache bust"
- [ ] **Förbättra login/session-error logging** — `getSession()` catch-block ska rapportera Sentry med kontext (route + user-id-hash) för att snabba upp framtida diagnostik
- [ ] **Maska connection strings i alla scripts** — alla scripts som hämtar env måste använda JWT-decode eller URL-parse + maskera, aldrig printa fulla strängar
- [ ] **Lägg till env audit-script** `scripts/check-prod-env.ts` utökas att verifiera non-empty + project-ref + format. Kör i prebuild när `VERCEL_ENV=production`. (Utöker sprint S64-4-arbetet.)

### Long-term (kommande sprintar)

- [ ] **Vercel env management script** med säkra prompts (`read -rsp`-pattern centralt + JWT/URL-decode + maskerad output)
- [ ] **Separera Development env helt från production** — sluta dela rader. Development pekar alltid på lokal Supabase, Production pekar alltid på prod-DB. Inga delade target-arrays.
- [ ] **Environment ownership doc** — vem äger vilka env-vars, hur ändringar dokumenteras, vad som kräver review
- [ ] **Incident checklist i CLAUDE.md** — "om login bryts efter env-ändring: kontrollera Lambda-cache först (tom commit-test), sen credentials"
- [ ] **Health endpoint** `/api/health/db` som anonymt verifierar `prisma.user.count()` (eller motsvarande lättviktig query) → returnerar 200/500. Inga secrets exponerade. Triggar Sentry-alarm vid 500.

---

## 11. New runbook rule

Lägg till i `docs/operations/environments.md` (eller nytt runbook-dokument):

### Vid production DB credential-rotation (eller annan runtime-känslig env)

1. **Rotera credential** i Supabase Dashboard (eller motsvarande extern provider). Spara nytt värde i lösenordshanterare med datumstämpel.
2. **Verifiera lokal connect** mot nya credentials. För DB: `pg`-klient mot pooler-URL → `SELECT 1`. Båda transaction-port (6543) och session-port (5432) ska returnera OK. Vänta ev. 60-90s om transaction-pooler initialt failar (cache-delay).
3. **Uppdatera Vercel env via REST API DELETE+POST** (CLI har dokumenterade buggar med sensitive vars). Använd separata Production-only och Development-only rader (aldrig delad target-array). Maskera värden i terminal-output.
4. **Verifiera env-rad finns** via REST API GET med korrekt `target`, `gitBranch`, `type`. Sensitive-vars returnerar tom value via API — verifiera structurellt, inte värdemässigt.
5. **Trigga full Git-baserad production deployment** — INTE bara REST API redeploy med `forceNew=1`. Tom commit + push fungerar:
   ```
   git checkout main && git pull
   git commit --allow-empty -m "chore: rebuild prod with fresh runtime env [override: prod credential rotation]"
   git push origin main
   ```
6. **Verifiera deployment READY** via REST API eller Vercel UI. Notera deployment-id.
7. **End-to-end login-test** i incognito-fönster mot custom domain. Logga in med riktigt prod-konto. Bekräfta dashboard laddar.
8. **Verifiera runtime DB-access** — gå till en sida som triggar Prisma-query (bokningar, profil) och bekräfta data laddar.
9. **Dokumentera deployment-id** i incident-noteringen eller runbook-användning.

**Stoppvillkor:** Om steg 7 eller 8 failar — STOPPA, gör inte fler ändringar förrän rotorsak är identifierad. Kolla Vercel-deployment-logs för Prisma-fel, Supabase auth-logs för 5xx, och cookies för domain-mismatch.

---

## 12. Open questions

| Fråga | Status | Förslag |
|---|---|---|
| Varför räckte inte REST API redeploy med `forceNew=1`? | Hypotes (Lambda-pool-återanvändning) — inte bevisat | Fråga Vercel-supporten eller deterministisk repro i staging-projekt |
| Finns Vercel-inställning för "no-cache rebuild" eller "full function-recycle"? | Okänt | Researcha Vercel-doc och `/v13/deployments`-API-params (`noBuildCache`, `meta`-fält etc.) |
| Kan vi verifiera runtime env fingerprint säkert? | Inte med nuvarande tools | Hash-baserad fingerprint (SHA256 av kritiska vars) loggad vid Lambda-init kan vara deterministiskt utan exponering |
| Bör vi ha health-endpoint som verifierar DB-connect? | Föreslagen i action items | Ja — light query (`SELECT 1`) returnerar 200/500 utan secrets, kan användas av extern uptime-monitor |
| Bör staging också ha credential-rotation-runbook? | Sannolikt | Samma princip men annan plan-payment-impact — staging-down stör inte slutkunder |
| Hur ska CI/CD agera vid framtida credential-rotation? | Manuell idag | Eventuellt GitHub Action som triggar tom commit på main efter env-ändring (men kräver rotation-detection som inte finns) |

---

**Sammanfattningsvis:** Tekniskt fix var enkelt (tom commit → push). Diagnostik tog tid pga avsaknad av runbook och otydlig signal från app-lagret vid Lambda-runtime-cache-issue. Lösning + lärdomar dokumenterade. Inga prod-data-konsekvenser.
