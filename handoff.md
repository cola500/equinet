# Handoff: Bug Reports Feature

## Status

**Branch:** `feature/bug-reports` (baserad pa `main`)
**Plan:** `docs/plans/2026-02-28-bug-reports.md`
**Design:** `docs/plans/2026-02-28-bug-reports-design.md`

## Vad som ar klart

### Fas 1: Prisma schema + migration (KLAR)
- Commit: `feee74e feat: add BugReport model with status and priority enums`
- `BugReportStatus` enum (NEW, INVESTIGATING, PLANNED, FIXED, DISMISSED)
- `BugReportPriority` enum (P0, P1, P2, P3)
- `BugReport` modell med alla falt, index pa status/priority/createdAt
- `bugReports` relation pa User-modellen
- Migration: `20260228185114_add_bug_report`
- Typecheck: 0 errors

## Vad som aterkstar (i ordning)

### Fas 2: POST /api/bug-reports (TDD)

**Filer att skapa:**
- `src/app/api/bug-reports/route.test.ts` -- skriv FORST
- `src/app/api/bug-reports/route.ts`

**Filer att andra:**
- `src/lib/rate-limit.ts` -- lagg till `bugReport` limiter

**Detaljer:**
- Auth: `await auth()` (inloggad anvandare)
- Rate limit: 5 rapporter/timme per anvandare (ny `bugReport` limiter)
- Zod-schema: title (required, trim, max 200), description (required, trim, max 5000), reproductionSteps (optional, max 5000), pageUrl (max 500), userAgent (optional, max 500), platform (optional, max 100). Anvand `.strict()`.
- `userRole` harledds fran session.user.userType (CUSTOMER/PROVIDER/ADMIN/UNKNOWN)
- `userId` fran session.user.id
- Returnera `{ id, status }` med 201

**Rate limiter att lagga till i `src/lib/rate-limit.ts`:**
1. Upstash-limiter (i `getUpstashRateLimiters`): `bugReport: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "1 h"), analytics: true, prefix: "ratelimit:bug-report" })`
2. In-memory config: `bugReport: { max: 50, window: 60 * 60 * 1000 }`
3. Export: `bugReport: async (identifier: string) => checkRateLimit('bugReport', identifier)`

**Tester (behavior-based):**
- 401 nar ej inloggad
- 429 nar rate limited
- 400 nar titel saknas
- 400 nar beskrivning saknas
- 400 for ogiltig JSON
- 201 med bug report ID vid lyckad submit
- Verifierar att userRole harledds fran session
- Verifierar att title/description trimmas
- 500 vid DB-fel

### Fas 3: Admin API routes (TDD)

**Filer att skapa:**
- `src/app/api/admin/bug-reports/route.test.ts` -- skriv FORST
- `src/app/api/admin/bug-reports/route.ts`
- `src/app/api/admin/bug-reports/[id]/route.test.ts` -- skriv FORST
- `src/app/api/admin/bug-reports/[id]/route.ts`

**GET /api/admin/bug-reports (lista):**
- Auth: `requireAdmin(session)` fran `@/lib/admin-auth`
- Query params: `status` (filter), `sortBy` (createdAt|priority), `sortOrder` (asc|desc)
- Select: id, title, status, priority, userRole, pageUrl, createdAt, user.firstName, user.lastName
- Returnerar `{ bugReports, total }`

**GET /api/admin/bug-reports/[id] (detalj):**
- Auth: `requireAdmin(session)`
- Include user (firstName, lastName, email)
- 404 om ej hittad

**PATCH /api/admin/bug-reports/[id] (uppdatera):**
- Auth: `requireAdmin(session)`
- Zod: status (enum, optional), priority (enum, optional), internalNote (string, optional). `.strict()`.
- Satter `updatedBy` till admin.id
- 404 om ej hittad, 400 for valideringsfel

**Tester:**
- Lista: 401, 403, 200 med data, filtrering pa status, 500
- Detalj: 403, 404, 200
- Update: 403, 404, 400 (ogiltig status), 200 (lyckad), 500

### Fas 4: Refaktorera BugReportFab (UI)

**Filer att andra:**
- `src/components/provider/BugReportFab.tsx`
- `src/components/provider/BugReportFab.test.tsx`

**Andringar:**
- Ta bort `useFeatureFlag("offline_mode")` gate -- visa for ALLA inloggade (`useAuth().isAuthenticated`)
- Ta bort beroenden: `useFeatureFlags`, `useOnlineStatus`, `getDebugLogs`, `submitBugReport` (fran offline/)
- Lagg till falt: titel (Input), beskrivning (textarea), steg att aterskapa (textarea, valfritt)
- POST till `/api/bug-reports` med { title, description, reproductionSteps, pageUrl, userAgent, platform }
- Vid success: visa kvittens med referens-ID (gron box med `data.id`)
- Vid error: toast med felmeddelande
- Klient-validering: disabled submit om title eller description ar tomma

**Tester att uppdatera:**
- Ta bort tester for offline_mode gate
- Lagg till: renderar for inloggade, renderar inte for utloggade, visar titel-falt, disabled submit utan falt

### Fas 5: Admin UI (sidor)

**Filer att skapa:**
- `src/app/admin/bug-reports/page.tsx`
- `src/app/admin/bug-reports/[id]/page.tsx`

**Filer att andra:**
- `src/components/layout/AdminNav.tsx`

**Lista (/admin/bug-reports):**
- `useSWR` for datahemtning fran `/api/admin/bug-reports`
- Tabell: titel, status, prioritet, roll, skapad, rapporterare (user.firstName + lastName)
- Status-dropdown filter (Alla + 5 statusar)
- Sortering: datum (default desc) eller prioritet
- Klickbar rad -> `/admin/bug-reports/[id]`
- Status-badges: NEW=blue, INVESTIGATING=amber, PLANNED=purple, FIXED=green, DISMISSED=gray
- Prioritet-badges: P0=red, P1=orange, P2=yellow, P3=gray

**Detalj (/admin/bug-reports/[id]):**
- `useSWR` for datahemtning
- Visa alla falt (titel, beskrivning, steg, URL, userAgent, platform, skapad, rapporterare)
- Redigerbar: status (Select), prioritet (Select), intern kommentar (Textarea)
- Spara-knapp -> PATCH `/api/admin/bug-reports/[id]` -> toast bekraftelse -> mutate SWR
- Tillbaka-lank

**AdminNav:**
- Importera `Bug` fran lucide-react
- navItems: `{ href: "/admin/bug-reports", label: "Buggrapporter", icon: Bug }` (efter Verifieringar)
- mobileMoreItems: `{ href: "/admin/bug-reports", label: "Buggar", icon: Bug, matchPrefix: "/admin/bug-reports" }` (efter Verifieringar)

### Fas 6: Verifiering

- `npm run test:run` -- alla tester grona
- `npm run typecheck` -- 0 errors
- `npm run lint` -- inga nya varningar
- `npm run build` -- production build lyckas

## Projektkontext

- **Stack**: Next.js 16 App Router + TypeScript + Prisma + NextAuth v5 + shadcn/ui
- **TDD**: Skriv tester FORST, red -> green -> refactor
- **API-monster**: auth -> rate limit -> parse JSON (try-catch) -> Zod (.strict()) -> prisma -> response
- **Admin auth**: `requireAdmin(session)` fran `@/lib/admin-auth` (throws 401/403)
- **Felmeddelanden**: Svenska i responses, engelska i logger
- **Commit**: Committa efter varje fas. Pusha INTE utan att fraga.
- **Test-monster**: Behavior-based, mocka auth + prisma + rate-limit + logger. `as never` for mock-typning.

## Nyckel-filer att referera

- `src/app/api/admin/verification-requests/route.test.ts` -- bra referens for admin API test
- `src/lib/rate-limit.ts` -- har alla befintliga limiters
- `src/lib/admin-auth.ts` -- `requireAdmin()` implementation
- `src/components/provider/BugReportFab.tsx` -- nuvarande implementation att refaktorera
- `src/components/layout/AdminNav.tsx` -- lagg till nav-item har
- `prisma/schema.prisma` -- schema (BugReport redan tillagd)
