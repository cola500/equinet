-- S14-4: RLS WRITE-policies on core domain tables (defense-in-depth)
-- Writes currently go through Prisma (service_role, bypasses RLS).
-- These policies protect against future Supabase-client writes.
-- No FORCE ROW LEVEL SECURITY -- service_role must continue to bypass.

-- =============================================================================
-- 1. Booking -- provider INSERT/UPDATE own bookings
-- =============================================================================

CREATE POLICY booking_provider_insert ON public."Booking"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    "providerId" = rls_provider_id()
  );

CREATE POLICY booking_provider_update ON public."Booking"
  FOR UPDATE
  TO authenticated
  USING (
    "providerId" = rls_provider_id()
  );

-- =============================================================================
-- 2. Booking -- customer INSERT own bookings
-- =============================================================================

CREATE POLICY booking_customer_insert ON public."Booking"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    "customerId" = auth.uid()::text
  );

CREATE POLICY booking_customer_update ON public."Booking"
  FOR UPDATE
  TO authenticated
  USING (
    "customerId" = auth.uid()::text
  );

-- =============================================================================
-- 3. Service -- provider INSERT/UPDATE/DELETE own services
-- =============================================================================

CREATE POLICY service_provider_insert ON public."Service"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    "providerId" = rls_provider_id()
  );

CREATE POLICY service_provider_update ON public."Service"
  FOR UPDATE
  TO authenticated
  USING (
    "providerId" = rls_provider_id()
  );

CREATE POLICY service_provider_delete ON public."Service"
  FOR DELETE
  TO authenticated
  USING (
    "providerId" = rls_provider_id()
  );

-- =============================================================================
-- 4. Horse -- owner INSERT/UPDATE own horses
-- =============================================================================

CREATE POLICY horse_owner_insert ON public."Horse"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    "ownerId" = auth.uid()::text
  );

CREATE POLICY horse_owner_update ON public."Horse"
  FOR UPDATE
  TO authenticated
  USING (
    "ownerId" = auth.uid()::text
  );

-- =============================================================================
-- 5. CustomerReview -- customer INSERT/UPDATE own reviews
-- =============================================================================

CREATE POLICY review_customer_insert ON public."CustomerReview"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    "customerId" = auth.uid()::text
  );

CREATE POLICY review_customer_update ON public."CustomerReview"
  FOR UPDATE
  TO authenticated
  USING (
    "customerId" = auth.uid()::text
  );

-- =============================================================================
-- 6. CustomerReview -- provider UPDATE (reply to reviews about them)
-- =============================================================================

CREATE POLICY review_provider_update ON public."CustomerReview"
  FOR UPDATE
  TO authenticated
  USING (
    "providerId" = rls_provider_id()
  );

-- =============================================================================
-- 7. Notification -- user UPDATE own notifications (mark as read)
-- =============================================================================

CREATE POLICY notification_user_update ON public."Notification"
  FOR UPDATE
  TO authenticated
  USING (
    "userId" = auth.uid()::text
  );

-- =============================================================================
-- 8. BookingSeries -- provider INSERT/UPDATE own series
-- =============================================================================

CREATE POLICY booking_series_provider_insert ON public."BookingSeries"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    "providerId" = rls_provider_id()
  );

CREATE POLICY booking_series_provider_update ON public."BookingSeries"
  FOR UPDATE
  TO authenticated
  USING (
    "providerId" = rls_provider_id()
  );

-- =============================================================================
-- NOTE: No write policies on Payment or Notification INSERT.
-- Payment writes are system-only (Stripe webhooks, manual admin).
-- Notification INSERT is system-only (triggered by domain events).
-- Both use service_role (Prisma) which bypasses RLS.
-- =============================================================================
