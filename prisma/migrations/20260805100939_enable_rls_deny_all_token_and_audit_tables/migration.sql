-- Security audit finding (2026-08-05): these 6 tables had RLS disabled while
-- also carrying Supabase's default full-CRUD grants to anon/authenticated,
-- meaning they were fully readable/writable via the public Data API with no
-- authentication at all. Same root cause class as BookingSeries
-- (20260805090430_enable_rls_booking_series).
--
-- Verified server-only access for all 6 (see audit): every read/write goes
-- through Prisma, which connects as the `postgres` role (bypasses RLS by
-- design) or through service_role. No browser/PostgREST client code, no
-- Edge Functions, no triggers touch any of these tables. Enabling RLS with a
-- deny-all policy therefore has no functional impact on existing code paths.
--
-- Confirmed live exposure at audit time: AdminAuditLog had 52 anon-readable
-- rows in production (admin action log incl. IP addresses) and 8 in staging;
-- StripeWebhookEvent had 4 anon-readable rows in staging.
--
-- Policy style matches the existing "Deny all via API" pattern already used
-- on Booking, User, Payment, Route, RouteOrder, RouteStop, EmailVerificationToken,
-- Provider, Notification (FOR ALL, TO public, USING (false) -- Postgres applies
-- the same expression as WITH CHECK for INSERT/UPDATE when omitted on an ALL
-- policy, so no explicit WITH CHECK clause is needed).
--
-- Safe: ENABLE ROW LEVEL SECURITY is idempotent (no-op if already enabled).

ALTER TABLE public."PasswordResetToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON public."PasswordResetToken"
  FOR ALL
  TO public
  USING (false);

ALTER TABLE public."CustomerInviteToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON public."CustomerInviteToken"
  FOR ALL
  TO public
  USING (false);

ALTER TABLE public."StableInviteToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON public."StableInviteToken"
  FOR ALL
  TO public
  USING (false);

ALTER TABLE public."MobileToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON public."MobileToken"
  FOR ALL
  TO public
  USING (false);

ALTER TABLE public."AdminAuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON public."AdminAuditLog"
  FOR ALL
  TO public
  USING (false);

ALTER TABLE public."StripeWebhookEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON public."StripeWebhookEvent"
  FOR ALL
  TO public
  USING (false);
