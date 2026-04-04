---
title: "S14-2 Plan: Booking reads via Supabase"
description: "Byt GET /api/bookings (provider-path) från Prisma till Supabase-klient med RLS"
category: plan
status: active
last_updated: 2026-04-04
sections:
  - Mål
  - Approach
  - Filer
  - Risker
---

# S14-2: Booking reads via Supabase

## Mål

Byt provider-path i `GET /api/bookings` från Prisma (service_role, kringgår RLS) till Supabase-klient (user JWT, RLS filtrerar). WHERE-villkoret försvinner -- `booking_provider_read` policy hanterar filtrering.

## Approach

1. Behåll `getAuthUser()` för rollbestämning (provider vs customer)
2. Provider-path: Supabase-klient med PostgREST `select` (inklusive relationer)
3. Customer-path: Behåll Prisma (migreras i S14-3)
4. Ingen ändring i response-shape -- Supabase PostgREST returnerar samma struktur
5. RLS eliminerar `WHERE providerId = X` -- JWT:s `app_metadata.providerId` matchar automatiskt

## Filer

| Fil | Ändring |
|-----|---------|
| `src/app/api/bookings/route.ts` | Byt provider-path GET till Supabase-klient |
| `src/app/api/bookings/route.test.ts` | Uppdatera mocks (Supabase istället för Prisma) |

## Risker

- **PostgREST select-syntax**: FK-namn kan skilja sig. Iterera i test.
- **Response-shape**: Supabase returnerar `null` för optional relationer, Prisma returnerar `null` eller utelämnar. Verifiera kompatibilitet.
- **Date-format**: Supabase returnerar ISO-strängar, Prisma returnerar Date-objekt. UI:t kanske redan hanterar båda.
