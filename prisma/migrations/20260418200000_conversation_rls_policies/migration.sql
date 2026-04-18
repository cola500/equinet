-- S35-1.5: RLS policies + column-level GRANT for Conversation + Message
-- Defense-in-depth: Prisma (service_role) bypasses RLS, but policies protect
-- against direct Supabase client access and route-level guard failures.

-- =============================================================================
-- 1. Enable RLS
-- =============================================================================

ALTER TABLE public."Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Message" ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. Conversation -- READ
-- =============================================================================

CREATE POLICY conversation_customer_read ON public."Conversation"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Booking" b
      WHERE b."id" = "Conversation"."bookingId"
        AND b."customerId" = auth.uid()::text
    )
  );

CREATE POLICY conversation_provider_read ON public."Conversation"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Booking" b
      WHERE b."id" = "Conversation"."bookingId"
        AND b."providerId" = rls_provider_id()
    )
  );

-- =============================================================================
-- 3. Conversation -- INSERT
-- =============================================================================

CREATE POLICY conversation_customer_insert ON public."Conversation"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."Booking" b
      WHERE b."id" = "Conversation"."bookingId"
        AND b."customerId" = auth.uid()::text
    )
  );

CREATE POLICY conversation_provider_insert ON public."Conversation"
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public."Booking" b
      WHERE b."id" = "Conversation"."bookingId"
        AND b."providerId" = rls_provider_id()
    )
  );

-- =============================================================================
-- 4. Message -- READ (via Conversation → Booking)
-- =============================================================================

CREATE POLICY message_customer_read ON public."Message"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Conversation" c
      JOIN public."Booking" b ON b."id" = c."bookingId"
      WHERE c."id" = "Message"."conversationId"
        AND b."customerId" = auth.uid()::text
    )
  );

CREATE POLICY message_provider_read ON public."Message"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public."Conversation" c
      JOIN public."Booking" b ON b."id" = c."bookingId"
      WHERE c."id" = "Message"."conversationId"
        AND b."providerId" = rls_provider_id()
    )
  );

-- =============================================================================
-- 5. Message -- INSERT (sender identity matched against session)
-- =============================================================================

CREATE POLICY message_customer_insert ON public."Message"
  FOR INSERT TO authenticated
  WITH CHECK (
    "senderType" = 'CUSTOMER'
    AND "senderId" = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public."Conversation" c
      JOIN public."Booking" b ON b."id" = c."bookingId"
      WHERE c."id" = "Message"."conversationId"
        AND b."customerId" = auth.uid()::text
    )
  );

CREATE POLICY message_provider_insert ON public."Message"
  FOR INSERT TO authenticated
  WITH CHECK (
    "senderType" = 'PROVIDER'
    AND "senderId" = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public."Conversation" c
      JOIN public."Booking" b ON b."id" = c."bookingId"
      WHERE c."id" = "Message"."conversationId"
        AND b."providerId" = rls_provider_id()
    )
  );

-- =============================================================================
-- 6. Message -- UPDATE (readAt only, recipient only)
--
-- Two-layer protection (D10):
--   Layer 1: Column-level GRANT — authenticated users can only UPDATE readAt.
--            Attempts to update content/senderType/senderId via Supabase client
--            are rejected by the GRANT layer before RLS is even evaluated.
--   Layer 2: USING + WITH CHECK — only the recipient can mark messages as read.
--
-- Prisma (service_role) bypasses both GRANT and RLS — repository explicitly
-- limits `data: { readAt }` in markMessagesAsRead as an extra safeguard.
-- =============================================================================

REVOKE UPDATE ON public."Message" FROM authenticated;
GRANT UPDATE ("readAt") ON public."Message" TO authenticated;

-- Customer marks provider's messages as read
CREATE POLICY message_customer_read_update ON public."Message"
  FOR UPDATE TO authenticated
  USING (
    "senderType" = 'PROVIDER'
    AND EXISTS (
      SELECT 1 FROM public."Conversation" c
      JOIN public."Booking" b ON b."id" = c."bookingId"
      WHERE c."id" = "Message"."conversationId"
        AND b."customerId" = auth.uid()::text
    )
  )
  WITH CHECK (
    "senderType" = 'PROVIDER'
    AND EXISTS (
      SELECT 1 FROM public."Conversation" c
      JOIN public."Booking" b ON b."id" = c."bookingId"
      WHERE c."id" = "Message"."conversationId"
        AND b."customerId" = auth.uid()::text
    )
  );

-- Provider marks customer's messages as read
CREATE POLICY message_provider_read_update ON public."Message"
  FOR UPDATE TO authenticated
  USING (
    "senderType" = 'CUSTOMER'
    AND EXISTS (
      SELECT 1 FROM public."Conversation" c
      JOIN public."Booking" b ON b."id" = c."bookingId"
      WHERE c."id" = "Message"."conversationId"
        AND b."providerId" = rls_provider_id()
    )
  )
  WITH CHECK (
    "senderType" = 'CUSTOMER'
    AND EXISTS (
      SELECT 1 FROM public."Conversation" c
      JOIN public."Booking" b ON b."id" = c."bookingId"
      WHERE c."id" = "Message"."conversationId"
        AND b."providerId" = rls_provider_id()
    )
  );
