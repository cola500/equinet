---
title: "S11-4: Migrera onboarding-status till dual-auth"
description: "Byt auth() till getAuthUser() i /api/provider/onboarding-status"
category: plan
status: wip
last_updated: 2026-04-03
sections:
  - Sammanfattning
  - Filer som andras
  - Approach
  - Risker
---

# S11-4: Migrera onboarding-status till dual-auth

## Sammanfattning

Migrera `/api/provider/onboarding-status` fran `auth()` (NextAuth) till `getAuthUser()` (dual-auth helper fran S11-1). Bevisar att dual-auth fungerar i praktiken.

Routen ar en enkel GET utan writes -- lagsta mojliga risk.

## Filer som andras

| Fil | Andring |
|-----|---------|
| `src/app/api/provider/onboarding-status/route.ts` | Byt `auth()` -> `getAuthUser(request)`, anvand `authUser.id` istallet for `session.user.id` |
| `src/app/api/provider/onboarding-status/route.test.ts` | Uppdatera mock fran `@/lib/auth` till `@/lib/auth-dual`, testa bade NextAuth och Supabase auth |

## Approach

1. **RED**: Skriv nya tester:
   - Route returnerar 200 nar `getAuthUser()` returnerar anvandare (authMethod: "nextauth")
   - Route returnerar 200 nar `getAuthUser()` returnerar anvandare (authMethod: "supabase")
   - Route returnerar 401 nar `getAuthUser()` returnerar null
   - Befintliga beteende-tester (onboarding-status logik) behalls

2. **GREEN**: Byt import och anrop:
   - `import { getAuthUser } from "@/lib/auth-dual"` istallet for `import { auth } from "@/lib/auth"`
   - `const authUser = await getAuthUser(request)` istallet for `const session = await auth()`
   - `authUser.id` istallet for `session.user.id`
   - `if (!authUser)` istallet for `if (!session?.user?.id)`

3. **REVIEW**: code-reviewer subagent
4. **VERIFY**: `npx vitest run src/app/api/provider/onboarding-status` + `npm run typecheck`

## Risker

- **Lag risk**: Enkel GET, ingen write, ingen sidoeffekt
- **Fallback**: `getAuthUser()` provar NextAuth som andra alternativ, sa befintliga session-cookies fungerar som forut
- **Ingen feature flag**: Sprint-dokumentet namner `supabase_auth_poc` men `getAuthUser()` har fast prioritetsordning (Bearer > NextAuth > Supabase) utan feature flag -- det ar sa S11-1 implementerades. Inga andringar behovs.
