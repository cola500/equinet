# Plan: Komplett Admin-gränssnitt

## Context

Equinet har idag en enda admin-sida (`/admin/verifications`) som använder `CustomerLayout`. Backend-funktionalitet som Fortnox-integration, betalningar, cron-jobb, användarhantering och bokningsöversikt saknar helt admin-gränssnitt. Målet är att samla all administration under ett dedikerat admin-gränssnitt med eget layout, dashboard och sektioner.

**Nuläge:** 1 admin-sida, 2 admin-API-routes, ingen AdminLayout, ingen dashboard.
**Mål:** Komplett admin-svit med 7 sidor, ~12 nya API-routes, dedikerat AdminLayout med sidebar.

## Approach

Bygger ut admin-gränssnittet i 3 faser, alla inom samma implementation:

- **Fas 1 (Foundation):** AdminLayout + sidebar, dashboard med KPIs, användarhantering, middleware-fix
- **Fas 2 (Översikt):** Bokningsöversikt, leverantörsöversikt med statistik
- **Fas 3 (Integrationer + System):** Fortnox-status, betalningsöversikt, systemhälsa

Alla admin-routes är **read-only** (GET) utom befintlig verifiering (PUT). Använder Prisma direkt i routes (inga nya repositories -- admin-queries är enkla aggregeringar). Extraherar `requireAdmin()` helper för att slippa duplicera admin-check i varje route.

## Arkitekturbeslut

1. **Sidebar, inte horisontell nav** -- Admin har färre sektioner än provider, sidebar skalar bättre
2. **Prisma direkt i routes** -- Read-only aggregeringar behöver inte repository-lager
3. **`requireAdmin()` helper** -- Extrahera 8-raders admin-check till återanvändbar funktion
4. **Middleware-fix** -- Lägg till `/admin/:path*` och `/api/admin/:path*` i middleware matcher + isAdmin-check
5. **Mobil: Sheet** -- Sidebar kollapsar till Sheet (slide-out) på mobil, INTE BottomTabBar

---

## Fas 1: Foundation

### 1.1 Admin auth helper
- **Ny:** `src/lib/admin-auth.ts` -- `requireAdmin(session)` som kastar 403-Response om ej admin
- **Ny:** `src/lib/admin-auth.test.ts` -- Tester: admin passerar, icke-admin 403, saknad user 403
- **Referens:** Befintlig check i `src/app/api/admin/verification-requests/[id]/route.ts` rad 17-25

### 1.2 Middleware-fix
- **Ändra:** `middleware.ts`
  - Lägg till `"/admin/:path*"`, `"/api/admin/:path*"` i `config.matcher`
  - Lägg till isAdmin-check: `session.user.isAdmin` finns redan i JWT (satt i `auth.config.ts` rad 17)
  - Icke-admin som försöker nå admin-sida -> redirect till `/`
  - Icke-admin API-anrop -> 403 JSON

### 1.3 AdminLayout + AdminNav
- **Ny:** `src/components/layout/AdminLayout.tsx` -- Wrapper: `Header` + `AdminNav` + `<main>`
- **Ny:** `src/components/layout/AdminNav.tsx` -- Sidebar med ikoner + labels
  - Desktop: Fast sidebar `w-56`, links med active-state (`bg-green-50 text-green-700`)
  - Mobil: Sheet (hamburger-knapp) med samma links
  - Nav-items: Översikt, Användare, Bokningar, Leverantörer, Verifieringar, Integrationer, System
  - **Referens:** `src/components/layout/ProviderLayout.tsx` (mönster), `src/components/ui/sheet.tsx` (mobil)

### 1.4 Dashboard-sida + stats API
- **Ny:** `src/app/api/admin/stats/route.ts` -- GET, returnerar KPIs
- **Ny:** `src/app/api/admin/stats/route.test.ts`
- **Ny:** `src/app/admin/page.tsx` -- Dashboard med KPI-kort i grid

**GET /api/admin/stats** returnerar:
```
{
  users: { total, customers, providers, newThisMonth },
  bookings: { total, pending, confirmed, completed, cancelled, completedThisMonth },
  providers: { total, active, verified, pendingVerifications },
  revenue: { totalCompleted, thisMonth }
}
```
Implementation: `Promise.all([prisma.user.count(), prisma.booking.groupBy(), prisma.payment.aggregate(), ...])`

**Dashboard-sida:** 4 KPI-kort (grid `md:grid-cols-2 lg:grid-cols-4`) + "Väntande verifieringar"-badge + senaste bokningar (limit 5)

### 1.5 Användarhantering
- **Ny:** `src/app/api/admin/users/route.ts` -- GET med pagination, sök, filter
- **Ny:** `src/app/api/admin/users/route.test.ts`
- **Ny:** `src/app/admin/users/page.tsx` -- Lista med sök/filter

**GET /api/admin/users?search=&type=customer|provider&page=1&limit=20** returnerar:
```
{
  users: [{ id, email, firstName, lastName, userType, isAdmin, createdAt, emailVerified,
            provider?: { businessName, isVerified, isActive } }],
  total, page, totalPages
}
```
**Säkerhet:** `select` -- aldrig `passwordHash`. Sök via `contains` (case-insensitive) på email, firstName, lastName.

### 1.6 Migrera verifieringar + uppdatera nav-länkar
- **Ändra:** `src/app/admin/verifications/page.tsx` -- Byt `CustomerLayout` till `AdminLayout`
- **Ändra:** `src/components/layout/Header.tsx` -- Admin-länk pekar till `/admin` istället för `/admin/verifications`

---

## Fas 2: Boknings- och leverantörsöversikt

### 2.1 Bokningsöversikt
- **Ny:** `src/app/api/admin/bookings/route.ts` -- GET med status-filter, datumintervall, pagination
- **Ny:** `src/app/api/admin/bookings/route.test.ts`
- **Ny:** `src/app/admin/bookings/page.tsx`

**GET /api/admin/bookings?status=&from=&to=&page=1&limit=20** returnerar:
```
{
  bookings: [{ id, bookingDate, startTime, endTime, status, customerName, providerBusinessName,
               serviceName, isManualBooking }],
  total, page, totalPages
}
```

### 2.2 Leverantörsöversikt
- **Ny:** `src/app/api/admin/providers/route.ts` -- GET med filter, sortering
- **Ny:** `src/app/api/admin/providers/route.test.ts`
- **Ny:** `src/app/admin/providers/page.tsx`

**GET /api/admin/providers?verified=true|false&active=true|false&page=1&limit=20** returnerar:
```
{
  providers: [{ id, businessName, city, isVerified, isActive, createdAt,
                bookingCount, serviceCount, averageRating, hasFortnox }],
  total, page, totalPages
}
```
Implementation: Prisma query med `_count` på bookings/services, subquery för avg rating, join med FortnoxConnection.

---

## Fas 3: Integrationer + System

### 3.1 Integrationsstatus
- **Ny:** `src/app/api/admin/integrations/route.ts` -- GET
- **Ny:** `src/app/api/admin/integrations/route.test.ts`
- **Ny:** `src/app/admin/integrations/page.tsx`

**GET /api/admin/integrations** returnerar:
```
{
  fortnox: {
    connections: [{ providerId, businessName, connectedAt, tokenExpiresAt }],
    totalConnected: number
  },
  payments: {
    total, succeeded, pending, failed,
    totalRevenue: number
  }
}
```

### 3.2 Systemstatus
- **Ny:** `src/app/api/admin/system/route.ts` -- GET
- **Ny:** `src/app/api/admin/system/route.test.ts`
- **Ny:** `src/app/admin/system/page.tsx`

**GET /api/admin/system** returnerar:
```
{
  database: { healthy: boolean, responseTimeMs: number },
  cron: { lastReminderRun: string | null, remindersCount: number },
  tables: { [tableName]: rowCount },
  version: string
}
```
Implementation: `SELECT 1` med timing, senaste notification med type `REMINDER_REBOOK`, `prisma.$queryRaw` för table counts, `package.json` version.

---

## Filstruktur (totalt ~25 nya/ändrade filer)

```
src/
  lib/
    admin-auth.ts                      # NY: requireAdmin() helper
    admin-auth.test.ts                 # NY: tester
  components/layout/
    AdminLayout.tsx                    # NY: layout wrapper
    AdminNav.tsx                       # NY: sidebar (desktop + Sheet mobil)
    Header.tsx                         # ÄNDRA: admin-länk -> /admin
  app/admin/
    page.tsx                           # NY: dashboard
    users/page.tsx                     # NY: användarhantering
    bookings/page.tsx                  # NY: bokningsöversikt
    providers/page.tsx                 # NY: leverantörsöversikt
    integrations/page.tsx              # NY: integrationsstatus
    system/page.tsx                    # NY: systemhälsa
    verifications/page.tsx             # ÄNDRA: byt till AdminLayout
  app/api/admin/
    stats/route.ts + route.test.ts     # NY: dashboard KPIs
    users/route.ts + route.test.ts     # NY: användarlista
    bookings/route.ts + route.test.ts  # NY: bokningslista
    providers/route.ts + route.test.ts # NY: leverantörslista
    integrations/route.ts + route.test.ts  # NY: integrationsstatus
    system/route.ts + route.test.ts    # NY: systemhälsa
  middleware.ts                        # ÄNDRA: lägg till admin i matcher
```

## TDD-ordning

Per fas, för varje API-route:
1. **RED:** Skriv route.test.ts (happy path, 401, 403, pagination, filter)
2. **GREEN:** Implementera route.ts
3. **UI:** Bygg sidan som konsumerar API:et
4. **Verify:** `npm run test:run` + `npm run typecheck` per fas

## Verifiering

- `npm run test:run` -- alla enhetstester gröna
- `npm run typecheck` -- 0 errors
- Manuellt: logga in som admin, navigera alla 7 admin-sidor, verifiera att data visas
- Verifiera att icke-admin blockeras i middleware (redirect + 403)
- Verifiera mobil: sidebar kollapsar till Sheet
- Uppdatera `docs/API.md` med alla nya admin-endpoints
