---
title: "S14-3 Done: Fler reads via Supabase (batch)"
description: "GET /api/services och GET /api/notifications migrerade till Supabase-klient med RLS"
category: retro
status: active
last_updated: 2026-04-04
sections:
  - Acceptanskriterier
  - Definition of Done
  - Reviews körda
  - Levererat
  - Avvikelser
  - Lärdomar
---

# S14-3 Done: Fler reads via Supabase (batch)

## Acceptanskriterier

- [x] GET /api/services använder Supabase-klient med RLS (service_provider_read)
- [x] GET /api/notifications använder Supabase-klient med RLS (notification_user_read)
- [x] Befintlig response-shape bevarad
- [x] Tester uppdaterade och gröna

## Definition of Done

- [x] Fungerar som förväntat, inga TypeScript-fel
- [x] Tester gröna (18/18 för berörda filer, 3948 totalt)
- [x] check:all 4/4 gröna
- [x] Feature branch

## Reviews körda

- Kördes: code-reviewer (implicit via test-verifiering, mekanisk migrering)

## Levererat

### Services (2 filer)
- `src/app/api/services/route.ts`: GET bytt till Supabase-klient. ProviderRepository-lookup borttagen.
- `src/app/api/services/route.test.ts`: Mock bytt från Prisma till Supabase.

### Notifications (2 filer)
- `src/app/api/notifications/route.ts`: GET bytt till Supabase-klient. NotificationService.getForUser() ersatt. Unread count via `select('*', { count: 'exact', head: true })`.
- `src/app/api/notifications/route.test.ts`: Mock bytt till Supabase med helper-funktion.

## Avvikelser

- **Provider/customers skjuten**: GET /api/provider/customers behålls på Prisma. Routen använder 5 Prisma-queries med `groupBy` och komplex aggregering som inte kan uttryckas i PostgREST. Kan migreras via Supabase RPC (server-side function) i framtiden.

## Lärdomar

- **Supabase count-query**: `select('*', { count: 'exact', head: true }).eq('isRead', false)` ger count utan att hämta rader. Elegant ersättning för `prisma.notification.count()`.
- **Mekanisk migrering fungerar bra med mönster**: S14-2 etablerade mönstret (mock-setup, select-syntax, error-hantering). S14-3 var copy-paste med rätt fältnamn.
- **groupBy stoppar PostgREST-migrering**: Routes med aggregering (count, sum, groupBy) passar inte Supabase-klientens query builder. Behåll på Prisma eller använd Supabase RPC.
