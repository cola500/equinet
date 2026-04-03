-- RLS policy on Booking table for Supabase Auth PoC
-- Providers can only read their own bookings via Supabase client (anon key + user JWT).
-- Prisma (service_role) bypasses RLS -- existing routes are unaffected.

ALTER TABLE public."Booking" ENABLE ROW LEVEL SECURITY;

-- Do NOT use FORCE -- service_role must bypass RLS for Prisma queries.
-- FORCE would apply RLS even to table owners, breaking existing functionality.

CREATE POLICY booking_provider_read ON public."Booking"
  FOR SELECT
  TO authenticated
  USING (
    "providerId" = (auth.jwt()->'app_metadata'->>'providerId')
  );
