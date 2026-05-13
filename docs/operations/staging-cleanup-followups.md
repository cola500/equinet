---
title: "Staging cleanup follow-ups efter Sprint 67"
description: "S67-8 done 2026-05-09. Övriga cleanup-uppgifter kvarstår: legacy custom-domain, pre-build-guard tomma värden, Sentry-separation, cron empirisk verifiering."
category: operations
status: active
last_updated: 2026-05-09
tags: [sprint-67, vercel, staging, cleanup, follow-up, done]
related:
  - ../sprints/sprint-67-ios-staging-capability.md
sections:
  - Bakgrund
  - S67-8 Begränsa korsdeploys (DONE 2026-05-09)
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

## S67-8 Begränsa korsdeploys (DONE 2026-05-09)

### Status: ✅ KLAR

Ignored Build Step satt i båda Vercel-projekten 2026-05-09. Symmetrisk lösning — varje projekt bygger bara sin avsedda branch.

### Vad som upptäcktes under S67-8

S67-8 var ursprungligen formulerat som ensidig fix på `equinet-app`. Efter main-push 2026-05-09 visade det sig att korsdeploys gick åt **båda hållen**:

- `staging`-push → `equinet-app` Preview byggde (overhead)
- `main`-push → `equinet-staging-app` Preview byggde och **failade** med `PrismaConfigEnvError: Missing required environment variable: DATABASE_URL` (Sprint 67 Batch 1 satte env-vars med target=["production"] only, så Preview-target i staging-projektet hade inga DB-credentials)

Symmetrisk lösning krävdes — Ignored Build Step på båda projekten.

### Implementerad konfig

Båda projekten i `https://vercel.com/cola500s-projects/<projekt>/settings/git` → **Ignored Build Step**:

**`equinet-staging-app`** (bygger BARA staging-branchen):
```bash
if [ "$VERCEL_GIT_COMMIT_REF" = "staging" ]; then exit 1; fi; exit 0
```

**`equinet-app`** (skippar staging-branchen, bygger allt annat):
```bash
if [ "$VERCEL_GIT_COMMIT_REF" = "staging" ]; then exit 0; fi; exit 1
```

(`exit 0` = skip build, `exit 1` = build)

**Bash-syntax-detalj:** `;` mellan `fi` och `exit` är obligatoriskt. Spaces eller newlines via UI-paste sparas som spaces, vilket ger syntax error → Vercel exit 2 → tolkas som "build" (skip-flagga off). Verifiera alltid via `bash -n -c "<snippet>"` lokalt eller via `commandForIgnoringBuildStep`-fältet i Vercel REST API.

### Effekt

| Scenario | Före | Efter |
|---|---|---|
| Push till `main` → `equinet-staging-app` Preview | ❌ Error (DATABASE_URL missing) | ✅ Skipped |
| Push till `staging` → `equinet-app` Preview | Ready (overhead) | ✅ Skipped |
| Push till `main` → `equinet-app` Production | ✅ Ready | ✅ Ready (oförändrat) |
| Push till `staging` → `equinet-staging-app` Production | ✅ Ready | ✅ Ready (oförändrat) |
| Feature-branch PR → `equinet-app` Preview | Ready | ✅ Ready (oförändrat — PR-previews bevarade) |
| Feature-branch PR → `equinet-staging-app` Preview | Ready | ✅ Skipped (staging-projektet är dedikerat) |

### Verifiering 2026-05-09

API-check via `vercel-token`:

```
=== equinet-app ===
commandForIgnoringBuildStep: 'if [ "$VERCEL_GIT_COMMIT_REF" = "staging" ]; then exit 0; fi; exit 1'
Bash syntax: OK
branch=staging → exit 0 (SKIP) ✅
branch=main    → exit 1 (BUILD) ✅

=== equinet-staging-app ===
commandForIgnoringBuildStep: 'if [ "$VERCEL_GIT_COMMIT_REF" = "staging" ]; then exit 1; fi; exit 0'
Bash syntax: OK
branch=staging → exit 1 (BUILD) ✅
branch=main    → exit 0 (SKIP) ✅
```

### Rollback (om problem)

Ta bort `Ignored Build Step` i båda projekten via UI → tom string sparar = återgå till default (alla branches deployar).

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
