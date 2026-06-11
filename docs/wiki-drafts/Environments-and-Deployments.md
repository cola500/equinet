---
title: "Wiki: Environments and Deployments"
description: "Draft för GitHub Wiki-sidan om miljöer och deploy -- lokal/staging/prod-matris, deploy-ordning och de viktigaste fällorna. Frontmattern strippas vid publicering."
category: guide
status: draft
last_updated: 2026-06-11
tags: [wiki, environments, deployment, vercel, supabase]
related:
  - docs/operations/environments.md
  - docs/operations/deployment.md
  - docs/wiki-drafts/wiki-structure-proposal.md
sections:
  - Miljömatris
  - Lokal utveckling
  - Staging
  - Produktion
  - Deploy-ordning vid schemaändring
  - Env-variabler
  - Fällor
---

# Environments and Deployments

> Source of truth: [`docs/operations/environments.md`](https://github.com/cola500/equinet/blob/main/docs/operations/environments.md) (miljömatris),
> [`docs/operations/deployment.md`](https://github.com/cola500/equinet/blob/main/docs/operations/deployment.md) (deploy-guide),
> [`docs/operations/staging-environment-setup.md`](https://github.com/cola500/equinet/blob/main/docs/operations/staging-environment-setup.md) (staging-topologi).

## Miljömatris

| | Lokal | Staging | Produktion |
|--|-------|---------|------------|
| **URL** | `localhost:3000` | `equinet-staging.johanlindengard.com` | `equinet.johanlindengard.com` |
| **Vercel-projekt** | -- | `equinet-staging-app` | `equinet-app` |
| **Supabase** | Lokal CLI (`127.0.0.1:54321`) | `zzdamokfeenencuggjjp` (Frankfurt) | `xybyzflfxnqqyxnvjklv` (Zürich) |
| **Deploy** | `npm run dev` | Push till `staging`-branch | Push till `main`-branch |
| **Demo-läge** | Valfritt (`NEXT_PUBLIC_DEMO_MODE`) | **På** | Av |
| **Crons** | -- | **Avstängda** (`DISABLE_CRONS=true`) | På (`CRON_SECRET`) |
| **Betalning** | Mock | Stripe test-mode | Stripe (live väntar på företagsverifiering) |

Tre helt isolerade miljöer: egna Vercel-projekt, egna Supabase-projekt, egna databaser
och egna env-namespaces. Undantag: Upstash Redis delas mellan staging och prod (free tier).

## Lokal utveckling

- `npm run db:up` startar lokal Supabase-stack. DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- Utan externa nycklar degraderar tjänster snällt: e-post loggas till konsol, rate limiting kör in-memory, betalning är mock.
- `npm run env:status` visar vilken databas som är aktiv -- kör den om något känns fel.

## Staging

- Bygger **endast** `staging`-branchen. En CANCELED feature-branch-preview på staging-projektet är förväntat ("Ignored Build Step").
- staging == demomiljön. Demo-UX kan **inte** valideras i `equinet-app`-previews (demo-läget är inte aktivt där). Se [deployment-verification-guide.md](https://github.com/cola500/equinet/blob/main/docs/operations/deployment-verification-guide.md).
- Deploy: `git checkout staging && git merge main && git push origin staging` (~3 min).
- Egen demo-data (Erik Järnfot-personan) -- ingen prod-data. Se [[Demo Data and Seed]].

## Produktion

- Vercel-region `fra1` -- **måste** matcha Supabase-regionen (konfigurerat i `vercel.json`).
- `DATABASE_URL` går via PgBouncer med `connection_limit=1` (serverless-krav); `DIRECT_DATABASE_URL` används av migrationer.
- Deploy-kommandot `npm run deploy` kör kvalitetscheckar + drift-check + påminnelse om Supabase-migration före push.
- Monitorering: Sentry (fel) + Betterstack (uptime). Se [[Operations Runbooks]].

## Deploy-ordning vid schemaändring

**Migrationer appliceras INNAN deployen når trafik** -- saknade migrationer ger 500-fel i prod:

```
1. Committa + push (startar Vercel-build)
2. Applicera migration mot Supabase  (npm run migrate:status för läget)
3. Verifiera i Vercel Dashboard
```

Detaljer och migrate-kommandon: [[Database and Migrations]] samt [`.claude/rules/prisma.md`](https://github.com/cola500/equinet/blob/main/.claude/rules/prisma.md).

## Env-variabler

- Alla variabler med syfte och lokala defaults: [`.env.example`](https://github.com/cola500/equinet/blob/main/.env.example).
- Ändringar i Vercel-env görs enligt [environment-runbook.md](https://github.com/cola500/equinet/blob/main/docs/operations/environment-runbook.md) -- **via REST API, inte CLI/UI** (kända Vercel-buggar sparar tomma värden tyst).
- Verifiera ALLTID med `vercel env pull --environment=production` efter en skrivning.
- Pre-build-guarden (`scripts/check-prod-env.ts`) stoppar prod-deploy om kritiska vars saknas eller `DISABLE_CRONS=true` läckt in.

## Fällor

- **`.env.local` trumfar `.env`** -- `vercel env pull` lägger remote-credentials där. ([gotchas #23](https://github.com/cola500/equinet/blob/main/docs/guides/gotchas.md))
- **Vercel env-CLI/UI sparar tomt tyst** -- tom flagga tolkas som `false`. Använd runbookens REST-recept.
- **NODE_ENV är opålitlig på Vercel** -- använd explicita flaggor (`ALLOW_TEST_ENDPOINTS` etc).
- **In-memory state överlever inte mellan requests** (serverless) -- delad state kräver Redis.
- Incidenthantering: [incident-runbook.md](https://github.com/cola500/equinet/blob/main/docs/operations/incident-runbook.md).
