-- RLS Spike: Setup rls_test schema with Booking table + RLS policy
-- Run via: npx tsx scripts/rls-spike/test-rls.ts (handles setup automatically)
-- Or manually in Supabase SQL Editor

-- 1. Create isolated schema
CREATE SCHEMA IF NOT EXISTS rls_test;

-- 2. Note: Prisma migrate deploy with ?schema=rls_test creates all tables.
--    After migration, run the following to enable RLS:

-- 3. Enable RLS on Booking
ALTER TABLE rls_test."Booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE rls_test."Booking" FORCE ROW LEVEL SECURITY;

-- 4. Create provider READ policy
CREATE POLICY booking_provider_read ON rls_test."Booking"
  FOR SELECT USING ("providerId" = current_setting('app.provider_id', TRUE));

-- 5. For Test 8 (no-policy fallback): Enable RLS on Service WITHOUT policy
ALTER TABLE rls_test."Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE rls_test."Service" FORCE ROW LEVEL SECURITY;
-- Intentionally NO policy -- should deny all reads

-- 6. Cleanup command (run when done):
-- DROP SCHEMA rls_test CASCADE;
