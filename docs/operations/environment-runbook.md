---
title: Environment Runbook — Vercel + Supabase DB URLs
description: Säkra copy/paste-steg för att granska och ändra env-variabler (DATABASE_URL, DIRECT_DATABASE_URL, DEMO_MODE, PAYMENT_PROVIDER) i Vercel för staging och production, utan att läcka secrets eller bryta runtime.
category: operations
status: active
last_updated: 2026-06-11
sections:
  - Principer
  - Safe audit
  - DATABASE_URL
  - DIRECT_DATABASE_URL
  - DEMO_MODE
  - PAYMENT_PROVIDER / Stripe
  - Copy/paste recipes
  - Troubleshooting
related:
  - docs/sprints/production-env-guard-plan.md
  - docs/operations/staging-environment-setup.md
  - docs/operations/incident-runbook.md
---

# Environment Runbook — Vercel + Supabase DB URLs

> Syfte: nästa gång en env- eller databas-URL behöver fixas ska Johan kunna **copy/paste:a
> säkra steg** utan trix. Allt här är read-first, mask-only och secret-säkert.

## Miljöer i korthet

| Miljö | Vercel-projekt | Bygger branch | Supabase-projekt | Region |
|-------|----------------|---------------|------------------|--------|
| **Production** | `equinet-app` | `main` | `xybyzflfxnqqyxnvjklv` | Zürich |
| **Staging/demo** | `equinet-staging-app` | `staging` | `zzdamokfeenencuggjjp` | Frankfurt |

Repo:t är normalt `vercel link`:at mot **`equinet-app`** (prod). Staging hanteras som ett
**separat projekt** — se [Safe audit](#safe-audit) för hur man riktar mot staging.

---

## Principer

1. **Läs först, skriv sen.** Pulla och inspektera nuvarande värde (maskerat) innan du ändrar.
2. **Skriv aldrig secrets i chatten.** Visa bara maskerat (`***` istället för lösenord) eller status (SET/MISSING).
3. **Sensitive/encrypted Vercel-vars: DELETE + CREATE, inte PATCH.** PATCH på sensitive vars är opålitligt — värdet kan tyst bli tomt. Ta bort raden och skapa en ny.
4. **Rör aldrig en delad env-rad utan att först identifiera targets.** En rad kan gälla `[production,preview,development]` samtidigt — då raderar en delete den för ALLA. Verifiera att `target` är exakt `[production]` (eller exakt den miljö du vill röra) först.
5. **Staging och prod hanteras separat.** Olika Vercel-projekt, olika Supabase-projekt, olika secrets. Blanda aldrig.
6. **Verifiera efter varje skrivning.** Pulla igen, byte-kontrollera maskerat.
7. **Build-time-vars (`NEXT_PUBLIC_*`) kräver redeploy** för att slå igenom. Runtime-vars (t.ex. `DATABASE_URL`) gäller också först vid nästa deploy (en deployment fångar env vid build).

---

## Safe audit

Visar **status** för varje variabel — aldrig värden. Klassning:

| Status | Betyder |
|--------|---------|
| `SET` | Har ett icke-tomt värde |
| `MISSING` | Variabeln finns inte |
| `EMPTY` | Finns men tom sträng (`""`) |
| `WHITESPACE_ONLY` | Bara blanksteg (passerar en naiv "finns"-koll men är i praktiken tom) |

Plus icke-hemliga booleans → `TRUE`/`FALSE`/`UNSET` och `PAYMENT_PROVIDER` → `mock`/`stripe`/`OTHER`/`UNSET`.

### Production

```bash
npm run audit:prod-env:safe
```

Scriptet (`scripts/audit-prod-env-safe.mjs`) kör `vercel env pull --environment=production`
till en temp-fil, skriver ut statusrapporten och **raderar temp-filen**. Inga värden visas.

### Staging

Staging är ett separat Vercel-projekt (`equinet-staging-app`). Det finns inget dedikerat
staging-audit-script ännu — kör manuellt genom att tillfälligt länka till staging-projektet:

```bash
# 1. Länka tillfälligt till staging-projektet (i en separat katalog rekommenderas)
vercel link --project equinet-staging-app --yes

# 2. Pulla + inspektera status (icke-existerande filnamn → ingen overwrite-prompt)
f="/tmp/staging-audit-$$.env"; rm -f "$f"
vercel env pull --environment=production "$f" >/dev/null 2>&1
grep -E '^(DATABASE_URL|DIRECT_DATABASE_URL|NEXT_PUBLIC_DEMO_MODE|PAYMENT_PROVIDER)=' "$f" \
  | sed -E 's#(://[^:]+:)[^@]+(@)#\1***\2#'   # maskera lösenord
rm -f "$f"

# 3. Länka tillbaka till prod
vercel link --project equinet-app --yes
```

> **Framtida förbättring:** ett `audit:staging-env:safe`-script som tar projekt som parameter.
> Tills dess: manuellt enligt ovan.

---

## DATABASE_URL

Runtime-anslutning via Supabase **transaction pooler** (pgbouncer). Måste ha rätt query-suffix:

```
postgresql://postgres.<ref>:<LÖSENORD>@aws-1-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

- Port **6543** = transaction pooler.
- **`?pgbouncer=true`** är OBLIGATORISKT mot pgbouncer (annars prepared-statement-fel).
- **`&connection_limit=1`** för serverless (en anslutning per Lambda).
- Vanligaste felet: `…/postgres&connection_limit=1` (`&` istället för `?`) → Prisma tolkar
  databasnamnet som `postgres&connection_limit=1` → `PrismaClientInitializationError` →
  session-401 vid login. (Inträffade 2026-06-11.)

### Verifiera (maskerat)

```bash
f="/tmp/db-verify-$$.env"; rm -f "$f"
vercel env pull --environment=production "$f" >/dev/null 2>&1
line=$(grep -E '^DATABASE_URL=' "$f" | head -1); val="${line#*=}"; val="${val%\"}"; val="${val#\"}"
rm -f "$f"
echo "längd: ${#val}"
echo "?pgbouncer=true: $(printf '%s' "$val" | grep -q '?pgbouncer=true' && echo ja || echo NEJ)"
echo "databasnamn rent /postgres?: $(printf '%s' "$val" | grep -qE '/postgres\?' && echo ja || echo NEJ)"
echo "maskerat: $(printf '%s' "$val" | sed -E 's#(://[^:]+:)[^@]+(@)#\1***\2#')"
```

### Delete + recreate (production)

Eftersom DATABASE_URL är `encrypted`/sensitive: **ta bort + skapa ny**. Hämta `?`-formaterad
sträng från Supabase (Dashboard → Connect → **Transaction pooler**) — den har redan rätt format.

Det finns ett färdigt helper-script som läser nuvarande värde, fixar **bara** suffixet
(bevarar lösenordet) och recreatar via REST API utan att skriva ut secreten:

```bash
bash scripts/set-prod-database-url.sh          # DRY-RUN: visar maskerad före/efter + plan
bash scripts/set-prod-database-url.sh --go      # KÖR delete + create + verifiera
```

Eller manuellt via Vercel REST API (mönster — fyll i projekt/team/id):

```bash
PID=$(node -e "console.log(require('./.vercel/project.json').projectId)")
TEAM=$(node -e "console.log(require('./.vercel/project.json').orgId)")
TOKEN=$(node -e "console.log(require(process.env.HOME+'/Library/Application Support/com.vercel.cli/auth.json').token)")

# 1. Hitta env-id med target EXAKT [production] (skydda delade rader)
curl -s "https://api.vercel.com/v9/projects/$PID/env?teamId=$TEAM" -H "Authorization: Bearer $TOKEN" \
 | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const e=(JSON.parse(d).envs||[]).find(x=>x.key==='DATABASE_URL'&&JSON.stringify(x.target)==='[\"production\"]');console.log(e?e.id:'(saknas)')})"

# 2. DELETE den raden:  curl -X DELETE ".../v9/projects/$PID/env/<ENVID>?teamId=$TEAM" -H "Authorization: Bearer $TOKEN"
# 3. CREATE ny (body via stdin-pipe → secret hamnar aldrig i 'ps'):
#    node -e "process.stdout.write(JSON.stringify({key:'DATABASE_URL',value:'<NY-URL>',type:'encrypted',target:['production']}))" \
#      | curl -X POST ".../v10/projects/$PID/env?teamId=$TEAM" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' --data @-
```

### Exempel utan secrets

**Production** (Zürich-projektet `xybyzflfxnqqyxnvjklv`):
```
postgresql://postgres.xybyzflfxnqqyxnvjklv:***@aws-1-eu-central-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**Staging** (Frankfurt-projektet `zzdamokfeenencuggjjp`):
```
postgresql://postgres.zzdamokfeenencuggjjp:***@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

> **Normaliserings-fälla:** username:t börjar med `postgres.` → en `${url%%/postgres*}`-strip
> (longest match) träffar `//postgres` i `postgresql://postgres.<ref>` fel. Använd `${url%/postgres*}`
> (shortest/sista match) för att klippa vid databas-`/postgres`.

**Efter ändring: redeploy** (tom commit → relevant branch) så runtime-env gäller.

---

## DIRECT_DATABASE_URL

Direkt-anslutning för **migrationer** (Prisma migrate), kringgår pgbouncer. Inget pgbouncer-suffix.

```
postgresql://postgres:<LÖSENORD>@db.<ref>.supabase.co:5432/postgres
```

- Port **5432** = direkt.
- Host `db.<ref>.supabase.co` (inte `pooler...`).
- **Ingen** `?pgbouncer=true` — direktanslutningen stödjer prepared statements.
- `connection_limit` behövs normalt inte (migrationer kör inte i serverless-loopen).

**När används den:** `prisma migrate deploy` / `prisma db execute` läser `DIRECT_DATABASE_URL`
(via `directUrl` i `schema.prisma`). Runtime-frågor använder `DATABASE_URL` (poolern).

**Verifiera:** samma pull-mönster som ovan; bekräfta port `5432`, host `db.<ref>.supabase.co`,
inget `pgbouncer`. Rör **aldrig** DIRECT när du fixar DATABASE_URL — de är separata rader.

---

## DEMO_MODE

Två lager styr demo:

| Reglage | Var | Effekt |
|---------|-----|--------|
| `NEXT_PUBLIC_DEMO_MODE` | Vercel env (build-time) | Inbakas i klient-bundeln; styr demo-UI (demo-login-knappar etc.) |
| `demo_mode` | DB feature-flag (`FeatureFlag`-tabellen) | Server-side demo-beteende (t.ex. provider-landningsval historiskt) |

- **Build-time:** `NEXT_PUBLIC_DEMO_MODE` bakas in vid build → **rebuild krävs** efter ändring.
- **Staging** kan ha `demo_mode=true` + `NEXT_PUBLIC_DEMO_MODE=true` (det ÄR demomiljön).
- **Production** ska ha `demo_mode=false` (DB-flagga **off**) och `NEXT_PUBLIC_DEMO_MODE=false`.
- **Demo-läge filtrerar ALDRIG data** — det styr synlighet för nav/paths, inte datainnehåll. Se `src/lib/demo-mode.ts`.

> Verifiera prod: `npm run audit:prod-env:safe` ska visa `NEXT_PUBLIC_DEMO_MODE = FALSE`. DB-flaggan
> verifieras mot Supabase (`SELECT enabled FROM "FeatureFlag" WHERE key='demo_mode'`).

---

## PAYMENT_PROVIDER / Stripe

| Läge | `PAYMENT_PROVIDER` | Stripe-vars krävs? |
|------|--------------------|--------------------|
| **Parity (nu)** | `mock` | NEJ |
| Stripe Live (Post-Parity) | `stripe` | JA |

- I **parity** ska prod ha `PAYMENT_PROVIDER=mock`. Då används mock-betalflöde, inga riktiga kort.
- `check-prod-env` kräver `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
  `STRIPE_WEBHOOK_SECRET` **endast** när `PAYMENT_PROVIDER === 'stripe'` (villkorlig `STRIPE_REQUIRED_VARS`).
- **Stripe Live är Post-Parity.** Lägg **inga** live-keys i parity-sprinten.
- Tom flagg-env (`PAYMENT_PROVIDER=""`) tolkas som UNSET → undvik; sätt explicit `mock`.

---

## Copy/paste recipes

> Alla pull-recept använder ett **icke-existerande** filnamn (`/tmp/...-$$`) för att undvika
> `vercel env pull`:s overwrite-prompt, och raderar filen direkt efter. Maskerar alltid lösenord.

### Audit prod
```bash
npm run audit:prod-env:safe
```

### Audit staging
```bash
vercel link --project equinet-staging-app --yes
f="/tmp/staging-audit-$$.env"; rm -f "$f"; vercel env pull --environment=production "$f" >/dev/null 2>&1
grep -E '^(DATABASE_URL|DIRECT_DATABASE_URL|NEXT_PUBLIC_DEMO_MODE|PAYMENT_PROVIDER)=' "$f" | sed -E 's#(://[^:]+:)[^@]+(@)#\1***\2#'
rm -f "$f"; vercel link --project equinet-app --yes
```

### Update prod DATABASE_URL (fixa suffix)
```bash
bash scripts/set-prod-database-url.sh          # dry-run (maskerad före/efter)
bash scripts/set-prod-database-url.sh --go      # delete + create + verifiera
```

### Update staging DATABASE_URL
```bash
# Länka till staging först, kör sedan samma delete+create-mönster (REST API) mot equinet-staging-app.
# Anpassa scriptet eller använd REST API-blocket ovan med staging-projektets PID/TEAM.
vercel link --project equinet-staging-app --yes
# ... delete + create mot target [production] i staging-projektet ...
vercel link --project equinet-app --yes
```

### Set/remove NEXT_PUBLIC_DEMO_MODE
```bash
# Sätt (prod ska vara false). Bekräfta i prompten; "Sensitive?": nej (NEXT_PUBLIC = publik).
vercel env rm NEXT_PUBLIC_DEMO_MODE production --yes
vercel env add NEXT_PUBLIC_DEMO_MODE production      # skriv: false
# Kräver REDEPLOY (build-time-var).
```

### Set PAYMENT_PROVIDER=mock
```bash
vercel env rm PAYMENT_PROVIDER production --yes
vercel env add PAYMENT_PROVIDER production           # skriv: mock
```

### Verify after change
```bash
npm run audit:prod-env:safe        # status
# + byte-verifiera DATABASE_URL maskerat (se DATABASE_URL → Verifiera ovan)
```

### Cleanup audit files
```bash
rm -f /tmp/*-audit-*.env /tmp/db-verify-*.env /tmp/staging-audit-*.env
# Audit-scriptet städar sin egen fil automatiskt; manuella pulls städar du själv.
```

---

## Troubleshooting

| Symptom | Orsak | Åtgärd |
|---------|-------|--------|
| Var blir **tom** efter skrivning | Vercel CLI `env add --value`/stdin-pipe sparar tomt (53.1.1/54.x); UI-paste på sensitive landar inte i fältet | Använd **REST API** (delete+create) eller interaktiv `vercel env add` med manuell paste i prompten. Verifiera alltid efteråt. |
| En ändring slår mot **fel miljö** | Delad env-rad med `target=[production,preview,development]` | Identifiera `target` via REST API **före** delete. Splitta delad rad via UI Edit, inte CLI `rm`. |
| PATCH ger inkonsekvent/tomt | Sensitive/encrypted vars kan inte PATCH:as pålitligt | **Delete + create** istället. |
| `PrismaClientInitializationError` / `Database "postgres&..." does not exist` | DATABASE_URL har `&` istället för `?`, eller saknar `pgbouncer=true` | Fixa suffix → `?pgbouncer=true&connection_limit=1`, redeploy. |
| Migrationer funkar men runtime dör (eller tvärtom) | Pooler- och direct-URL förväxlade | `DATABASE_URL` = pooler `:6543 ?pgbouncer=true`; `DIRECT_DATABASE_URL` = direct `:5432` utan pgbouncer. |
| Ändring syns inte i appen | Build-time-var (`NEXT_PUBLIC_*`) eller env fångad vid build | **Redeploy** (tom commit → branch). |
| `vercel env pull` failar med "Use a different filename" | Filen finns redan (t.ex. `mktemp` för-skapar) → overwrite-prompt non-interaktivt | Använd ett **icke-existerande** filnamn (`/tmp/...-$$`); låt `vercel` skapa det. |
| Smoke-test får 429 "Security Checkpoint" | Vercel **Attack Challenge Mode** / auto-bot-mitigering challengar requests | En riktig browser löser JS-challengen (~6s). För rena smoke-fönster: `vercel firewall attack-mode disable` → smoke → `enable`. `curl` får 429 även med attack-mode av (auto-mitigering på JS-lösa klienter) — förväntat. |

---

## Relaterade dokument

- [production-env-guard-plan.md](../sprints/production-env-guard-plan.md) — Workstream C (env guard) och utfall.
- [staging-environment-setup.md](staging-environment-setup.md) — hur staging-miljön är uppsatt.
- [incident-runbook.md](incident-runbook.md) — generell incidenthantering.
- `scripts/audit-prod-env-safe.mjs` — safe audit-scriptet.
- `scripts/set-prod-database-url.sh` — helper för DATABASE_URL delete+create (dry-run + `--go`).
