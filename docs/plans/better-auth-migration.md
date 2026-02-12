# Better Auth Migration Plan: NextAuth v5 -> Better Auth

> Skapad: 2026-02-12 (Session 20)
> Status: Planerad -- implementeras i framtida session

## Summary of Findings

After exploring the full codebase, here is the scope:

**Direct next-auth imports** (10 files):
- `src/lib/auth.ts`, `src/lib/auth.config.ts`, `src/lib/auth-server.ts`
- `src/types/next-auth.d.ts`
- `src/hooks/useAuth.ts`, `src/hooks/useAuth.test.ts`
- `src/components/providers/SessionProvider.tsx`, `src/components/layout/Header.tsx`
- `src/app/(auth)/login/page.tsx`, `src/app/api/auth/[...nextauth]/route.ts`

**Indirect auth consumers** (via `@/lib/auth-server`): 98 API route files + 56 test files that mock `@/lib/auth-server`.

**NEXTAUTH_URL env var usage** (beyond auth config): Email templates (6 references), payment route (1 reference), `src/lib/env.ts` validation.

**Key architectural insight**: The project has a clean abstraction layer. All 98 API routes import from `@/lib/auth-server` (not directly from next-auth). All 56 test files mock `@/lib/auth-server`. The client-side code uses `useAuth()` hook from `@/hooks/useAuth.ts`. This means the migration surface is **much smaller than it looks** -- we only need to change the files behind these abstractions.

---

## Phase-by-Phase Migration Plan

### Phase 0: Preparation (Database Schema)

**Goal**: Add Better Auth tables to the database without touching any code. App continues running on next-auth.

**Steps**:

1. **Create Prisma migration** that adds two new tables: `Session` and `Account`. Better Auth needs `session` and `account` tables. Our `User` table already exists and can be mapped. Our `EmailVerificationToken` can be mapped to Better Auth's `verification` concept.

   New tables to add to `prisma/schema.prisma`:

   ```prisma
   model Session {
     id        String   @id @default(cuid())
     userId    String
     user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     token     String   @unique
     expiresAt DateTime
     ipAddress String?
     userAgent String?
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt

     @@index([userId])
     @@index([token])
   }

   model Account {
     id                    String    @id @default(cuid())
     userId                String
     user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
     accountId             String
     providerId            String    // "credential" for email/password
     accessToken           String?
     refreshToken          String?
     accessTokenExpiresAt  DateTime?
     refreshTokenExpiresAt DateTime?
     scope                 String?
     idToken               String?
     password              String?   // bcrypt hash for credential accounts
     createdAt             DateTime  @default(now())
     updatedAt             DateTime  @updatedAt

     @@index([userId])
   }
   ```

   Also add relations on User:
   ```prisma
   model User {
     // ... existing fields
     sessions    Session[]
     accounts    Account[]
   }
   ```

2. **Run migration locally**: `npx prisma migrate dev --name add_better_auth_tables`

3. **Apply migration to Supabase** via `apply_migration` MCP tool.

4. **Run `get_advisors(type: "security")`** to verify RLS on new tables.

5. **Write data migration script**: For each existing User, create a corresponding Account row:
   ```sql
   INSERT INTO "Account" (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
   SELECT gen_random_uuid(), id, id, 'credential', "passwordHash", "createdAt", now()
   FROM "User"
   WHERE "passwordHash" IS NOT NULL;
   ```

**Tests**: Purely additive schema -- existing tests should all pass unchanged.

**Verification**: App works exactly as before. New tables exist but are empty (except Account rows from data migration).

---

### Phase 1: Install Better Auth and Create Core Config

**Goal**: Install better-auth, create the server-side auth instance, but do NOT connect it to any routes yet. Both auth systems coexist.

**Steps**:

1. **Install better-auth**: `npm install better-auth`

2. **Create `src/lib/better-auth.ts`** (new file, not replacing auth.ts yet):

   ```typescript
   import { betterAuth } from "better-auth"
   import { prismaAdapter } from "better-auth/adapters/prisma"
   import { prisma } from "@/lib/prisma"
   import bcrypt from "bcrypt"

   export const auth = betterAuth({
     database: prismaAdapter(prisma, {
       provider: "postgresql",
     }),
     user: {
       additionalFields: {
         firstName: { type: "string", required: true },
         lastName: { type: "string", required: true },
         userType: { type: "string", required: true },
         isAdmin: { type: "boolean", defaultValue: false },
         isBlocked: { type: "boolean", defaultValue: false },
         phone: { type: "string", required: false },
         passwordHash: { type: "string", required: false },
         isManualCustomer: { type: "boolean", defaultValue: false },
         emailVerifiedAt: { type: "date", required: false },
       },
     },
     emailAndPassword: {
       enabled: true,
       requireEmailVerification: true,
       password: {
         hash: async (password: string) => {
           return await bcrypt.hash(password, 10)
         },
         verify: async ({ hash, password }: { hash: string; password: string }) => {
           return await bcrypt.compare(password, hash)
         },
       },
     },
     session: {
       expiresIn: 60 * 60 * 24,      // 24 hours
       updateAge: 60 * 60 * 12,       // 12 hours
     },
   })
   ```

3. **Create `src/lib/better-auth-client.ts`** (new file)

4. **Write tests** for bcrypt hash/verify compatibility with existing passwords.

**Verification**: All existing tests pass. New better-auth config tests pass. App still runs on next-auth.

---

### Phase 2: Create New Auth Abstraction Layer

**Goal**: Create a new version of `auth-server.ts` that works with Better Auth but exposes the **exact same interface** as the current one.

**Steps**:

1. **Create `src/lib/auth-server-better.ts`** (parallel implementation) with identical `auth()` and `getSession()` functions.

2. **Use `customSession` plugin** for providerId lookup:
   ```typescript
   import { customSession } from "better-auth/plugins"
   plugins: [
     customSession(async ({ user, session }) => {
       const provider = await prisma.provider.findUnique({
         where: { userId: user.id },
         select: { id: true },
       })
       return {
         user: { ...user, providerId: provider?.id ?? null },
         session,
       }
     }),
   ],
   ```

3. **Write comprehensive tests** mirroring `src/lib/auth-server.test.ts`.

**Verification**: Both old and new auth-server tests pass.

---

### Phase 3: Create New Client-Side Hooks and Components

**Goal**: Create Better Auth versions of all client-side auth components.

- `src/hooks/useAuthBetter.ts` with identical interface
- `src/components/providers/SessionProviderBetter.tsx` (passthrough -- Better Auth doesn't need a provider)
- Write tests mirroring existing hook tests

---

### Phase 4: Create Better Auth API Route Handler + proxy.ts

**Goal**: Set up Better Auth API handler and new proxy.ts for Next.js 16.

1. **Create `src/app/api/auth/[...all]/route.ts`** (at temporary path initially)
2. **Create `proxy.ts`** (at project root, replacing middleware.ts) -- uses cookie-only check, full validation in auth-server
3. **Update env variables**: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`

---

### Phase 5: The Swap (Atomic Cutover)

**Goal**: Replace next-auth with Better Auth in one coordinated change.

**Key steps** (in order):
1. Swap `auth-server.ts` with Better Auth implementation (0 API routes change)
2. Swap `useAuth.ts` with Better Auth version
3. Swap SessionProvider (now passthrough)
4. Update Header.tsx signOut
5. Update login/page.tsx signIn
6. Replace `[...nextauth]` with `[...all]`
7. Replace middleware.ts with proxy.ts
8. Delete old auth files
9. Update test mocks in `tests/setup.ts`
10. Update env var references in email templates
11. Remove `next-auth` dependency

---

### Phase 6: Registration + Email Verification

**Recommendation**: **Keep our custom registration endpoints** (AuthService does too much custom work).

Update AuthService.register() to also create Better Auth Account row.

---

### Phase 7: Cleanup and Polish

Remove all traces of next-auth, update documentation, verify everything.

---

## Impact Assessment

### What changes:
| Component | Files Changed | Risk |
|-----------|--------------|------|
| Auth core config | 3 files | Medium |
| Client hooks | 2 files | Low |
| UI components | 2 files | Low |
| API route handler | 1 file | Low |
| Middleware -> Proxy | 1 file | Medium |
| Registration flow | 3 files | Medium |
| Environment | 5 files | Low |
| Email templates | 4 files (env rename only) | Low |
| Database | 1 migration + data migration | Medium |

### What does NOT change:
- **0 API route files** (all 98 routes import from `@/lib/auth-server`)
- **0 test mock patterns** (56 test files mock `@/lib/auth-server`)
- **0 domain service files**
- **0 admin-auth files**

### User-facing impact:
- All users must re-login after deployment (JWT -> database sessions)
- No UI changes visible
- Login/registration flow works identically

## Risks and Mitigations

1. **Password compatibility**: Custom `password.hash/verify` uses same bcrypt library. Phase 1 includes compatibility test.
2. **Account table data migration**: SQL migration copies hashes from User.passwordHash to Account.password.
3. **customSession plugin reliability**: Test thoroughly in Phase 2.
4. **providerId lookup performance**: Use `cookieCache` option to reduce DB hits.
5. **E2E test breakage**: Login flow is identical from user perspective. Should pass without changes.

## Sources

- [Better Auth - Next.js Integration](https://www.better-auth.com/docs/integrations/next)
- [Better Auth - Prisma Adapter](https://www.better-auth.com/docs/adapters/prisma)
- [Better Auth - Email & Password](https://www.better-auth.com/docs/authentication/email-password)
- [Better Auth - Options Reference](https://www.better-auth.com/docs/reference/options)
- [Better Auth - Security](https://www.better-auth.com/docs/reference/security)
- [Better Auth - Session Management](https://www.better-auth.com/docs/concepts/session-management)
- [Prisma + Better Auth Guide](https://www.prisma.io/docs/guides/betterauth-nextjs)
