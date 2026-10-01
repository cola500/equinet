---
title: "Vercel-token-synk och produktionsdeploy"
description: "Driftinstruktion för scripts/sync-vercel-token.sh och scripts/deploy-production.sh -- säker väg runt att Vercel-kontot inte kan skapa fristående Personal Access Tokens"
category: operations
tags: [deployment, vercel, github-actions, secrets, ci-cd]
status: active
last_updated: 2026-10-01
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

Produktionsdeploy sker i workflowet `.github/workflows/deploy-production.yml` (manuellt `workflow_dispatch`, jobben `validate` och `deploy`). `deploy`-jobbet kräver en `VERCEL_TOKEN`-secret för att kunna köra `vercel pull` / `vercel build` / `vercel deploy` mot `equinet-app`. (Det tidigare push-triggade `deploy-production`-jobbet i `quality-gates.yml` är borttaget och ersattes 2026-09-28, se avsnittet om produktionsdeploy nedan.) Att skapa en fristående, projekt-scopad Personal Access Token via `vercel tokens add` gav `Error: Cannot create tokens for this app. (403)` -- kontot är inloggat via SSO/OAuth, vilket den typen av inloggning inte tillåter att skapa nya fristående tokens för.

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
- `deploy`-jobbet i `deploy-production.yml` (eller en `dry_run`-körning) failar på `vercel pull` med `Could not retrieve Project Settings`.
- Du loggat ut och in igen i Vercel CLI (`vercel login`) -- din gamla session i GitHub är då ogiltig.

## Produktionsdeploy: scripts/deploy-production.sh

**2026-09-28: omarbetad till `workflow_dispatch`.** Produktionsdeploy är inte längre kopplad till push/merge till `main` -- den enda vägen till produktion är `.github/workflows/deploy-production.yml`, som ENDAST triggas av `workflow_dispatch` med en obligatorisk `sha`-input. Ingen vanlig PR-merge, Dependabot-merge, tagg eller GitHub Release kan starta en produktionsdeploy. Fullständig säkerhetsmodell i kommentarerna högst upp i `.github/workflows/deploy-production.yml`; sammanfattning nedan.

```bash
# Se planen (SHA, commit, vilket workflow_dispatch-anrop som skulle göras) utan att göra något:
bash scripts/deploy-production.sh --dry-run --staging-verified-sha <sha>

# Trigga på riktigt (kräver att du skriver en exakt bekräftelsefras):
bash scripts/deploy-production.sh --staging-verified-sha <sha>

# Om staging-SHA:n avviker från main-SHA:n (dokumenterat undantag):
bash scripts/deploy-production.sh --staging-verified-sha <sha> --override-reason "<motivering>"
```

`--staging-verified-sha` är obligatorisk -- den SHA du personligen verifierade som god på staging. Det finns idag ingen maskinläsbar "senast staging-godkänd"-markering (planerat framtida arbete), så detta är en attesterad, inte oberoende bevisad, kontroll: scriptet och workflowet jämför den bara mot SHA:n som ska deployas och kräver `--override-reason` vid avvikelse.

Kontrollerar lokalt: ren arbetskatalog, att du står på `main`, att lokal `main` matchar `origin/main` exakt, att `gh` pekar på `cola500/equinet`, och att staging-verifieringen är ifylld/matchar. Dispatchar sedan `deploy-production.yml` (`gh workflow run ... -f sha=... -f dry_run=false`) och bevakar den nya körningen. Workflowet gör sina EGNA, oberoende kontroller server-side (SHA på skyddad `main`, grön `Quality Gate Passed`, staging-match) -- scriptet kan inte kringgå dem.

Scriptet rör aldrig `VERCEL_TOKEN` eller någon annan hemlighet -- själva deployen körs av GitHub Actions med sin egen lagrade secret. Detta script dispatchar och bevakar bara den körningen.

**Testa workflowets valideringslogik OCH att VERCEL_TOKEN fungerar, utan att deploya på riktigt:** workflowet har en egen `dry_run`-input (default `true`) som kör hela valideringen samt `vercel pull` och `vercel build` på riktigt (ingen av dem muterar något i Vercel) -- bara själva `vercel deploy`-steget och health-checken hoppas över. Det gör `dry_run` till rätt sätt att verifiera en tokenrotation: om `vercel pull` misslyckas ser du exakt samma felmeddelande som i produktionsjobbet, utan att något deployats. Trigga direkt via `gh workflow run deploy-production.yml -f sha=<sha> -f staging_verified_sha=<sha>` (utan `-f dry_run=false`). `deploy-production.sh` skickar alltid `dry_run=false` när den dispatchar, eftersom en riktig körning via scriptet redan passerat den interaktiva bekräftelsefrasen.

## Personligt konto -- vad det betyder

`VERCEL_TOKEN` är just nu Johans personliga, inloggade Vercel-sessions token -- inte en fristående, av kontot oberoende CI-identitet. Praktiskt innebär det:

- **Om Johan loggar ut** (`vercel logout`) eller Vercel av någon anledning ogiltigförklarar sessionen, slutar `deploy-production.yml` fungera igen med samma `Could not retrieve Project Settings`-fel. Kör `scripts/sync-vercel-token.sh` igen efter en ny `vercel login`.
- Token har Johans fulla kontobehörighet, inte begränsad till `equinet-app`-projektet (till skillnad från en `--project`-scopad PAT, som kontot just nu inte tillåter skapa).
- Det här är en medveten, dokumenterad avvägning -- inte en glömd uppgift. Se `docs/archive/handoff-production-deploy-gate.md` för den ursprungliga utredningen (arkiverad och obsolet sedan 2026-10-01; den beskriver den tidigare designen med jobb i `quality-gates.yml`).

## Migrera till en separat CI-identitet

När det finns tid, är den robusta lösningen ett dedikerat Vercel-konto/-integration för CI (t.ex. en Vercel-integration via GitHubs egen App-mekanism, eller en teammedlem inbjuden specifikt för CI-ändamål vars konto tillåter `vercel tokens add --project`). Tills dess är session-token-återanvändning en medveten, fungerande kompromiss -- inte teknisk skuld som blockerar något.

## Rollback

Ingen av dessa två script gör någon databasändring eller rör produktionens Vercel-alias direkt.

- **Om `deploy-production.sh` triggat en deploy som visar sig trasig:** rulla tillbaka Vercel-aliaset till föregående kända goda deployment (`vercel rollback` eller `vercel promote <tidigare-deployment-url>` mot `equinet-app`), inte via dessa script.
- **Om `sync-vercel-token.sh` skrivit en trasig token:** kör det igen efter en ny `vercel login` -- det skriver alltid om hela secreten (delete+create sker atomiskt av GitHubs eget API), det finns inget separat "återställ"-steg.
