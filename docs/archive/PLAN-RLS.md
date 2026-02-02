# Plan: Row Level Security (RLS) för Supabase

## Bakgrund

Supabase varnar för att våra tabeller saknar RLS (Row Level Security). Detta är en säkerhetsrisk eftersom:

- Supabase exponerar tabeller via PostgREST API automatiskt
- Om någon hittar din Supabase-URL + anon-key kan de läsa/skriva all data
- RLS är Supabase's sätt att skydda data på databasnivå

## Nuvarande status

**Tabeller utan RLS:**
- User, Provider, Service, Booking, Notification
- RouteOrder, Route, RouteStop, Availability
- Payment, EmailVerificationToken, AvailabilityException

**Varför det fungerar ändå:**
- Vi använder Prisma med service-role-key (bypasses RLS)
- Authorization sker i app-koden (API routes)
- Supabase's anon-key är inte exponerad i frontend

## Två alternativ

### Alternativ A: Aktivera RLS (Rekommenderat för produktion)

**Fördelar:**
- Defense-in-depth - skydd även om app-koden har buggar
- Supabase best practice
- Inga fler varningar

**Nackdelar:**
- Kräver SQL-policies för varje tabell
- Mer komplexitet
- Prisma måste använda rätt context

### Alternativ B: Stäng av PostgREST API

**Fördelar:**
- Snabb fix
- Inget att ändra i koden

**Nackdelar:**
- Kan inte använda Supabase JS-client i framtiden
- Löser inte grundproblemet

## Rekommendation: Alternativ A

Implementera RLS stegvis. Vi använder Prisma med service-role som har full access, men RLS skyddar mot direkt API-access.

## Implementation (steg för steg)

### Fas 1: Grundläggande RLS (blockera allt via API)

Enklaste approachen - blockera all access via PostgREST, tillåt endast via Prisma.

```sql
-- Kör i Supabase SQL Editor för VARJE tabell:

-- User
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON "User" FOR ALL USING (false);

-- Provider
ALTER TABLE "Provider" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON "Provider" FOR ALL USING (false);

-- Service
ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON "Service" FOR ALL USING (false);

-- Booking
ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON "Booking" FOR ALL USING (false);

-- Notification
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON "Notification" FOR ALL USING (false);

-- RouteOrder
ALTER TABLE "RouteOrder" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON "RouteOrder" FOR ALL USING (false);

-- Route
ALTER TABLE "Route" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON "Route" FOR ALL USING (false);

-- RouteStop
ALTER TABLE "RouteStop" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON "RouteStop" FOR ALL USING (false);

-- Availability
ALTER TABLE "Availability" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON "Availability" FOR ALL USING (false);

-- AvailabilityException
ALTER TABLE "AvailabilityException" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON "AvailabilityException" FOR ALL USING (false);

-- Payment
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON "Payment" FOR ALL USING (false);

-- EmailVerificationToken
ALTER TABLE "EmailVerificationToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON "EmailVerificationToken" FOR ALL USING (false);
```

**Viktigt:** Prisma använder service-role-key som bypasses RLS, så appen fortsätter fungera.

### Fas 2: (Valfritt) Granulära policies

Om vi i framtiden vill använda Supabase JS-client från frontend, kan vi lägga till granulära policies:

```sql
-- Exempel: Användare kan läsa sina egna bokningar
CREATE POLICY "Users can read own bookings" ON "Booking"
FOR SELECT USING (
  auth.uid()::text = "customerId"
);

-- Exempel: Providers kan läsa sina tjänster
CREATE POLICY "Providers can read own services" ON "Service"
FOR SELECT USING (
  "providerId" IN (
    SELECT id FROM "Provider" WHERE "userId" = auth.uid()::text
  )
);
```

## Verifiering

Efter att ha kört SQL:

1. Kör appen - allt ska fungera som vanligt (Prisma bypasses RLS)
2. Kolla Supabase Dashboard → Database → Linter → Inga RLS-varningar
3. Testa att anon-key inte kan läsa data:
   ```bash
   curl 'https://[PROJECT].supabase.co/rest/v1/User' \
     -H 'apikey: [ANON_KEY]' \
     -H 'Authorization: Bearer [ANON_KEY]'
   # Ska returnera tom array eller error
   ```

## Risker

- **Låg risk:** Om SQL har fel syntax får vi error, men inget förstörs
- **Mitigation:** Kör på staging först om möjligt
- **Rollback:** `DROP POLICY` och `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`

## Tidsuppskattning

- Fas 1 (blockera allt): ~15 minuter
- Fas 2 (granulära policies): ~2-4 timmar (om det behövs)

## Nästa steg

1. Kopiera SQL från Fas 1
2. Kör i Supabase SQL Editor
3. Verifiera att appen fungerar
4. Kolla att linter-varningarna försvinner
