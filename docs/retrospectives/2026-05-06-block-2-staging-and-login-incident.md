---
title: "Block 2 staging environment + login-incident — retro 2026-05-06"
description: "Stor session: demo-readiness slice (S66-1+S66-2), staging environment ground-up build (custom domains, isolerad Supabase, env-split, Site URL-config), prod-login-incident med tre Vercel-plattform-buggar identifierade och löst via REST API."
category: retro
status: active
last_updated: 2026-05-06
tags: [retro, staging, vercel, supabase, incident, demo-readiness]
sections:
  - Resultat
  - Vad som byggdes
  - Vad gick bra
  - Vad kan förbättras
  - Patterns att spara
  - 5 Whys
  - Lärandeeffekt
---

# Retrospektiv: Block 2 staging environment + login-incident

**Datum:** 2026-05-06
**Scope:** Två sammanhängande arbetsområden i samma session — (1) demo-readiness-slice S66-1+S66-2 (smoke-checks och Vercel BotID-hantering), (2) Block 2 ground-up build av isolerad staging-miljö med tre plattform-buggar som triggade en prod-login-incident.

---

## Resultat

### Kod (på `feature/s66-1-demo-consistency-smoke`, mergad till main via PR)

- 7 nya/ändrade filer, +838/−17 rader
- **23 nya unit-tester** (9 för local-check, 14 för prod-check inkl. 9 nya för BotID-detektion)
- 1 ny tunn E2E-spec (`e2e/demo-flow.spec.ts`)
- 2 nya npm-scripts (`demo:check:local`, `demo:check:prod`)
- Inga schema-ändringar, inga nya migrationer
- Inga regressioner i 4375+ befintliga tester

### Dokumentation (på `staging`-branch)

- 7 docs-filer ändrade/skapade, +1084/−21 rader
- 5 nya operations-docs:
  - `equinet-technical-reset.md` (post-incident audit, supersede senare)
  - `demo-readiness-next-steps.md` (post-login-incident plan, status superseded)
  - `preview-demo-verification.md` (preview deploy-status)
  - `staging-environment-setup.md` (full plan + utfall)
- 2 uppdaterade docs:
  - `operations/url-configuration.md` (miljöer-sektion + 2 nya historik-rader)
  - `operations/environments.md` (custom domains, ny tabell-struktur)
  - `demo-mode.md` (prod walkthrough-URL)

### Infrastruktur (Vercel + DNS + Supabase)

- 2 nya custom domains live: `equinet.johanlindengard.com` (prod), `equinet-staging.johanlindengard.com` (staging)
- 2 nya CNAME-records hos DNS-provider
- TLS-cert via Let's Encrypt på båda
- 1 ny git-branch `staging` med Vercel branch-binding
- Vercel env-rader splittrade per environment: `APP_URL` × 3, `DATABASE_URL` × 2, `DIRECT_DATABASE_URL` × 2
- Supabase Site URL + Redirect URLs uppdaterade för båda projekt
- Staging-DB synkad: 41 → 45 migrations applied via `prisma migrate deploy`
- Custom Access Token Hook verifierad aktiv i staging

### Sammanfattning

| Kategori | Antal |
|----------|-------|
| Commits idag (feature + staging) | 7 (3 på feature, 4 på staging — 1 docs-fix tidigare på sessionen) |
| Custom domains skapade | 2 |
| Vercel env-operations | ~15 (CLI + UI + REST API) |
| Inkidenter | 1 (prod-login broken efter redeploy) |
| Vercel-plattform-buggar identifierade | 3 (CLI rm-semantik på shared row, UI-paste-rensning, CLI `--value` empty-save) |
| Tid | 1 lång session |

---

## Vad som byggdes

### Spår 1: Demo-konsistens-smoke (S66-1 + S66-2)

| Lager | Filer | Beskrivning |
|-------|-------|-------------|
| CLI | `scripts/demo-check-local.ts` (~150 rader) | Read-only Prisma-check för lokal demo-readiness |
| CLI | `scripts/demo-check-prod.ts` (~225 rader efter S66-2) | Read-only HTTPS-check + Vercel BotID-detektion |
| Tests | `scripts/demo-check-local.test.ts` (9 tester) | Pure-function-tester för fail-modes |
| Tests | `scripts/demo-check-prod.test.ts` (23 tester totalt) | 14 ursprungliga + 9 för `detectBotIdChallenge` |
| E2E | `e2e/demo-flow.spec.ts` (~70 rader) | Tunn login + 5-flikar walkthrough |
| Config | `package.json` | 2 nya npm-scripts |
| Docs | `docs/demo-mode.md` | Ny "Verifiera demo-läge"-sektion |

### Spår 2: Block 2 — staging environment build

Infrastruktur-arbete utan kodändringar i appen. Allt skedde i Vercel UI/CLI/REST API + DNS-provider + Supabase Dashboard.

| Block | Aktion |
|-------|--------|
| 2A | Custom domains live (prod + staging via Vercel UI + DNS CNAME) |
| 2B | `staging`-branch skapad + Vercel auto-deploy |
| 2C.1 | `APP_URL` per environment (3 rader: Production, Preview/staging, Development utan `\n`) |
| 2C.2 | `DATABASE_URL` split (Production prod-pooler, Preview-staging) — efter CLI-incident och rebuild via UI |
| 2C.3 | `DIRECT_DATABASE_URL` split via UI |
| 2D | Supabase Site URL + Redirect URLs för båda projekt (prod + staging) |
| 2E | End-to-end login-test mot staging — verifierad |

Schema-arbete: `prisma migrate deploy` mot staging-DB applicerade 4 saknade migrations (`stripe_webhook_event`, `add_conversation_message`, `conversation_rls_policies`, `add_message_attachment_fields`).

### Spår 3: Login-incident (oavsiktligt)

Triggades av `vercel env rm DATABASE_URL preview --yes` på en delad rad. Tre Vercel-plattform-buggar upptäcktes under recovery:

1. CLI `rm <var> <env> --yes` på delad rad raderar **alla** environments, inte bara den specificerade.
2. Vercel UI Edit på sensitive Production-vars → paste landar inte i fältet (verifierat genom flera försök).
3. Vercel CLI `vercel env add --value "X" --yes` (52.2.1 OCH 53.1.1) sparar tom sträng tyst för Production sensitive-vars.

Slutlig fix via Vercel REST API DELETE+POST. Lösenord extraherat från intakt `DIRECT_DATABASE_URL` (samma password). Login fungerade efter redeploy.

---

## Vad gick bra

### 1. Read-only audit innan write (sparade flera incidenter)

Innan staging-DB rörts kördes audit via `supabase db query --linked` för att verifiera schema-state. Det avslöjade att staging hade 41 migrations applicerade med 24 users + 5 providers + 8 services — inte tomt som först antaget från `supabase migration list`. Det ändrade migrate-strategin från "bootstrap" till "lägg till 4 saknade migrations" och eliminerade risk för datakonflikt.

### 2. CLI-fälla fångad innan ny incident vid 2C.3

Efter `vercel env rm` raderade DATABASE_URL från alla environments dokumenterades omedelbart: "för delade rader → splittra via Vercel UI, inte CLI". När 2C.3 (DIRECT_DATABASE_URL split) gjordes användes Vercel UI Edit som inte hade samma destruktiva semantik. Andra incident undveks.

### 3. Vercel REST API som tredje väg när UI och CLI båda failade

När både UI-paste och CLI `--value` sparade tomt för sensitive Production-vars var första instinkten panik. I stället identifierade vi REST API som annan kodväg och bevisade med dummy-var att det fungerar. Det gav konkret recovery-väg utan att behöva uppgradera CLI eller bryta paste-flöden.

### 4. Password-extraktion från intakt env-rad

`DIRECT_DATABASE_URL` Production var orörd sedan 99 dagar och hade rätt password. Istället för att be Johan resetta DB-password (vilket skulle kräva uppgradering av flera consumers) extraherades password från `DIRECT_DATABASE_URL` via `vercel env pull`, byggdes ny `DATABASE_URL` med pooler-port 6543, och PATCH:ades in. Säkrare och snabbare än password-rotation.

### 5. Diagnostiskt flöde av Browser → Network → Vercel logs

När login failade gick vi systematiskt: först browser-symptom (401 på `/api/auth/session`), sen kodgenomgång (`auth-server.ts.getSession()`-flow), sen Vercel runtime logs som visade exakt error (`Authentication failed against database server`). Det avslöjade att DATABASE_URL hade fel password — inte fel host eller fel projekt.

---

## Vad kan förbättras

### 1. Pre-build-guard fångar inte tomma env-strängar

`scripts/check-prod-env.ts` (S64-4) verifierar att kritiska env-vars **finns**, men inte att de **har värde**. Båda incidents idag (DATABASE_URL och APP_URL Production = tom) skulle ha fångats om guarden krävde icke-tom sträng.

**Prioritet:** HÖG — skulle ha blockerat båda dagens deploy-incidenter och skulle blockera framtida liknande. ~30 min implementation.

### 2. `vercel env rm` på delade rader är inte dokumenterad i våra docs

CLI-fällan #1 (rm av delad rad raderar allt) är okänd för många. Vi dokumenterade det idag i `staging-environment-setup.md` och `url-configuration.md`-historik, men det finns ingen central "Vercel CLI-fällor"-sida.

**Prioritet:** MEDEL — `docs/guides/gotchas.md` är rätt plats. ~15 min.

### 3. Inget snabbt sätt att verifiera Vercel sensitive Production-värden

`vercel env pull --environment=production` fungerar (upptäckt sent under sessionen), men det är inte dokumenterat i våra docs. Hela första halvan av incident-recovery hade gått snabbare om vi vetat att den flaggan finns.

**Prioritet:** MEDEL — lägg in i `url-configuration.md` eller `environments.md`. ~5 min.

### 4. Stort scope i en session

Demo-readiness-slice + Block 2 staging build + login-incident — tre stora arbeten i en session. Block 2 hade 6 delmoment (2A–2F) och pluse incident-recovery på 30+ min. Sessionen blev produktiv men risken för fel ökar i slutet av en lång session (incidenten triggades vid en CLI-operation 4 timmar in).

**Prioritet:** LÅG — det blev OK denna gång, men nästa gång: pausa innan stora env-operationer om man redan suttit länge.

### 5. Doc-commit-fragmentering

Tre olika doc-commits idag (smoke-checks på `feature/s66-1`, planning-docs på `staging`, ops-update på `staging`). Det fungerar men gör det svårare att se hela arbetet i ett ställe i git history.

**Prioritet:** LÅG — vi har medvetna val (smoke-checks är en feature-branch, andra är staging-relaterade). Acceptabelt fragmentering.

---

## Patterns att spara

### Pattern: BotID-detektion i programmatic prod-smoke

I `scripts/demo-check-prod.ts`: detektera `x-vercel-mitigated: challenge`-header → returnera WARN istället för FAIL. Behåll hård fail för riktiga app-fel. Pure function `detectBotIdChallenge(status, headers)` testbar utan IO. Replicera om annan smoke-check behövs mot Vercel-skyddade endpoints.

### Pattern: Säker password-leverans till Claude via `read -rsp`

```bash
read -rsp "Paste secret: " VAR && printf '\nKEY=%s\n' "$VAR" >> .env.local && unset VAR && echo OK
```

Tyst prompt, värde syns aldrig i terminal-history. `printf` istället för `echo` för att undvika trailing newline. Värdet hamnar i `.env.local` (gitignored). Förenklas via `bash -c '...'` för zsh-kompatibilitet.

### Pattern: Vercel REST API DELETE+POST för sensitive Production-vars

CLI `--value` och UI-paste sparar tomt. REST API `PATCH` på existerande sensitive-var **med tomt befintligt värde** behåller tomt. **DELETE + POST** skapar ny rad korrekt:

```bash
# Find env-id
ENV_LIST=$(curl -sS "https://api.vercel.com/v9/projects/${PROJECT_ID}/env?teamId=${ORG_ID}" \
  -H "Authorization: Bearer ${TOKEN}")
ENV_ID=$(echo "$ENV_LIST" | jq -r '.envs[] | select(.key=="X" and (.target | index("production")!=null)) | .id')

# DELETE
curl -sS -X DELETE "https://api.vercel.com/v9/projects/${PROJECT_ID}/env/${ENV_ID}?teamId=${ORG_ID}" \
  -H "Authorization: Bearer ${TOKEN}"

# POST new
PAYLOAD=$(jq -n --arg v "$VALUE" '{key:"X", value:$v, type:"encrypted", target:["production"]}')
curl -sS -X POST "https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${ORG_ID}" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" --data "$PAYLOAD"
```

Använd `jq -n --arg v "$VALUE"` för säker JSON-build (skyddar mot specialtecken).

### Pattern: Read-only schema-audit via Supabase Management API

`supabase db query --linked "SELECT ..."` använder Management API (HTTP), inget DB-password krävs. Begränsat till linked project (växla med `supabase link --project-ref X`). Bra för audit utan att hantera secrets.

### Pattern: Password-extraktion från intakt env-rad

När en env-var har förlorats men en relaterad var (`DIRECT_DATABASE_URL` vs `DATABASE_URL`) har samma password — extrahera via `vercel env pull --environment=production`, parse password ut ur connection string, bygg ny URL. Slipper password-rotation och dess sidoeffekter.

### Pattern: Domain-strategi via `<env>-suffix.<root>`

Production = `equinet.johanlindengard.com`, staging = `equinet-staging.johanlindengard.com`. Suffix för miljö, prod ren. DNS: båda CNAME till samma Vercel-target (Vercel routar via Host-header). Vercel UI: Add Domain → Production-default eller branch-binding=staging.

---

## 5 Whys

### Problem 1: Login broken efter redeploy

1. Varför? `/api/auth/session` returnerade 401 → `auth-dual.ts` fick null från Prisma.
2. Varför? Prisma kunde inte autentisera mot DB-server.
3. Varför? `DATABASE_URL` Production hade fel password (eller tomt värde).
4. Varför? Värdet sparades fel via Vercel CLI `vercel env add --value "$URL" --yes` — CLI rapporterade success men sparade tomt.
5. Varför? Vercel CLI 52.2.1 OCH 53.1.1 har en plattform-bug där `--value` (och stdin) på sensitive Production-vars rejectar värdet tyst. UI:s Edit har samma symptom (paste landar inte).

**Åtgärd:** (a) Pre-build-guard som avvisar tomma kritiska env-vars (~30 min implementation). (b) Dokumentera Vercel REST API DELETE+POST som fallback-väg i `gotchas.md`. (c) Rapportera bug till Vercel support.
**Status:** Att göra — dokumenterad lärdom, faktisk fix kvar för nästa session.

### Problem 2: `vercel env rm` på delad rad raderade alla environments

1. Varför? `vercel env rm DATABASE_URL preview --yes` tog bort `DATABASE_URL` från Production + Development också.
2. Varför? CLI tolkar `rm <var> <env>` på en rad som täcker flera environments som "ta bort hela variabeln för matchande key" snarare än "ta bort environment-tilldelningen".
3. Varför? CLI:s help-text dokumenterar inte denna semantik tydligt — examples-sektionen säger "Remove a variable from multiple Environments" som mer ser ut som "ta bort en miljö från en multi-env-rad".
4. Varför? Vi använde `--yes` (bypass confirmation) — utan det hade prompt sannolikt visat "This will remove DATABASE_URL from all environments. Continue?".
5. Varför? `--yes` är ofta default i automation-skript och vi adopterade det utan att tänka på "destructive default" i denna kontext.

**Åtgärd:** Lärdom dokumenterad i `staging-environment-setup.md` och `url-configuration.md`-historik. Regel: Vercel env-rm/edit på delade rader → använd UI, inte CLI med `--yes`.
**Status:** Implementerad (dokumentation), borde också gå in i `gotchas.md`.

### Problem 3: Tre olika input-vägar i Vercel kan tyst spara tomt

1. Varför? Sensitive Production-vars är skrivskyddade vid läs (write-only design).
2. Varför? Det är säkerhetsdesign — sensitive secrets ska inte exponeras i UI/CLI även för authenticated users.
3. Varför? Men det betyder att UI:s Edit-form visar tomt fält som default — och om Save triggas utan ny paste sparas tomt.
4. Varför? Vercel UI har ingen "value preserved" indicator eller "no change" detection.
5. Varför? CLI `--value`-flag har en mer mystisk bug — värdet skickas men accepteras inte. Sannolikt server-side rejection som inte rapporterar fel.

**Åtgärd:** (a) Använd alltid Vercel REST API för sensitive Production-vars. (b) Verifiera värden via `vercel env pull --environment=production` efter varje skrivning. (c) Pre-build-guard skulle fånga tomma värden vid build-time.
**Status:** Att göra — REST API-flödet bevisad, dokumentationen påbörjad i denna retro.

---

## Lärandeeffekt

**Nyckelinsikt 1:** Vercel-plattformen har **flera oberoende input-vägar** (UI, CLI, REST API) med **olika kvirks** — när en failar, prova nästa, men verifiera alltid via `env pull --environment=production` efter varje skrivning. "Lyckades-rapport" från CLI eller UI är inte tillräckligt.

**Nyckelinsikt 2:** **Read-only audit FÖRE write** sparade flera incidents idag. `supabase db query --linked` (Management API, ingen password) gjorde det möjligt att verifiera staging-DB-state utan att riskera writes. Generalisera principen: vid alla "fix infra"-uppgifter, kör read-only audit först.

**Nyckelinsikt 3:** **Backup-vägar måste finnas** även när huvudvägen verkar fungera. Dagens incident var lösbar för att tidigare prod-deploy `5sole58n0` hade inbakade rätta env-värden från build-time. Rollback gav 30s återställning. Pre-build-guard skulle stoppa att en tom env-var ens når deploy.

**Nyckelinsikt 4:** **Custom domain-strategin är klar** — `equinet.johanlindengard.com` (prod) + `equinet-staging.johanlindengard.com` (staging) med separata Vercel env-rader per environment och separata Supabase-projekt. Det är en arkitektur som skalar och är dokumenterad i `staging-environment-setup.md`.
