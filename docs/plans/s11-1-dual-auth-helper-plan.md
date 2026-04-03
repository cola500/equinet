---
title: "S11-1: Dual-auth helper"
description: "Plan för getAuthUser() som stödjer båda auth-systemen under parallell drift"
category: plan
status: wip
last_updated: 2026-04-03
sections:
  - Bakgrund
  - Design
  - Filer
  - TDD-approach
  - Risker
---

# S11-1: Dual-auth helper

## Bakgrund

S10-5 bekräftade GO för Supabase Auth. Under migreringsperioden (fas 1) behöver
routes kunna autenticera via **antingen** NextAuth eller Supabase Auth. Denna
helper ger en normaliserad `AuthUser` oavsett vilken auth-källa som används.

**Princip:** Befintliga routes förblir oförändrade. Nya routes (och routes som
gradvis migreras) byter från `auth()` till `getAuthUser(request)`.

## Design

### AuthUser-typ

```typescript
interface AuthUser {
  id: string
  email: string
  userType: string        // "provider" | "customer" | "admin"
  isAdmin: boolean
  providerId: string | null
  stableId: string | null
  authMethod: "nextauth" | "supabase"  // spårbarhet
}
```

### getAuthUser(request) -- flöde

```
1. Är feature flag `supabase_auth_poc` PÅ?
   NEJ -> bara NextAuth
   JA  -> försök Supabase först, fallback NextAuth

2. Supabase Auth:
   - createSupabaseServerClient()
   - supabase.auth.getUser()
   - Mappa app_metadata -> AuthUser

3. NextAuth fallback:
   - auth()
   - Mappa session.user -> AuthUser

4. Inget auth -> returnera null
```

### Varför Supabase först (när flaggan är på)

Under parallell drift kan en användare ha cookies för båda systemen.
Supabase-cookien är "nyare" och ska prioriteras. Om den saknas eller är
ogiltig faller vi tillbaka till NextAuth. Detta möjliggör gradvis migrering
utan att tvinga alla användare att logga om samtidigt.

## Filer

| Fil | Ändring |
|-----|---------|
| `src/lib/auth-dual.ts` | **NY** -- `AuthUser`-typ + `getAuthUser()` |
| `src/lib/auth-dual.test.ts` | **NY** -- BDD dual-loop tester |

**Inga befintliga filer ändras.** Helpern är opt-in -- routes som inte
migreras använder `auth()` som vanligt.

## TDD-approach (BDD dual-loop)

### Yttre integrationstest (vad vi vill bevisa)

1. Returnerar Supabase AuthUser när flagga PÅ + giltig Supabase-session
2. Faller tillbaka till NextAuth när flagga PÅ + ingen Supabase-session
3. Använder BARA NextAuth när flagga AV
4. Returnerar null när ingen auth alls
5. AuthUser har korrekt authMethod ("supabase" vs "nextauth")

### Inre unit-tester

- Supabase-mappning: app_metadata -> AuthUser (edge cases: saknade fält)
- NextAuth-mappning: session.user -> AuthUser
- Feature flag-kontroll

## Risker

| Risk | Mitigation |
|------|-----------|
| Supabase-cookies saknas i befintliga sessioner | NextAuth fallback hanterar detta |
| Feature flag cache (30s) | Acceptabelt -- inga auth-avbrott, bara fördröjd övergång |
| `createSupabaseServerClient()` kräver cookies() | Redan löst i PoC, fungerar i API routes |
| Prestanda: dubbla auth-anrop | Bara om Supabase misslyckas (ovanligt i steady state) |
