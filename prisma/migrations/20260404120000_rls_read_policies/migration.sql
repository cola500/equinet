-- S14-1: RLS READ-policies on core domain tables
-- Creates SELECT policies so authenticated users only see their own data.
-- service_role (Prisma) bypasses RLS -- no FORCE ROW LEVEL SECURITY.

-- =============================================================================
-- 1. Helper function: extract providerId from JWT app_metadata
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rls_provider_id()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT (auth.jwt()->'app_metadata'->>'providerId')
$$;

-- =============================================================================
-- 2. Update existing PoC policy to use helper function
-- =============================================================================

DROP POLICY IF EXISTS booking_provider_read ON public."Booking";

CREATE POLICY booking_provider_read ON public."Booking"
  FOR SELECT
  TO authenticated
  USING (
    "providerId" = rls_provider_id()
  );

-- =============================================================================
-- 3. Booking -- customer read
-- =============================================================================

CREATE POLICY booking_customer_read ON public."Booking"
  FOR SELECT
  TO authenticated
  USING (
    "customerId" = auth.uid()::text
  );

-- =============================================================================
-- 4. Payment -- provider read (via Booking JOIN)
-- =============================================================================

CREATE POLICY payment_provider_read ON public."Payment"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Booking" b
      WHERE b."id" = "Payment"."bookingId"
        AND b."providerId" = rls_provider_id()
    )
  );

-- =============================================================================
-- 5. Payment -- customer read (via Booking JOIN)
-- =============================================================================

CREATE POLICY payment_customer_read ON public."Payment"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Booking" b
      WHERE b."id" = "Payment"."bookingId"
        AND b."customerId" = auth.uid()::text
    )
  );

-- =============================================================================
-- 6. Service -- provider sees all own services (including inactive)
-- =============================================================================

CREATE POLICY service_provider_read ON public."Service"
  FOR SELECT
  TO authenticated
  USING (
    "providerId" = rls_provider_id()
  );

-- =============================================================================
-- 7. Service -- all authenticated users see active services (for booking flow)
-- =============================================================================

CREATE POLICY service_public_read ON public."Service"
  FOR SELECT
  TO authenticated
  USING (
    "isActive" = true
  );

-- =============================================================================
-- 8. Horse -- owner reads own horses
-- =============================================================================

CREATE POLICY horse_owner_read ON public."Horse"
  FOR SELECT
  TO authenticated
  USING (
    "ownerId" = auth.uid()::text
  );

-- =============================================================================
-- 9. Horse -- provider reads horses of their customers
-- =============================================================================

CREATE POLICY horse_provider_read ON public."Horse"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."ProviderCustomer" pc
      WHERE pc."providerId" = rls_provider_id()
        AND pc."customerId" = "Horse"."ownerId"
    )
  );

-- =============================================================================
-- 10. CustomerReview -- provider reads reviews about them
-- =============================================================================

CREATE POLICY review_provider_read ON public."CustomerReview"
  FOR SELECT
  TO authenticated
  USING (
    "providerId" = rls_provider_id()
  );

-- =============================================================================
-- 11. CustomerReview -- customer reads own reviews
-- =============================================================================

CREATE POLICY review_customer_read ON public."CustomerReview"
  FOR SELECT
  TO authenticated
  USING (
    "customerId" = auth.uid()::text
  );

-- =============================================================================
-- 12. Notification -- user reads own notifications
-- =============================================================================

CREATE POLICY notification_user_read ON public."Notification"
  FOR SELECT
  TO authenticated
  USING (
    "userId" = auth.uid()::text
  );

-- =============================================================================
-- 13. BookingSeries -- provider reads own series
-- =============================================================================

CREATE POLICY booking_series_provider_read ON public."BookingSeries"
  FOR SELECT
  TO authenticated
  USING (
    "providerId" = rls_provider_id()
  );

-- =============================================================================
-- 14. BookingSeries -- customer reads own series
-- =============================================================================

CREATE POLICY booking_series_customer_read ON public."BookingSeries"
  FOR SELECT
  TO authenticated
  USING (
    "customerId" = auth.uid()::text
  );
