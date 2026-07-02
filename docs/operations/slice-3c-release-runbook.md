---
title: "Slice 3c Release Runbook — Prod-lik staging-epic till production"
description: "Reproducerbar release-process för att ta enabler-epiken (prod-lik staging med demo per session) hela vägen till production: sätt IS_LIVE_PRODUCTION=true, merge staging→main, verifiera och rulla tillbaka."
category: operations
status: active
last_updated: 2026-07-02
tags: [release, runbook, staging, production, environment, demo-mode]
depends_on:
  - docs/ideas/epic-prodlik-staging-demo-per-session.md
  - docs/operations/staging-environment-setup.md
related:
  - docs/operations/deployment-verification-guide.md
sections:
  - Kontext
  - Förutsättningar
  - Releaseordning
  - Smoke test
  - Rollback
  - Acceptance criteria
---

# Slice 3c Release Runbook

> Slutsteget i epiken [prod-lik staging med demo per session](../ideas/epic-prodlik-staging-demo-per-session.md).
> Slice 1/2a/2b/3a (kod) och 3b (staging-env) är levererade och verifierade på
> staging. Slice 3c för hela arkitekturen till **production** och stänger den
> latenta prod-läckrisken. **Ingen kodändring** ingår — Slice 3c är env + merge.

## Kontext

- **Prod** (`equinet-app`, `prj_HKujmIYaLJopCS3VjJGDckM8riFB`) deployar `main`.
- **Staging** (`equinet-staging-app`, `prj_KKtKkiDRWp3OX67A52iUHuk3UoF4`) deployar `staging`.
- Prod kör idag **gamla koden** (säkerhets-call-sites på `isDemoMode()` = false på
  prod → riktiga mejl/push, indexerbar; demo-entré på `isDemoMode` → inga
  demo-knappar).
- Efter merge kör prod **nya koden**: säkerhet **och** demo-entré styrs av
  `isStagingSafe()` = `process.env.IS_LIVE_PRODUCTION !== "true"`.

### Varför ordningen är kritisk

`IS_LIVE_PRODUCTION=true` **måste vara satt på prod innan den nya deployen serverar
trafik**. Annars blir `isStagingSafe()=true` på prod →

- mejl/push **blockeras**,
- `robots.txt` blir `Disallow: /` (**icke-indexerbar**),
- **demo-knappar läcker ut på production**.

Fail-safe-designen gör felet "för säkert" (aldrig osäkert), men det är ändå en
synlig prod-regression. `IS_LIVE_PRODUCTION` läses **runtime** (server-side, ej
`NEXT_PUBLIC_*`), så den tar effekt direkt på nya deployen utan ombygge — men bara
om den redan är satt när deployen går live.

## Förutsättningar

Bocka av **alla** innan release startas:

- [ ] **Slice 1, 2a, 2b, 3a klara** och mergade till `staging` (kod-artefakter:
      `src/lib/environment.ts`, `demo-session.ts`, `demo-session-server.ts`,
      `DemoSessionProvider.tsx`, `StagingSafeProvider.tsx`).
- [ ] **Slice 3b klar** — `NEXT_PUBLIC_DEMO_MODE=false` på staging, verifierad.
- [ ] **Staging verifierad live:** vanlig login prod-lik utan demo-session;
      demo-knappar (leverantör + kund) sätter demo-session; logout rensar; Slice
      1-guard grön (`robots.txt = Disallow: /`).
- [ ] **Inga öppna blockerande PR:er** (`gh pr list --state open`).
- [ ] **Inga schema-/migrationsändringar** i `staging→main`-diffen
      (`git diff --stat origin/main...origin/staging -- prisma/` tomt) → ingen
      prod-DB-migration.
- [ ] **Prod `NEXT_PUBLIC_DEMO_MODE=false`** bekräftad via
      `vercel env pull --environment=production` (värdet är lagrat *encrypted* och
      kan inte läsas via REST-GET).
- [ ] Känd merge-konflikt: **`docs/sprints/backlog.md`** (docs-only, båda grenarna
      la till rader). Övriga filer auto-mergar (inkl. `package.json`/`-lock.json`
      och `.husky/*`). Inga kod-konflikter.

## Releaseordning

Kör stegen **i denna ordning**. Hoppa inte över env-verifieringen.

### 1. Sätt production-env FÖRST

Sätt `IS_LIVE_PRODUCTION=true` på `equinet-app`, target **production**, via Vercel
REST API (per MEMORY-gotchor: använd REST API, `type:"plain"` för config — inte
UI/CLI-skrivning). Skriv **aldrig** ut token.

```bash
# token laddas från .env.local utan att echo:as
export VERCEL_API_TOKEN=$(grep -E "^VERCEL_API_TOKEN=" .env.local | cut -d= -f2- | tr -d '"')
TEAM="team_j5goSqV46IZBWc3kfbUfqwas"; PROD="prj_HKujmIYaLJopCS3VjJGDckM8riFB"
curl -s -X POST -H "Authorization: Bearer $VERCEL_API_TOKEN" -H "Content-Type: application/json" \
  "https://api.vercel.com/v10/projects/$PROD/env?teamId=$TEAM" \
  -d '{"key":"IS_LIVE_PRODUCTION","value":"true","type":"plain","target":["production"]}'
```

### 2. Verifiera env (obligatoriskt)

```bash
vercel env pull .env.prodcheck --environment=production --token "$VERCEL_API_TOKEN" --yes
grep -E "^IS_LIVE_PRODUCTION=" .env.prodcheck        # → "true"
grep -E "^NEXT_PUBLIC_DEMO_MODE=" .env.prodcheck     # → "false"
rm -f .env.prodcheck                                  # innehåller secrets — radera
```

Dubbelkolla med REST-GET (`.../env?decrypt=true`) att `IS_LIVE_PRODUCTION`
existerar med värde `true` på target `production`. **Rör inte** andra prod-vars.

### 3. Merge staging → main

- Skapa release-PR `staging` → `main`.
- **Lös `docs/sprints/backlog.md`-konflikten** (behåll båda sidors rader).
- Vänta in **full CI inkl. tunga E2E/Offline-jobb** (körs bara mot `main`).

### 4. Invänta production deploy

Merge till `main` → `equinet-app` auto-deployar `main`. Vänta tills deployen är
**READY** (Vercel MCP `get_deployment` eller dashboard). `IS_LIVE_PRODUCTION` är
redan satt (steg 1) → `isStagingSafe()=false` från första requesten.

### 5. Production smoke test

Kör smoke-testet nedan. Prod har bot-skydd (Vercel Security Checkpoint) → använd
browser-automation (Playwright), inte `curl`, för sidladdningar.

## Smoke test

| # | Kontroll | Förväntat |
|---|----------|-----------|
| 1 | **Startsida** (`/`) laddar | Normal hero/CTA; **inga** demo-persona-kort |
| 2 | **Login** (`/login`) | Formulär + register/glömt; **inga** demo-knappar |
| 3 | **Provider calendar** (login som riktig provider → `/provider/calendar`) | Full prod-arbetsyta laddar; ingen `equinet-demo`-cookie |
| 4 | **Demo-knappar dolda i prod** | `isStagingSafe()=false` → varken login- eller landnings-demo-knappar renderas |
| 5 | **Email fungerar** | `isStagingSafe()=false` → mejl **blockeras inte** (verifiera via icke-destruktiv trigger, t.ex. en testadress du äger, eller Sentry/leverantörslogg — spamma **inte** riktiga kunder) |
| 6 | **Push fungerar** | Push till APNs **blockeras inte** (verifiera via egen testenhet eller logg) |
| 7 | **robots korrekt** | `robots.txt` = **indexerbar** (`Allow: /` med disallow på `/api/`, `/admin/`, `/provider/`, `/stable/`), **inte** `Disallow: /` |
| 8 | **Native delete fungerar** | `DELETE /api/native/customers/[id]` utför **riktig** radering (inte no-op/403 pga safe-läge) — verifiera med en egen testkund, inte riktig kunddata |

> Punkt 7 är proxy-signalen: `robots.txt` indexerbar ⇔ `isStagingSafe()=false` ⇔
> alla fyra säkerhets-call-sites är i live-läge (mejl/push/native-delete aktiva).
> Bekräftar 5/6/8 utan att behöva trigga riktiga sidoeffekter brett.

## Rollback

Prioritetsordning — snabbast först:

1. **Vercel Instant Rollback** (`equinet-app` → föregående prod-deploy). Återställer
   omedelbart till gamla koden, oavsett env. Förstahandsval vid akut regression.
2. **Env-rollback:** ta bort eller `false`-sätt `IS_LIVE_PRODUCTION` via REST API +
   verifiera med `vercel env pull`. Effekt: nya koden blir "för säker" (blockerar
   mejl/push, icke-indexerbar) — **synligt och ofarligt, aldrig osäkert**. Använd
   om koden ska vara kvar men signalen är fel.
3. **Kod-revert:** revert av release-mergen på `main` → prod bygger om gamla koden.
   Långsammast; använd för permanent återställning.

### Varför ingen DB-rollback behövs

`staging→main`-diffen innehåller **inga** `prisma/`-schema- eller
migrationsändringar. Releasen ändrar bara kod-beteende (env-styrning) och en
runtime-env-var — ingen databasmigration, inga data-ändringar. Därför krävs ingen
DB-rollback och ingen migrations-de-deploy.

## Acceptance criteria

Releasen är **godkänd** när **alla** stämmer:

- [ ] `IS_LIVE_PRODUCTION=true` satt på prod (target production) och verifierad via
      `vercel env pull` + REST-GET.
- [ ] `staging→main` mergad (backlog-konflikt löst), full CI grön inkl. E2E.
- [ ] Prod-deploy READY.
- [ ] Smoke test 1–8 gröna.
- [ ] **Prod indexerbar** (`robots.txt` ≠ `Disallow: /`) — bekräftar att
      säkerhets-guards är i live-läge.
- [ ] **Inga demo-knappar** på prod (login + landning).
- [ ] Vanlig prod-login sätter **ingen** demo-session-cookie.
- [ ] Inga nya errors i Vercel/Sentry jämfört med föregående prod-deploy.
- [ ] Epiken uppdaterad: Slice 3c KLAR, status `active` → (epiken kan markeras
      slutförd).
