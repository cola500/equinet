-- User SELECT policies for authenticated role
-- Required for Supabase-client queries that JOIN User (e.g. /api/bookings)
-- Without these, RLS blocks LEFT JOIN and customer/provider data becomes null.

-- Providers can read User data for customers they have bookings with
CREATE POLICY user_provider_read ON public."User"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Booking" b
      WHERE b."customerId" = "User"."id"
        AND b."providerId" = (auth.jwt()->'app_metadata'->>'providerId')
    )
  );

-- Users can read their own data
CREATE POLICY user_self_read ON public."User"
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()::text
  );
