---
title: "S14-1: RLS-policies på kärndomäner"
description: "Skapa READ-policies på alla kärndomäners tabeller via Prisma-migration"
category: plan
status: active
last_updated: 2026-04-04
sections:
  - Mål
  - Nuläge
  - Tabeller och policies
  - Approach
  - Filer som ändras/skapas
  - Testplan
  - Risker
---

# S14-1: RLS-policies på kärndomäner

## Mål

Skapa SELECT-policies på kärndomänernas tabeller så att:
- Provider ser bara sin egen data (via `providerId` i JWT app_metadata)
- Kund ser bara sin egen data (via `auth.uid()`)
- Anon ser ingenting (RLS deny-all redan aktivt)
- service_role (Prisma) kringgår RLS (ingen `FORCE ROW LEVEL SECURITY`)

## Nuläge

- RLS **enabled** på alla 21+ tabeller (migration `20260204120000_enable_rls`) -- deny-all
- **1 befintlig policy**: `booking_provider_read` på Booking (från PoC S10-5)
- Custom Access Token Hook deployad: JWT innehåller `app_metadata.providerId`, `app_metadata.userType`, `app_metadata.isAdmin`
- `auth.uid()` = User.id (synkat via trigger `handle_new_user`)

## Tabeller och policies

| # | Tabell | Policy-namn | Villkor | Kommentar |
|---|--------|------------|---------|-----------|
| 1 | **Booking** | `booking_provider_read` | `"providerId" = jwt->providerId` | FINNS redan |
| 2 | **Booking** | `booking_customer_read` | `"customerId" = auth.uid()` | NY |
| 3 | **Payment** | `payment_provider_read` | JOIN Booking: provider | NY |
| 4 | **Payment** | `payment_customer_read` | JOIN Booking: kund | NY |
| 5 | **Service** | `service_provider_read` | `"providerId" = jwt->providerId` | NY |
| 6 | **Service** | `service_public_read` | `"isActive" = true` (alla autentiserade) | NY -- kunder måste se tjänster vid bokning |
| 7 | **Horse** | `horse_owner_read` | `"ownerId" = auth.uid()` | NY |
| 8 | **Horse** | `horse_provider_read` | EXISTS ProviderCustomer | NY -- provider ser kundens hästar |
| 9 | **CustomerReview** | `review_provider_read` | `"providerId" = jwt->providerId` | NY |
| 10 | **CustomerReview** | `review_customer_read` | `"customerId" = auth.uid()` | NY |
| 11 | **Notification** | `notification_user_read` | `"userId" = auth.uid()` | NY |

### Design-beslut

1. **Payment via JOIN**: Payment har inget eget `providerId`/`customerId` -- måste gå via Booking-relation. Subquery: `EXISTS (SELECT 1 FROM "Booking" WHERE id = "Payment"."bookingId" AND ...)`.

2. **Service dubbla policies**: Provider ser alla sina (även inaktiva). Kunder ser bara aktiva tjänster (för bokningsflödet). Postgres OR:ar permissive policies automatiskt.

3. **Horse via ProviderCustomer**: Provider ser hästar som tillhör deras kunder. `EXISTS (SELECT 1 FROM "ProviderCustomer" WHERE "providerId" = jwt->providerId AND "customerId" = "Horse"."ownerId")`.

4. **Ingen FORCE ROW LEVEL SECURITY**: service_role (Prisma) ska kringgå RLS för writes, admin, cron.

5. **Bara SELECT-policies**: Writes görs via Prisma (service_role). Write-policies är S14-4 (backlog).

## Approach

1. **En Prisma-migration** med all SQL (alla policies i en fil)
2. Timestamp: `20260404120000_rls_read_policies`
3. Policies skapas med `CREATE POLICY ... FOR SELECT TO authenticated USING (...)`
4. Hjälpfunktion: `rls_provider_id()` som extraherar providerId ur JWT (DRY)

### Hjälpfunktion

```sql
CREATE OR REPLACE FUNCTION public.rls_provider_id()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT (auth.jwt()->'app_metadata'->>'providerId')
$$;
```

Detta gör policies läsbara: `"providerId" = rls_provider_id()` istället för det långa uttrycket.

## Filer som ändras/skapas

| Fil | Ändring |
|-----|---------|
| `prisma/migrations/20260404120000_rls_read_policies/migration.sql` | NY -- all policy-SQL |
| `src/__tests__/rls/rls-policies.test.ts` | NY -- tester att policies finns |
| `docs/sprints/status.md` | Uppdatera story-status |

## Testplan

Testerna verifierar att migrerings-SQL:en är korrekt genom att:

1. **Migrations-test**: Verifiera att migrationsfilen finns och innehåller rätt policies
2. **Policy-inventering**: Test som listar förväntade policy-namn och verifierar att de alla finns i SQL:en

> **OBS:** Faktisk RLS-filtrering (Provider A ser inte Provider B:s data) testas i S14-5 (RLS-bevistest). S14-1 fokuserar på att policies skapas korrekt.

## Risker

| Risk | Sannolikhet | Konsekvens | Åtgärd |
|------|------------|------------|--------|
| Horse-policy med subquery blir långsam | Låg | Medel | Index finns på ProviderCustomer(providerId, customerId) |
| Payment-policy med subquery blir långsam | Låg | Medel | Index finns på Booking(id) |
| Befintlig `booking_provider_read` krockar med ny hjälpfunktion | Låg | Låg | Uppdatera befintlig policy att använda `rls_provider_id()` |
| Policies blockerar Supabase-klient reads i S14-2 | Låg | Medel | Policies designade för S14-2:s behov |
