---
title: "S17-8: Migrera admin-routes till withApiHandler"
description: "Mekanisk migrering av 13 admin-routes från requireAdmin() till withApiHandler({ auth: 'admin' })"
category: plan
status: active
last_updated: 2026-04-05
sections:
  - Bakgrund
  - Scope
  - Migreringsstrategi
  - Filer att ändra
  - Filer att ta bort
  - Teststrategi
  - Risker
---

# S17-8: Migrera admin-routes till withApiHandler({ auth: "admin" })

## Bakgrund

Sprint 16 introducerade `withApiHandler({ auth: "admin" })` med automatisk audit-loggning,
session timeout (15 min) och centraliserad felhantering. Idag använder bara `audit-log/route.ts`
det nya mönstret. 13 routes använder det gamla `requireAdmin()` + manuell error handling.

**Vinst:** Automatisk audit log, 15-min session timeout, DRY kod, centraliserad rate limiting.

## Scope

Migrera 13 admin-routes. Ta bort `admin-auth.ts` efteråt.

**INTE i scope:** Ändra affärslogik, ändra response-format, lägga till nya features.

## Migreringsstrategi

Varje route transformeras mekaniskt:

**FÖRE (gammalt mönster):**
```typescript
import { auth } from "@/lib/auth-server"
import { requireAdmin } from "@/lib/admin-auth"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    const allowed = await rateLimiters.api(ip)
    if (!allowed) return 429

    const session = await auth()
    const admin = await requireAdmin(session)
    // ... handler
  } catch (error) {
    if (error instanceof Response) return error
    // ... error handling
  }
}
```

**EFTER (nytt mönster):**
```typescript
import { withApiHandler } from "@/lib/api-handler"

export const GET = withApiHandler(
  { auth: "admin" },
  async ({ request, user }) => {
    // user = AdminUser { userId, email, userType, isAdmin }
    // Rate limiting, auth, error handling sköts av withApiHandler
    // ... handler
  }
)
```

**Nyckelskillnader:**
- `admin.id` -> `user.userId`
- Manuell rate limiting försvinner (withApiHandler gör det)
- Manuell try-catch försvinner (withApiHandler gör det)
- `auth()` + `requireAdmin()` försvinner (withApiHandler gör det)
- Zod-validering med `schema:` config istället för manuell `request.json()` + `.parse()`
- Routes som kastar `z.ZodError` behöver inte fånga det längre (centralt)

**Specialfall:**
- Routes med `dynamic = "force-dynamic"` behåller det
- `verification-requests/[id]` har inline admin-check (inte requireAdmin) -- migreras likadant
- Routes utan rate limiting (bug-reports, verification-requests) FÅR rate limiting gratis

## Filer att ändra

### Routes (13 filer)

| # | Fil | HTTP-metoder | Har body-schema | Använder admin.id |
|---|-----|-------------|-----------------|-------------------|
| 1 | `admin/bookings/route.ts` | GET, PATCH | PATCH: patchSchema | PATCH: ja |
| 2 | `admin/reviews/route.ts` | GET | nej | nej |
| 3 | `admin/reviews/[id]/route.ts` | DELETE | deleteSchema | ja |
| 4 | `admin/settings/route.ts` | GET, PATCH | PATCH: patchSchema | nej |
| 5 | `admin/system/route.ts` | GET | nej | nej |
| 6 | `admin/stats/route.ts` | GET | nej | nej |
| 7 | `admin/notifications/route.ts` | POST | postSchema | ja |
| 8 | `admin/bug-reports/route.ts` | GET | nej | nej |
| 9 | `admin/bug-reports/[id]/route.ts` | GET, PATCH | PATCH: updateSchema | PATCH: ja |
| 10 | `admin/integrations/route.ts` | GET | nej | nej |
| 11 | `admin/users/route.ts` | GET, PATCH | PATCH: patchSchema | PATCH: ja |
| 12 | `admin/verification-requests/route.ts` | GET | nej | nej |
| 13 | `admin/verification-requests/[id]/route.ts` | PUT | reviewSchema | ja (session.user.id) |

### Tester (13 filer)

Varje test uppdateras till samma mock-mönster som `audit-log/route.test.ts`:
- Mock `@/lib/auth-dual` (istället för `@/lib/auth-server`)
- Mock `@/lib/supabase/server` (för admin session timeout)
- Ta bort mock av `@/lib/admin-auth`
- AdminUser: `{ id, email, userType, isAdmin, providerId, stableId, authMethod }`

### Filer att ta bort

- `src/lib/admin-auth.ts` (ersatt av withApiHandler)
- `src/lib/admin-auth.test.ts` (ej längre relevant)

## Teststrategi

Enkel TDD (mekanisk migrering):
1. Uppdatera tester till nytt mock-mönster
2. Verifiera att alla tester passerar efter migrering
3. Nivå 1: `npx vitest run src/app/api/admin` + `npm run typecheck`
4. Nivå 2: `npm run check:all` före merge

## Risker

- **Låg risk:** Rent mekanisk transformation med etablerat mönster (audit-log).
- **Admin.id vs user.userId:** `requireAdmin` returnerar `{ id }`, withApiHandler ger `{ userId }`. Alla ställen med `admin.id` måste uppdateras till `user.userId`.
- **Routes med context params:** 3 routes tar `context: { params }` -- withApiHandler returnerar en funktion `(request: NextRequest) => Promise<NextResponse>`. Segment-parametrar skickas inte automatiskt. Dessa routes behöver specialhantering med wrapper-funktion.
