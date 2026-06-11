---
title: "Wiki: Developer Onboarding"
description: "Draft för GitHub Wiki-sidan Developer Onboarding -- lokal miljö igång på ~15 minuter. Frontmattern strippas vid publicering."
category: guide
status: draft
last_updated: 2026-06-11
tags: [wiki, onboarding, setup]
related:
  - docs/guides/onboarding.md
  - docs/wiki-drafts/wiki-structure-proposal.md
sections:
  - Förutsättningar
  - Kom igång på 15 minuter
  - Testanvändare
  - Vardagskommandon
  - Konventioner du måste känna till
  - Vanliga nybörjarfällor
  - Nästa steg
---

# Developer Onboarding

> Source of truth: [`README.md`](https://github.com/cola500/equinet/blob/main/README.md) (setup & kommandon)
> och [`CLAUDE.md`](https://github.com/cola500/equinet/blob/main/CLAUDE.md) (arbetssätt).
> Den här sidan är snabbvägen -- detaljerna bor där.

## Förutsättningar

| Verktyg | Anteckning |
|---------|------------|
| Node.js 20+ och npm | |
| Docker Desktop | Krävs av Supabase CLI:s lokala stack |
| Supabase CLI | `brew install supabase/tap/supabase` |
| Git | |

## Kom igång på 15 minuter

```bash
# 1. Klona och installera (postinstall kör prisma generate)
git clone https://github.com/cola500/equinet.git
cd equinet
npm install

# 2. Miljövariabler -- defaults pekar på lokal Supabase
cp .env.example .env

# 3. Starta lokal Supabase-stack + migrera + seeda
npm run db:up          # supabase start (Postgres på 127.0.0.1:54322)
npm run setup          # migrationer + auth-triggers
npm run db:seed        # testdata

# 4. Dev-server
npm run dev            # http://localhost:3000

# 5. Verifiera att allt är grönt
npm run check:all      # typecheck + unit-tester + lint + svenska-check
```

Lokal databas är **Supabase CLI** (inte ren Docker Compose) -- du får Postgres,
Auth och Studio lokalt. `npm run env:status` visar vilken databas som är aktiv.

## Testanvändare

Efter `npm run db:seed`:

| Roll | E-post | Lösenord |
|------|--------|----------|
| Kund | `test@example.com` | `TestPassword123!` |
| Leverantör | `provider@example.com` | `ProviderPass123!` |

Demo-personas (Erik Järnfot m.fl.) seedas separat -- se [[Demo Data and Seed]].

## Vardagskommandon

| Kommando | Vad |
|----------|-----|
| `npm run dev` | Dev-server (Service Worker avstängd) |
| `npm run db:studio` | Prisma Studio, databas-UI på port 5555 |
| `npm test` / `npm run test:run` | Unit-tester (watch / en gång) |
| `npm run test:e2e:smoke` | Snabb E2E-smoke (login + baseline) |
| `npm run typecheck` | TypeScript -- använd INTE `npx tsc --noEmit` (OOM-risk) |
| `npm run check:all` | Alla 4 kvalitetsgates -- måste vara grön före PR |
| `npm run db:reset` / `db:nuke` | Återställ databasen |

Fler scripts: [`package.json`](https://github.com/cola500/equinet/blob/main/package.json) och README § Viktiga Kommandon.

## Konventioner du måste känna till

- **TDD är obligatoriskt** -- tester skrivs FÖRE implementation. Se [`.claude/rules/testing.md`](https://github.com/cola500/equinet/blob/main/.claude/rules/testing.md).
- **Feature branch + PR mot `main`** -- pusha aldrig direkt till main. `check:all` ska vara grön före PR.
- **DDD-Light:** routes → domain services → repositories för kärndomäner (Booking, Provider, Service m.fl.). Se [[Architecture Overview]].
- **Svenska i UI och felmeddelanden, engelska i kod.** Pre-commit-hooken kör `check:swedish` (korrekta å/ä/ö).
- **Säkerhet i API-routes:** auth → rate limit → Zod `.strict()` → domain service. `providerId`/`customerId` kommer ALLTID från sessionen, aldrig från request body. Se [[API Conventions]].
- **Loggning:** `logger`/`clientLogger`, aldrig `console.*` i produktionskod.

## Vanliga nybörjarfällor

- **`.env.local` trumfar `.env`.** `vercel env pull` skapar `.env.local` med remote-credentials -- kommentera bort dem för lokal dev. ([gotchas #23](https://github.com/cola500/equinet/blob/main/docs/guides/gotchas.md))
- **"Table does not exist" i tester** → kör `npm run setup` (migrationerna saknas).
- **Port 54322 upptagen** → en gammal Supabase-stack kör; `supabase stop` och starta om.
- Fler: [`docs/guides/gotchas.md`](https://github.com/cola500/equinet/blob/main/docs/guides/gotchas.md) (36 numrerade gotchas) och [[Troubleshooting]].

## Nästa steg

1. [[Architecture Overview]] -- förstå lagren innan du skriver kod
2. [[Environments and Deployments]] -- lokal vs staging vs prod
3. [`CLAUDE.md`](https://github.com/cola500/equinet/blob/main/CLAUDE.md) -- hela arbetsflödet (gäller även AI-assisterad utveckling)
