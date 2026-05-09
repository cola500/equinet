---
title: "Staging cleanup follow-ups efter Sprint 67"
description: "S67-8 + andra cleanup-uppgifter som inte avslutades inom Sprint 67. Manuell action i Vercel UI krävs."
category: operations
status: active
last_updated: 2026-05-09
tags: [sprint-67, vercel, staging, cleanup, follow-up]
related:
  - ../sprints/sprint-67-ios-staging-capability.md
sections:
  - Bakgrund
  - S67-8 Begränsa staging-deploys i equinet-app
  - Hur det görs
  - Andra cleanup-uppgifter
---

# Staging cleanup follow-ups efter Sprint 67

## Bakgrund

Efter Sprint 67 DNS-flytt (S67-5) pekar `equinet-staging.johanlindengard.com` på `equinet-staging-app` som production-custom-domain. **Men** `equinet-app` deployar fortfarande `staging`-branchen som preview varje gång den pushas, vilket ger:

- 2 deploys per `staging`-push (en på varje projekt)
- ~2-5 min extra build-tid per push
- Vercel-resources-användning
- Förvirrande "Latest Preview" i `equinet-app`-vyn

Custom-domänen är inte längre kopplad till equinet-app:s preview — så funktionellt fungerar det. Men det är onödigt dubbelarbete.

## S67-8 Begränsa staging-deploys i equinet-app

### Mål

`equinet-app` (prod-projektet) ska INTE bygga eller deploya `staging`-branchen alls. Push till `staging` ska bara trigga deploy i `equinet-staging-app` som production.

### Varför inte automatiskt löst via vercel.json

`vercel.json` ligger i samma branch (i.e. samma fil för båda projekten på `staging`-branchen). Att sätta `git.deploymentEnabled: { "staging": false }` skulle blocka **båda** projekten — inkl. `equinet-staging-app` som har `staging` som production-branch. Detta skulle döda staging helt.

### Hur det görs (manuell UI-action)

1. Öppna `https://vercel.com/cola500s-projects/equinet-app/settings/git`
2. Hitta sektionen **Ignored Build Step** eller **Production Branch + Branch Tracking**
3. Sätt en av följande:
   - **Ignored Build Step** (CLI-formel):
     ```bash
     if [ "$VERCEL_GIT_COMMIT_REF" = "staging" ]; then exit 0; fi
     exit 1
     ```
     (`exit 0` = skippa build, `exit 1` = build)
   - ELLER **Branch Tracking** → välj "Only specified branches" och uteslut `staging`

4. Spara
5. Verifiera vid nästa `staging`-push: bara `equinet-staging-app` får ny deploy

### Verifiering

```bash
# Push en docs-only commit till staging
git commit --allow-empty -m "test: verify only equinet-staging-app deploys"
git push origin staging

# Vänta 2 min, kolla deployments
vercel list equinet-app | head -5            # Ska INTE visa ny deploy
vercel list equinet-staging-app | head -5    # SKA visa ny deploy (Ready efter ~2 min)
```

### Rollback

Ta bort Ignored Build Step / återställ Branch Tracking i UI.

## Andra cleanup-uppgifter

### `equinet-app-test.johanlindengard.com` (legacy custom-domain)

Per sprint-67-doc Out of Scope: legacy custom domain finns kvar i `equinet-app`. Inte demo-blocker.

**Action:** Ta bort domain via Vercel UI när det blir aktuellt. Inte tidskritiskt.

### Pre-build-guard utöka för tomma värden

Per memory project_staging_environment_block_2.md: `scripts/check-prod-env.ts` (S64-4) avvisar saknade vars men inte tomma strängar. Båda dagens incidenter (DATABASE_URL + APP_URL Production tomma) skulle ha fångats med non-empty-check.

**Action:** Lägg till non-empty-check i `checkProdEnv()`. Liten kodändring + test.

### Sentry-projekt-separation

Per sprint-67-doc Out of Scope. Idag loggar staging till samma Sentry-projekt som prod. Kan bli bullrigt.

**Action:** Skapa separat Sentry-projekt för staging när det blir relevant. Sätt `NEXT_PUBLIC_SENTRY_DSN` per miljö.

### Cron disable-guard fysiskt verifiera

`DISABLE_CRONS=true` i staging gör att cron-routes returnerar tidigt. Men har det testats empiriskt att Vercel Crons-tab är tom eller inaktiv i staging-projektet?

**Action:** Verifiera via Vercel UI Crons-tab i `equinet-staging-app` att inga cron-jobb är aktiva, alternativt att cron-route-handlers loggar early-return vid invocation.
