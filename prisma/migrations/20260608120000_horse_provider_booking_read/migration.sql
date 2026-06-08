-- Horse -- provider reads horses referenced by their own bookings.
--
-- horse_provider_read (20260404120000) only grants access via a ProviderCustomer
-- link, which is created when a provider manually adds a customer — never on
-- booking. A provider therefore could not read the horse on their own booking
-- through the RLS-scoped Supabase client, so the stable name (and breed) never
-- resolved in the provider bookings list. This policy closes that gap with the
-- same EXISTS-via-Booking pattern already used by payment_provider_read.

DROP POLICY IF EXISTS horse_provider_booking_read ON public."Horse";

CREATE POLICY horse_provider_booking_read ON public."Horse"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Booking" b
      WHERE b."horseId" = "Horse"."id"
        AND b."providerId" = rls_provider_id()
    )
  );
