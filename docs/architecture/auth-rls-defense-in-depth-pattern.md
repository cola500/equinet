---
title: "Pattern: Dubbelt skyddslager (Auth + RLS)"
description: "Defense-in-depth for dataaccess: applikationslager + databaslager skyddar mot IDOR, privilege escalation och direktaccess"
category: architecture
status: active
last_updated: 2026-04-17
tags: [security, auth, rls, pattern, idor]
related:
  - docs/architecture/patterns.md
  - docs/architecture/database.md
  - docs/security/rls-findings.md
sections:
  - Problemet
  - Losningen -- tva lager
  - Lager 1 -- Applikation (ownership guards)
  - Lager 2 -- Databas (RLS)
  - Varfor bada behovs
  - Implementationssteg
  - Nar anvanda
  - Nar INTE anvanda
  - Kodreferenser
---

# Pattern: Dubbelt skyddslager (Auth + RLS)

## Problemet

En API route som hamtar en bokning med `prisma.booking.findUnique({ where: { id } })` litar pa att `id` verkligen tillhor den inloggade anvandaren. Om en angripare gassar ett annat booking-ID far de nagon annans data -- en klassisk IDOR-sarbarhet (Insecure Direct Object Reference).

Att lagga till en manuell check efterat (`if (booking.providerId !== session.providerId)`) ar battre, men har ett TOCTOU-problem (time-of-check-time-of-use): mellan kontrollen och anvandningen kan datan ha andrats.

## Losningen -- tva lager

Equinet anvander **tva oberoende skyddslager** som fangar varandras luckor:

```
Request -> Auth (session) -> Ownership guard (Prisma WHERE) -> Data
                                    ^
                                    |
                          Lager 1: Applikation
                          
Request -> Supabase -> RLS policy -> Data
                          ^
                          |
                Lager 2: Databas (om nagon gar forbi app-lagret)
```

## Lager 1 -- Applikation (ownership guards)

Ownership checkas **atomart i WHERE-satsen**, inte i en separat `if`-sats:

```typescript
// RATT: Atomisk ownership-check (forhindrar IDOR + race conditions)
async findByIdForProvider(id: string, providerId: string) {
  return prisma.booking.findFirst({
    where: { id, providerId },  // Bada villkor i samma query
    select: { /* bara de falt UI:t behover */ }
  })
}

// FEL: Separat check (TOCTOU-risk)
async findById(id: string) {
  const booking = await prisma.booking.findUnique({ where: { id } })
  if (booking.providerId !== providerId) throw new Error("Denied")
  return booking
}
```

### Namnkonvention

- `findByIdForProvider(id, providerId)` -- leverantor ager resursen
- `findByIdForCustomer(id, customerId)` -- kund ager resursen
- `findByIdForOwner(id, ownerId)` -- generisk agare

Metoden returnerar `null` om resursen inte finns ELLER om agaren inte matchar. API-routen returnerar 404 i bada fallen (avsloja aldrig att resursen existerar for en annan anvandare).

### Var hamtas providerId/customerId?

**ALLTID fran sessionen**, aldrig fran request body:

```typescript
const session = await auth()
const providerId = session.user.providerId  // Fran JWT claims
// ALDRIG: const { providerId } = await request.json()
```

## Lager 2 -- Databas (RLS)

Row Level Security ar aktiverat pa alla karndomantabeller med deny-all-default:

```sql
-- Deny all (ingen policy = inget tillgang)
ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;

-- Provider kan se sina egna bokningar
CREATE POLICY "provider_read_own_bookings" ON "Booking"
  FOR SELECT TO authenticated
  USING (rls_provider_id() = "providerId");

-- Kund kan se sina egna bokningar
CREATE POLICY "customer_read_own_bookings" ON "Booking"
  FOR SELECT TO authenticated
  USING (auth.uid()::text = "customerId");
```

`rls_provider_id()` ar en PL/pgSQL-funktion som laser `providerId` fran JWT `app_metadata` (satt av Supabase Custom Access Token Hook).

### Prisma och RLS

Prisma anvander `service_role` som **bypassar RLS**. Det ar medvetet -- applikationslagret (Lager 1) skyddar istallet. RLS ar ett extra skyddsnatt om:

1. Nagon gar direkt mot Supabase med `anon`-nyckeln
2. En bugg i app-lagret glommer ownership-checken
3. En ny route laggs till utan att folja monstret

## Varfor bada behovs

| Scenario | Lager 1 (app) | Lager 2 (RLS) |
|----------|--------------|---------------|
| Normal API request | Skyddar (ownership i WHERE) | Bypassad (service_role) |
| Direkt PostgREST-anrop | Ingen effekt | Skyddar (deny-all) |
| Ny route utan ownership guard | Ingen effekt | Skyddar (policies) |
| Bugg i RLS-policy | Ingen effekt | Felaktig | App-lagret skyddar anda |
| TOCTOU-attack | Skyddar (atomisk WHERE) | Inte relevant |

**Nyckelpunkten:** Inget enskilt lager ar perfekt. Tva oberoende lager gor att en bugg i det ena inte leder till datalachage.

## Implementationssteg

### For en ny karndomantabell

1. **Skapa repository** med `findByIdForProvider`/`findByIdForCustomer`
2. **Anvand atomisk WHERE** -- aldrig separat `if`-check
3. **Returnera null** om inte hittad (route returnerar 404)
4. **Aktivera RLS** pa tabellen: `ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;`
5. **Skapa policies** for authenticated-rollen (en per aktorstyp)
6. **Testa RLS** med bevistest i `src/__tests__/rls/`
7. **Verifiera** att `providerId`/`customerId` hamtas fran session, aldrig fran request

### For en ny API route pa befintlig domantabell

1. **Anvand befintlig repository** -- anropa aldrig `prisma.x.findUnique({ where: { id } })` direkt
2. **Anvand `withApiHandler`** for auth + rate limiting ur ladan
3. **Kolla att session.user.providerId/customerId** anvands, inte request body

## Nar anvanda

- **Alla karndomaner** (Booking, Horse, Provider, Service, CustomerReview, Follow, Subscription, Stable, GroupBooking)
- **Alla routes som hamtar/andrar data som tillhor en specifik anvandare**
- **Nar tabellen har en `providerId` eller `customerId` kolumn**

## Nar INTE anvanda

- **Publika endpoints** (sok efter leverantorer, publika recensioner) -- ingen agare att checka
- **Stoddomaner utan sensitivt data** (AvailabilitySchedule, AvailabilityException) -- Prisma direkt ar OK, men WHERE pa providerId behovs anda
- **Admin-routes** -- checkar `isAdmin` istallet for ownership
- **Tabeller utan `providerId`/`customerId`** -- RLS-policies finns anda men ownership guard i app-lagret ar annorlunda

## Kodreferenser

### Applikationslager (ownership guards)

| Domantabell | Repository-metod | Fil |
|-------------|-----------------|-----|
| Booking | `findByIdForProvider`, `findByIdForCustomer` | `src/infrastructure/persistence/booking/PrismaBookingRepository.ts` |
| Horse | `findByIdForOwner` | `src/infrastructure/persistence/horse/HorseRepository.ts` |
| Service | `findByIdForProvider` | (via booking/service query) |
| CustomerReview | `findByIdForProvider` | `src/infrastructure/persistence/customer-review/CustomerReviewRepository.ts` |
| Review | `findByIdForCustomer` | `src/infrastructure/persistence/review/ReviewRepository.ts` |
| GroupBooking | `findByIdForCreator` | `src/infrastructure/persistence/group-booking/GroupBookingRepository.ts` |
| Stable | `findByIdForOwner` | `src/infrastructure/persistence/stable/PrismaStableRepository.ts` |

### Databaslager (RLS)

- **28 policies** pa 7 karndomantabeller
- **24 bevistester** i `src/__tests__/rls/rls-proof.integration.test.ts`
- **Policy-definitioner** i Supabase (migrationer under `prisma/migrations/`)
- **Custom Access Token Hook**: PL/pgSQL-funktion som injicerar `providerId`, `userType`, `isAdmin` i JWT `app_metadata`

### Relaterade dokument

- [database.md -- Sakerhetslager](database.md) (oversikt av alla 4 lager)
- [rls-findings.md](../security/rls-findings.md) (detaljerade testresultat)
- [patterns.md](patterns.md) (katalog-entry)
