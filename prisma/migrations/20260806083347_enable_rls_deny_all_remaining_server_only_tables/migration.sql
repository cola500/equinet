-- Security audit follow-up (2026-08-06): these 6 tables had RLS disabled
-- while carrying Supabase's default full-CRUD grant to anon/authenticated,
-- same root cause class as BookingSeries and the 6 previously-fixed
-- server-only tables (20260805090430, 20260805100939).
--
-- Verified server-only access for all 6 (read-only discovery, see
-- docs/security/supabase-rls-security-audit-2026-08-06.md): every
-- read/write goes through Prisma (connects as the `postgres` role, bypasses
-- RLS by design). No browser/PostgREST client code, no Edge Functions, no
-- Realtime subscriptions (none of the 6 are in the supabase_realtime
-- publication), no triggers, no views, no RPC function bodies reference any
-- of them. The public read path (GET /api/stables) goes through the app's
-- own Next.js route + Prisma, never through PostgREST. Enabling RLS with a
-- deny-all policy therefore has no functional impact on existing code paths.
--
-- Confirmed before writing this migration: none of the 6 tables have any
-- existing policy or RLS already enabled in either staging or production
-- (relrowsecurity = false, pg_policies empty, in both environments) -- so
-- no risk of duplicate policy names.
--
-- Policy style matches the existing "Deny all via API" pattern already used
-- on Booking, User, Payment, Route, RouteOrder, RouteStop,
-- EmailVerificationToken, Provider, Notification, PasswordResetToken,
-- CustomerInviteToken, StableInviteToken, MobileToken, AdminAuditLog,
-- StripeWebhookEvent (FOR ALL, TO public, USING (false)).
--
-- Safe: ENABLE ROW LEVEL SECURITY is idempotent (no-op if already enabled).

ALTER TABLE public."BugReport" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON public."BugReport"
  FOR ALL
  TO public
  USING (false);

ALTER TABLE public."DeviceToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON public."DeviceToken"
  FOR ALL
  TO public
  USING (false);

ALTER TABLE public."MunicipalityWatch" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON public."MunicipalityWatch"
  FOR ALL
  TO public
  USING (false);

ALTER TABLE public."ProviderSubscription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON public."ProviderSubscription"
  FOR ALL
  TO public
  USING (false);

ALTER TABLE public."Stable" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON public."Stable"
  FOR ALL
  TO public
  USING (false);

ALTER TABLE public."StableSpot" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deny all via API" ON public."StableSpot"
  FOR ALL
  TO public
  USING (false);
