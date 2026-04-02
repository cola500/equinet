---
title: "RLS-migrering -- stories i tunna vertikala slices"
description: "Detaljplan för gradvis migrering till Supabase RLS. Varje story är en tunn vertikal slice."
category: plan
status: active
last_updated: 2026-04-02
tags: [rls, supabase, prisma, migration, security]
sections:
  - Principer
  - Slice 1 Infrastruktur
  - Slice 2 Booking read
  - Slice 3 Booking write
  - Slice 4 Payment
  - Slice 5 CustomerReview
  - Slice 6 Horse
  - Slice 7 Cleanup
  - Öppna frågor
---

# RLS-migrering -- stories i tunna vertikala slices

> Bakgrund: `docs/architecture/rls-roadmap.md` + `docs/research/rls-spike.md`
> Varje slice är en fristående story som kan levereras och mergeras separat.
> Ordningen är viktig -- varje slice bygger på föregående.

## Principer

1. **En tabell per slice.** Aldrig migrera två tabeller samtidigt.
2. **Prisma och Supabase parallellt.** Befintliga routes oförändrade tills nya verifierats.
3. **Feature flag per tabell.** `rls_booking`, `rls_payment`, etc. Rollback = flagga av.
4. **Tester bevisar RLS.** Varje slice har ett test som visar att data INTE läcker utan WHERE.
5. **Admin/cron använder service-role.** Dokumenterat och begränsat.

---

## Slice 1: RLS-infrastruktur (grund)

**Effort:** 1 dag
**Beroende:** Inget
**Levererar:** Supabase-klient, auth-helper, service-role-hantering, test-setup

### Uppgifter

1. Skapa `src/infrastructure/supabase/client.ts`:
   - `createAuthenticatedClient(jwt)` -- RLS-skyddad klient
   - `createServiceClient()` -- admin/cron utan RLS
   - Läs `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` från env

2. Skapa `src/infrastructure/supabase/auth-helper.ts`:
   - `getSupabaseJwt(session)` -- generera JWT med `provider_id`/`customer_id` claims
   - Eller: använd Supabase auth med custom claims via `set_config()`

3. Skapa `src/infrastructure/supabase/test-utils.ts`:
   - Helpers för att testa RLS i integrationstester
   - Mock-JWT med olika roller

4. Dokumentera: vilka env-variabler behövs i alla miljöer

### Acceptanskriterier

- [ ] `createAuthenticatedClient()` returnerar typesafe Supabase-klient
- [ ] `createServiceClient()` bypasear RLS
- [ ] Test-helpers fungerar
- [ ] Inga befintliga tester bryts

---

## Slice 2: Booking READ med RLS

**Effort:** 2 dagar
**Beroende:** Slice 1
**Levererar:** RLS-policies på Booking, Supabase-repository för läsning, en ny v2-route

### Uppgifter

1. SQL-migration: aktivera RLS på Booking-tabellen
   ```sql
   ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;
   ALTER TABLE "Booking" FORCE ROW LEVEL SECURITY;

   CREATE POLICY booking_provider_read ON "Booking"
     FOR SELECT USING ("providerId" = current_setting('app.provider_id', TRUE));

   CREATE POLICY booking_customer_read ON "Booking"
     FOR SELECT USING ("customerId" = current_setting('app.customer_id', TRUE));

   CREATE POLICY booking_admin_read ON "Booking"
     FOR SELECT USING (current_setting('app.is_admin', TRUE) = 'true');
   ```

2. Skapa `src/infrastructure/supabase/SupabaseBookingReadRepository.ts`:
   - `findByProvider(providerId)` -- använder authenticated client
   - `findByCustomer(customerId)` -- använder authenticated client
   - Returnerar samma typer som PrismaBookingRepository

3. Skapa `/api/v2/bookings/route.ts`:
   - Feature flag `rls_booking`
   - Använder SupabaseBookingReadRepository
   - Samma response-format som befintlig route

4. **RLS-bevistest:**
   ```typescript
   it("provider cannot read other providers bookings even without WHERE", async () => {
     const client = createAuthenticatedClient(providerAJwt)
     const { data } = await client.from("Booking").select("*")
     // Alla bokningar tillhör provider A -- inga av provider B
     expect(data.every(b => b.providerId === providerAId)).toBe(true)
   })
   ```

### Acceptanskriterier

- [ ] RLS-policy aktiv på Booking
- [ ] v2-route returnerar bara leverantörens bokningar
- [ ] RLS-bevistest passerar
- [ ] Befintliga Prisma-routes oförändrade och gröna
- [ ] Feature flag styr routing

---

## Slice 3: Booking WRITE med RLS

**Effort:** 1-2 dagar
**Beroende:** Slice 2
**Levererar:** INSERT/UPDATE/DELETE policies, write-repository

### Uppgifter

1. SQL-migration: write-policies
   ```sql
   CREATE POLICY booking_provider_insert ON "Booking"
     FOR INSERT WITH CHECK ("providerId" = current_setting('app.provider_id', TRUE));

   CREATE POLICY booking_provider_update ON "Booking"
     FOR UPDATE USING ("providerId" = current_setting('app.provider_id', TRUE));

   CREATE POLICY booking_provider_delete ON "Booking"
     FOR DELETE USING ("providerId" = current_setting('app.provider_id', TRUE));
   ```

2. Utöka SupabaseBookingRepository med write-metoder
3. Migrera confirm/cancel/update routes till v2
4. RLS-bevistest: provider kan INTE uppdatera annans bokning

### Acceptanskriterier

- [ ] Write-policies aktiva
- [ ] v2 confirm/cancel fungerar
- [ ] RLS-bevistest för write
- [ ] Befintliga routes oförändrade

---

## Slice 4: Payment med RLS

**Effort:** 1 dag
**Beroende:** Slice 2 (Booking RLS finns)
**Levererar:** RLS på Payment-tabellen

### Uppgifter

1. SQL: RLS-policies på Payment (via booking-relation)
2. SupabasePaymentRepository
3. Feature flag `rls_payment`
4. RLS-bevistest

### Acceptanskriterier

- [ ] Payment skyddad av RLS
- [ ] Webhook fungerar (service-role)
- [ ] Befintliga routes oförändrade

---

## Slice 5: CustomerReview med RLS

**Effort:** 1 dag
**Beroende:** Slice 1
**Levererar:** RLS på CustomerReview

### Uppgifter

1. SQL: provider ser sina recensioner, kund ser sina
2. SupabaseCustomerReviewRepository
3. Feature flag `rls_customer_review`
4. RLS-bevistest

---

## Slice 6: Horse med RLS

**Effort:** 1 dag
**Beroende:** Slice 1
**Levererar:** RLS på Horse (via ProviderCustomer-relation)

### Uppgifter

1. SQL: provider ser hästar kopplade till sina kunder
2. SupabaseHorseRepository
3. Feature flag `rls_horse`
4. RLS-bevistest

---

## Slice 7: Cleanup och konsolidering

**Effort:** 2 dagar
**Beroende:** Slice 2-6
**Levererar:** Ta bort v1-routes, Prisma-repositories deprecated

### Uppgifter

1. Ta bort feature flags (alla på permanent)
2. Ta bort v1-routes som har v2-ersättningar
3. Markera PrismaBookingRepository som `@deprecated`
4. Uppdatera docs och CLAUDE.md
5. Beslut: fortsätta med Prisma för stöddomäner eller migrera allt?

---

## Tidslinje (uppskattad)

| Slice | Effort | Kumulativt |
|-------|--------|-----------|
| 1 Infrastruktur | 1 dag | 1 dag |
| 2 Booking read | 2 dagar | 3 dagar |
| 3 Booking write | 1-2 dagar | 5 dagar |
| 4 Payment | 1 dag | 6 dagar |
| 5 CustomerReview | 1 dag | 7 dagar |
| 6 Horse | 1 dag | 8 dagar |
| 7 Cleanup | 2 dagar | 10 dagar |
| **Totalt** | **~10 arbetsdagar** | **2 sprintar** |

Varje slice kan pausas efter leverans. Slice 1-2 ger 80% av säkerhetsvärdet.

---

## Öppna frågor (besvaras i slice 1)

1. JWT eller `set_config()`? JWT är renare men kräver att vi genererar tokens.
2. Service-role för admin/cron -- hur begränsar vi åtkomst?
3. Prisma migrate + RLS-policies -- kör vi migrations separat?
4. Lokal testning -- Docker-Postgres med RLS eller Supabase CLI?
