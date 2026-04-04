---
title: "S13-3: Ta bort passwordHash fran User"
description: "Drop passwordHash-kolumnen, migrera alla losenordsoperationer till Supabase Auth, ta bort bcrypt"
category: plan
status: active
last_updated: 2026-04-04
sections:
  - Bakgrund
  - Scope
  - Faser
  - Risker
  - Filer
---

# S13-3: Ta bort passwordHash fran User

## Bakgrund

Supabase Auth hanterar alla losenord i `auth.users` sedan sprint 13.
`passwordHash`-kolumnen i `public.User` ar oredan overfloding -- nya
anvandare far `''` via sync-triggern. Kolumnen maste bort for att:

- Eliminera PII-risk (bcrypt-hashar ar persondata)
- Forenkla kodbasen (ta bort bcrypt-beroende)
- Tvinga att alla losenordsoperationer gar genom Supabase

## Scope

**I scope:**
1. Prisma-migration: DROP COLUMN passwordHash
2. Uppdatera sync-trigger (ta bort passwordHash fran INSERT)
3. Migrera losenordsoperationer till Supabase Auth admin API
4. Ta bort bcrypt-beroende
5. Uppdatera alla tester, seeds, E2E

**Utanfor scope:**
- Ta bort legacy auth routes helt (reset-password, verify-email etc.) -- separat story
- RLS-andringar

## Faser

### Fas 1: Schema-migration

**Filer:**
- `prisma/schema.prisma` -- ta bort `passwordHash String`
- Ny migration: `ALTER TABLE "User" DROP COLUMN "passwordHash"`
- Uppdatera sync-trigger: ta bort `"passwordHash"` fran INSERT

**Approach:** En migration med bade DROP COLUMN och uppdaterad trigger.

### Fas 2: Repositories och typer

**Filer att andra:**
- `src/types/index.ts` -- ta bort passwordHash fran User interface
- `src/infrastructure/persistence/auth/IAuthRepository.ts` -- ta bort passwordHash fran typer och metod-signaturer
- `src/infrastructure/persistence/auth/PrismaAuthRepository.ts` -- ta bort passwordHash fran select/create
- `src/infrastructure/persistence/auth/MockAuthRepository.ts` -- ta bort passwordHash fran mock-data
- `src/infrastructure/persistence/invite/IInviteRepository.ts` -- uppdatera acceptInvite-signatur
- `src/infrastructure/persistence/invite/PrismaInviteRepository.ts` -- ta bort passwordHash
- `src/infrastructure/persistence/invite/MockInviteRepository.ts` -- ta bort passwordHash

**Nyckelbeslut:**
- `findUserWithCredentials()` -- ta bort helt (dead code, login gar genom Supabase)
- `resetPassword()` -- byt till Supabase admin `updateUser()`
- `upgradeGhostUser()` -- ta bort passwordHash-param
- `createUser()` -- ta bort passwordHash-param

### Fas 3: Domain services

**AuthService (`src/domain/auth/AuthService.ts`):**
- Ta bort `hashPassword`/`comparePassword` deps
- Ta bort `verifyCredentials()` (dead code sedan S13-1)
- `registerLegacy()` -- skapa User utan passwordHash
- `upgradeGhostUser()` -- skapa Supabase auth user via admin API istallet for att satta passwordHash
- `resetPassword()` -- anvand Supabase admin `updateUser()` for att uppdatera losenord
- Ta bort `import bcrypt`

**AccountDeletionService (`src/domain/account/AccountDeletionService.ts`):**
- Byt losenordsverifiering fran bcrypt.compare till Supabase `signInWithPassword()`
- Ta bort `comparePassword` dep och `passwordHash` fran `UserForDeletion`
- Ta bort `import bcrypt`

### Fas 4: Routes och utilities

**accept-invite (`src/app/api/auth/accept-invite/route.ts`):**
- Skapa Supabase Auth user for ghost-user istallet for att satta passwordHash
- Anvand `supabase.auth.admin.createUser()` eller `updateUser()`
- Ta bort `import bcrypt`

**ghost-user (`src/lib/ghost-user.ts`):**
- Ta bort bcrypt-import och passwordHash-sattning
- Ghost users har inget losenord (de kan inte logga in)

### Fas 5: Seeds och E2E

**Seeds:**
- `prisma/seed.ts` -- ta bort passwordHash och bcrypt
- `prisma/seed-demo.ts` -- ta bort passwordHash och bcrypt
- `prisma/seed-test-users.ts` -- ta bort passwordHash och bcrypt

**E2E:**
- `e2e/setup/seed-e2e.setup.ts` -- ta bort passwordHash och bcrypt
- `e2e/admin.spec.ts` -- ta bort passwordHash-anvandning
- `e2e/customer-invite.spec.ts` -- ta bort passwordHash

**Scripts (lagre prioritet, kan tas bort):**
- `scripts/migrate-users-to-supabase-auth.ts` -- arkivera (engangsjobb, klart)
- `scripts/verify-password-hash.ts` -- ta bort
- `scripts/rls-spike/test-rls.ts` -- uppdatera

### Fas 6: Tester

Uppdatera alla testfiler som refererar passwordHash:
- `src/domain/auth/AuthService.test.ts`
- `src/domain/account/AccountDeletionService.test.ts`
- `src/app/api/auth/register/route.integration.test.ts`
- `src/app/api/auth/reset-password/route.integration.test.ts`
- `src/app/api/auth/forgot-password/route.integration.test.ts`
- `src/app/api/auth/accept-invite/route.test.ts`
- `src/app/api/admin/users/route.test.ts`
- `src/app/api/customers/search/route.test.ts`
- `src/app/api/providers/route.test.ts`
- `src/app/api/providers/[id]/reviews/route.test.ts`
- `src/app/api/profile/route.test.ts`
- `src/app/api/provider/customers/route.test.ts`
- `src/app/api/export/my-data/route.test.ts`

### Fas 7: Cleanup

- Ta bort `bcrypt` och `@types/bcrypt` fran package.json
- Uppdatera docs/rules-referenser till passwordHash (kommentarer, inte kodandringar)
- Uppdatera `.claude/rules/api-routes.md`, `testing.md`, `code-review-checklist.md`

## Risker

| Risk | Mitigation |
|------|-----------|
| Seeds fungerar inte utan passwordHash | Verifiera seed lokalt efter andring |
| E2E kraschar om lokal DB inte migratats | Kor migration lokalt forst |
| accept-invite bryter utan Supabase admin | Krav: SUPABASE_SERVICE_ROLE_KEY i env |
| resetPassword bryter | Migrera till Supabase admin updateUser |
| Ghost user upgrade bryter | Migrera till Supabase admin createUser |
| Account deletion password-check | Migrera till Supabase signInWithPassword |

## Filer (sammanfattning)

**Ta bort column:** prisma/schema.prisma + ny migration
**Repositories (4):** IAuthRepository, PrismaAuthRepository, MockAuthRepository + invite repos
**Services (2):** AuthService, AccountDeletionService
**Routes (1):** accept-invite
**Utilities (1):** ghost-user.ts
**Types (1):** src/types/index.ts
**Seeds (3):** seed.ts, seed-demo.ts, seed-test-users.ts
**E2E (3):** seed-e2e.setup.ts, admin.spec.ts, customer-invite.spec.ts
**Tester (13+):** Se fas 6
**Scripts (3):** migrate-users, verify-password-hash, rls-spike
**Docs (3):** api-routes.md, testing.md, code-review-checklist.md
**Package (1):** ta bort bcrypt
