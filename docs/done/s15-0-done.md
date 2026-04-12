---
title: "S15-0 Done: Fixa E2E i CI med lokal Supabase Auth"
description: "supabase start i GitHub Actions ger riktig auth-instans for E2E-tester"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews
  - Avvikelser
  - Lardomar
---

# S15-0 Done: Fixa E2E i CI med lokal Supabase Auth

## Acceptanskriterier

- [x] `supabase start` kor i GitHub Actions E2E-jobb
- [x] E2E seed skapar anvandare via Supabase Auth admin API
- [x] Custom access token hook aktiverad i config.toml
- [x] Prisma-migrationer (hook, trigger, RLS) appliceras via `migrate deploy`
- [x] Unit tests, typecheck, lint, build paverkas INTE (3968 tester grona, 4/4 gates)
- [ ] `npm run test:e2e:smoke` passerar i CI -- **kraver push + CI-korning for slutverifiering**

## Definition of Done

- [x] Fungerar som forvantat, inga TypeScript-fel
- [x] Saker (Zod, error handling, NODE_ENV-guard pa test-endpoint)
- [x] Unit tests grona (3968/3968)
- [x] Feature branch, alla tester grona

## Reviews

- **tech-architect**: Godkand plan. Rekommenderade approach A (supabase start). Identifierade: config.toml hook-aktivering, prisma migrate deploy istallet for db push, ta bort separat postgres-service.
- **security-reviewer**: 0 kritiska. 1 major: NODE_ENV-guard verifierad pa `/api/test/reset-rate-limit`. Rekommenderade LOCAL-prefix pa CI-env (ej implementerat -- deterministiska nycklar behover inget prefix).
- **code-reviewer**: Godkand plan. Identifierade: lösenord i seed (fixat), build-jobbets NEXTAUTH-env (rensat), trigger vs upsert (klargjort).

## Avvikelser

1. **Lokal E2E mot Supabase ar komplicerat**: Next.js `.env.local` overridar alltid env-variabler. Lokalt kor E2E mot Docker DB + riktig Supabase (via `.env.local`). CI kor mot lokal Supabase (ingen `.env.local`). Slutverifiering kraver CI-korning.

2. **RLS-testfiler flyttade**: `prisma/migrations/__tests__/` inneholl testfiler som Prisma tolkade som migrationskataloger. Flyttade till `src/__tests__/rls/` (battre plats, korrekta sokvagar).

3. **dotenv@17 (dotenvx)**: Ny version injicerar `.env.local` automatiskt. Behovde `E2E_DATABASE_URL` som dedikerad env-var for att undvika override i Prisma seed.

4. **Supabase SDK**: `updateUser` ar `updateUserById` i @supabase/supabase-js v2.101.

## Lardomar

- **`.env.local` trumfar alltid**: Next.js `loadEnvConfig` ger `.env.local` hogsta prioritet. Playwright `webServer.env` kan INTE overrida den. CI-miljo (utan `.env.local`) ar det ratta stallet att testa Supabase-integration.
- **dotenv@17 auto-injicerar**: `dotenv@17.2.3` (dotenvx) laddar `.env.local` automatiskt aven utan explicit `config()`. PrismaClient i E2E behover explicit `datasourceUrl` for att undvika att prisma.config.ts env tar over.
- **prisma.config.ts laddar env**: Prisma 6 `prisma.config.ts` gor `import "dotenv/config"` som laddar `.env` + `.env.local`. PrismaClient runtime arver detta. Använd `datasourceUrl` for explicit override.
- **supabase db reset**: Rensar BADE `auth.users` och `public.*` -- anvandbart for idempotent E2E-seed.
- **Trigger ar synkron**: PostgreSQL triggers (handle_new_user) kor synkront inom samma transaktion. 1s delay i seed ar tillracklig marginal.
