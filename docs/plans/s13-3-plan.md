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

Supabase Auth hanterar alla lösenord i `auth.users` sedan sprint 13.
`passwordHash`-kolumnen i `public.User` ar redan overfloding -- nya
anvandare far `''` via sync-triggern. Kolumnen maste bort for att:

- Eliminera PII-risk (bcrypt-hashar ar persondata)
- Forenkla kodbasen (ta bort bcrypt-beroende)
- Tvinga att alla losenordsoperationer gar genom Supabase

**AKTIV PRODUKTIONSBUG:** `AccountDeletionService` jamfor password mot
`user.passwordHash` som ar `''` for Supabase-anvandare. bcrypt.compare
returnerar alltid false -> kontoborttagning blockerad. Fixas i fas 3.

## Scope

**I scope:**
1. Migrera alla losenordsoperationer till Supabase Auth admin API
2. Ta bort alla passwordHash-referenser i kod
3. Prisma-migration: DROP COLUMN passwordHash (SIST)
4. Uppdatera sync-trigger
5. Ta bort bcrypt-beroende
6. Uppdatera alla tester, seeds, E2E

**Utanfor scope:**
- Ta bort legacy auth routes helt (reset-password, verify-email etc.) -- separat story
- RLS-ändringar

## Fasordning (ANDRAD efter tech-architect review)

Schema-migrationen (DROP COLUMN) kors SIST -- annars bryts produktion
om kod fortfarande refererar kolumnen. Ordning:

```
Fas 1: Repositories + typer (ta bort passwordHash fran interfaces)
Fas 2: Domain services (migrera till Supabase admin API)
Fas 3: Routes + utilities (accept-invite, ghost-user)
Fas 4: Seeds + E2E (ta bort bcrypt-anvandning)
Fas 5: Tester (uppdatera alla testfiler)
Fas 6: Schema-migration (DROP COLUMN -- saker nu nar ingen kod anvander den)
Fas 7: Cleanup (ta bort bcrypt, uppdatera docs)
```

## Faser

### Fas 1: Repositories och typer

**Filer att andra:**
- `src/types/index.ts` -- ta bort passwordHash fran User interface
- `src/infrastructure/persistence/auth/IAuthRepository.ts`:
  - Ta bort `AuthUserWithCredentials` typ (dead, login via Supabase)
  - Ta bort `passwordHash` fran `CreateUserData`
  - Ta bort `passwordHash` fran `UpgradeGhostUserData`
  - Ta bort `findUserWithCredentials()` metod
  - Byt `resetPassword(userId, tokenId, passwordHash)` -> `markResetTokenUsed(tokenId)`
- `src/infrastructure/persistence/auth/PrismaAuthRepository.ts`:
  - Ta bort `credentialsSelect`, `findUserWithCredentials()`
  - Ta bort passwordHash fran `createUser()`, `upgradeGhostUser()`
  - Byt `resetPassword()` -> `markResetTokenUsed()`
- `src/infrastructure/persistence/auth/MockAuthRepository.ts`:
  - Ta bort `passwordHash` fran `StoredUser`
  - Ta bort `findUserWithCredentials()`
  - Uppdatera alla metoder
- `src/infrastructure/persistence/invite/IInviteRepository.ts`:
  - Byt `acceptInvite(tokenId, userId, passwordHash)` -> `acceptInvite(tokenId, userId)`
- `src/infrastructure/persistence/invite/PrismaInviteRepository.ts`:
  - Ta bort passwordHash fran `acceptInvite()`
- `src/infrastructure/persistence/invite/MockInviteRepository.ts`:
  - Ta bort passwordHash fran `StoredUser` och `acceptInvite()`

### Fas 2: Domain services

**AuthService (`src/domain/auth/AuthService.ts`):**
- Ta bort `import bcrypt`
- Ta bort `hashPassword`/`comparePassword` deps fran interface + constructor
- Ta bort `verifyCredentials()` helt (dead code sedan S13-1)
- `registerLegacy()` -- ta bort helt. Alla registreringar gar genom
  `registerViaSupabase()`. Om `supabaseAdmin` saknas -> returnera
  REGISTRATION_FAILED. Inga fallbacks -- Supabase ar enda auth-kallan.
- `upgradeGhostUser()` -- ta bort passwordHash. Skapa Supabase auth user
  via `supabaseAdmin.createUser()` for ghost-usern. Repo-anropet uppdaterar
  bara profilfalt (firstName, lastName, etc.).
- `resetPassword()` -- använd `supabaseAdmin.updateUser()` for lösenord,
  sedan `repo.markResetTokenUsed()` for token-markering.
- Uppdatera `createAuthService()` factory: ta bort bcrypt-deps.

**AccountDeletionService (`src/domain/account/AccountDeletionService.ts`):**
- Byt `comparePassword` dep -> `verifyPassword` som anropar
  Supabase `signInWithPassword()` (verifierar mot auth.users)
- Ta bort `passwordHash` fran `UserForDeletion`
- Ta bort `import bcrypt`
- FIXAR AKTIV BUG: kontoradering fungerar nu for Supabase-anvandare

### Fas 3: Routes och utilities

**accept-invite (`src/app/api/auth/accept-invite/route.ts`):**
- Ta bort `import bcrypt`
- Istallet for `bcrypt.hash()` + `prisma.user.update({passwordHash})`:
  Använd `supabase.auth.admin.updateUserById(userId, { password })` for
  att satta lösenord i Supabase Auth, sedan uppdatera User-raden
  (isManualCustomer=false, emailVerified=true) utan passwordHash.

**ghost-user (`src/lib/ghost-user.ts`):**
- Ta bort `bcrypt`-import och `passwordHash`-sattning
- Ghost users skapas utan lösenord (Prisma-kolumnen finns inte langre)

### Fas 4: Seeds och E2E

**Seeds:**
- `prisma/seed.ts` -- ta bort passwordHash och bcrypt
- `prisma/seed-demo.ts` -- ta bort passwordHash och bcrypt
- `prisma/seed-test-users.ts` -- ta bort passwordHash och bcrypt

**E2E:**
- `e2e/setup/seed-e2e.setup.ts` -- ta bort passwordHash och bcrypt
- `e2e/admin.spec.ts` -- ta bort passwordHash-anvandning
- `e2e/customer-invite.spec.ts` -- ta bort passwordHash

**Scripts (lagre prioritet):**
- `scripts/migrate-users-to-supabase-auth.ts` -- arkivera (engangsjobb, klart)
- `scripts/verify-password-hash.ts` -- ta bort
- `scripts/rls-spike/test-rls.ts` -- uppdatera

### Fas 5: Tester

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

### Fas 6: Schema-migration (SIST)

**Filer:**
- `prisma/schema.prisma` -- ta bort `passwordHash String`
- Ny migration: `ALTER TABLE "User" DROP COLUMN "passwordHash"`
- Uppdatera sync-trigger: ta bort `"passwordHash"` fran INSERT

**Approach:** En migration med bade DROP COLUMN och uppdaterad trigger.
Kors EFTER all kod ar uppdaterad sa att ingen refererar kolumnen.

### Fas 7: Cleanup

- Ta bort `bcrypt` och `@types/bcrypt` fran package.json
- Uppdatera docs/rules-referenser till passwordHash
- Uppdatera `.claude/rules/api-routes.md`, `testing.md`, `code-review-checklist.md`

## Risker

| Risk | Mitigation |
|------|-----------|
| Seeds fungerar inte utan passwordHash | Verifiera seed lokalt efter ändring |
| E2E kraschar om lokal DB inte migratats | Kor migration lokalt forst |
| accept-invite bryter utan Supabase admin | Krav: SUPABASE_SERVICE_ROLE_KEY i env |
| resetPassword bryter | Migrera till Supabase admin updateUser |
| Ghost user upgrade bryter | Migrera till Supabase admin createUser |
| Account deletion password-check | Migrera till Supabase signInWithPassword |
| registerLegacy-fallback saknas | Supabase ar enda auth-kallan, ingen fallback |

## Filer (sammanfattning)

**Repositories (4):** IAuthRepository, PrismaAuthRepository, MockAuthRepository + invite repos
**Services (2):** AuthService, AccountDeletionService
**Routes (1):** accept-invite
**Utilities (1):** ghost-user.ts
**Types (1):** src/types/index.ts
**Seeds (3):** seed.ts, seed-demo.ts, seed-test-users.ts
**E2E (3):** seed-e2e.setup.ts, admin.spec.ts, customer-invite.spec.ts
**Tester (13+):** Se fas 5
**Scripts (3):** migrate-users, verify-password-hash, rls-spike
**Schema:** prisma/schema.prisma + ny migration (FAS 6, sist)
**Docs (3):** api-routes.md, testing.md, code-review-checklist.md
**Package (1):** ta bort bcrypt
