---
title: "Vercel-token-synk och produktionsdeploy"
description: "Driftinstruktion för scripts/sync-vercel-token.sh och scripts/deploy-production.sh -- säker väg runt att Vercel-kontot inte kan skapa fristående Personal Access Tokens"
category: operations
tags: [deployment, vercel, github-actions, secrets, ci-cd]
status: active
last_updated: 2026-09-26
related:
  - docs/operations/deployment.md
  - docs/archive/handoff-production-deploy-gate.md
sections:
  - "Bakgrund"
  - "Token-synk: scripts/sync-vercel-token.sh"
  - "Produktionsdeploy: scripts/deploy-production.sh"
  - "Personligt konto -- vad det betyder"
  - "Migrera till en separat CI-identitet"
  - "Rollback"
---

# Vercel-token-synk och produktionsdeploy

## Bakgrund

`deploy-production`-jobbet i `.github/workflows/quality-gates.yml` kräver en `VERCEL_TOKEN`-secret för att kunna köra `vercel pull` / `vercel build` / `vercel deploy` mot `equinet-app`. Att skapa en fristående, projekt-scopad Personal Access Token via `vercel tokens add` gav `Error: Cannot create tokens for this app. (403)` -- kontot är inloggat via SSO/OAuth, vilket den typen av inloggning inte tillåter att skapa nya fristående tokens för.

Lösningen: återanvänd token ur den redan inloggade Vercel CLI-sessionens `auth.json`, precis som `scripts/lib/vercel-env-lib.sh` redan gör lokalt för env-scripten. `scripts/sync-vercel-token.sh` gör samma sak fast skriver värdet till GitHub Actions-secreten `VERCEL_TOKEN` istället för att bara läsa det lokalt.

## Token-synk: scripts/sync-vercel-token.sh

```bash
# Se planen utan att skriva något:
bash scripts/sync-vercel-token.sh --dry-run

# Skriv secreten på riktigt:
bash scripts/sync-vercel-token.sh
```

Kontrollerar i tur och ordning: att `auth.json` finns, att `vercel whoami` fungerar, att `gh auth status` fungerar, att `gh` pekar på exakt `cola500/equinet`, och att token-fältet faktiskt innehåller ett värde -- innan något skrivs. Token skickas till `gh secret set` via stdin (aldrig som kommandoradsargument, aldrig till en temp-fil). Skriv aldrig `set -x` i detta script eller kör det med `bash -x` -- det skulle skriva ut token i klartext.

Kör detta när:
- `deploy-production`-jobbet failar på `vercel pull` med `Could not retrieve Project Settings`.
- Du loggat ut och in igen i Vercel CLI (`vercel login`) -- din gamla session i GitHub är då ogiltig.

## Produktionsdeploy: scripts/deploy-production.sh

```bash
# Se planen (SHA, commit, vilken körning som skulle triggas om) utan att göra något:
bash scripts/deploy-production.sh --dry-run

# Trigga på riktigt (kräver att du skriver en exakt bekräftelsefras):
bash scripts/deploy-production.sh
```

Kontrollerar: ren arbetskatalog, att du står på `main`, att lokal `main` matchar `origin/main` exakt, att `gh` pekar på `cola500/equinet`, och att en avslutad `quality-gates`-körning finns för den SHA:n. Hittar den körningen och kör om `Deploy to Production`-jobbet (`gh run rerun --failed`) -- INTE hela test-sviten igen. Om jobbet redan lyckats för den SHA:n gör scriptet ingenting (exit 0, ingen omkörning).

Scriptet rör aldrig `VERCEL_TOKEN` eller någon annan hemlighet -- själva deployen körs av GitHub Actions med sin egen lagrade secret. Detta script triggar och bevakar bara den körningen.

## Personligt konto -- vad det betyder

`VERCEL_TOKEN` är just nu Johans personliga, inloggade Vercel-sessions token -- inte en fristående, av kontot oberoende CI-identitet. Praktiskt innebär det:

- **Om Johan loggar ut** (`vercel logout`) eller Vercel av någon anledning ogiltigförklarar sessionen, slutar `deploy-production` fungera igen med samma `Could not retrieve Project Settings`-fel. Kör `scripts/sync-vercel-token.sh` igen efter en ny `vercel login`.
- Token har Johans fulla kontobehörighet, inte begränsad till `equinet-app`-projektet (till skillnad från en `--project`-scopad PAT, som kontot just nu inte tillåter skapa).
- Det här är en medveten, dokumenterad avvägning -- inte en glömd uppgift. Se `docs/archive/handoff-production-deploy-gate.md` för den ursprungliga utredningen.

## Migrera till en separat CI-identitet

När det finns tid, är den robusta lösningen ett dedikerat Vercel-konto/-integration för CI (t.ex. en Vercel-integration via GitHubs egen App-mekanism, eller en teammedlem inbjuden specifikt för CI-ändamål vars konto tillåter `vercel tokens add --project`). Tills dess är session-token-återanvändning en medveten, fungerande kompromiss -- inte teknisk skuld som blockerar något.

## Rollback

Ingen av dessa två script gör någon databasändring eller rör produktionens Vercel-alias direkt.

- **Om `deploy-production.sh` triggat en deploy som visar sig trasig:** rulla tillbaka Vercel-aliaset till föregående kända goda deployment (`vercel rollback` eller `vercel promote <tidigare-deployment-url>` mot `equinet-app`), inte via dessa script.
- **Om `sync-vercel-token.sh` skrivit en trasig token:** kör det igen efter en ny `vercel login` -- det skriver alltid om hela secreten (delete+create sker atomiskt av GitHubs eget API), det finns inget separat "återställ"-steg.
