-- Staging/production parity fix (2026-09-06).
--
-- Root cause: these ten tables ended up with RLS enabled in production but
-- disabled in staging. This is NOT ordinary migration drift (staging did not
-- simply skip a known, committed migration) -- it is historical/manual state
-- that was never fully captured in either migration tracking mechanism
-- (Prisma's `_prisma_migrations` or Supabase-native `schema_migrations`).
-- See docs/security/supabase-rls-security-audit-2026-08-06.md, section
-- "Uppföljande discovery 2026-09-06" for the full read-only investigation
-- and per-table evidence.
--
-- Verified server-only access (same method as the three prior RLS slices,
-- 20260805090430 / 20260805100939 / 20260806083347): no browser/PostgREST
-- client code, no Edge Functions, no Realtime subscriptions touch any of
-- these ten tables. Prisma connects as the `postgres` role (bypasses RLS by
-- design). Enabling RLS with no policy therefore has no functional impact on
-- existing code paths, and matches production's existing state exactly
-- (RLS enabled, zero policies = implicit deny-all via PostgREST).
--
-- No new policy is created -- production already has RLS on with zero
-- policies for all ten tables, so adding a policy here would introduce a
-- behavior that doesn't exist in production, rather than restore parity.
--
-- Classification: defense-in-depth / environment parity, not a verified
-- active exposure -- see the discovery doc for the reasoning.
--
-- Staging note: this project (zzdamokfeenencuggjjp) is intentionally shared
-- with an unrelated project ("Slot Machine"). This migration touches only
-- these ten explicitly-named public-schema Equinet tables and has no effect
-- on Slot Machine's own schemas (signals, lakers, tippliga_*).
--
-- Safe: ENABLE ROW LEVEL SECURITY is idempotent (no-op if already enabled).
-- Rollback: ALTER TABLE "TableName" DISABLE ROW LEVEL SECURITY;

ALTER TABLE public."CustomerHorseServiceInterval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FeatureFlag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Follow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HorseServiceInterval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NotificationDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProviderCustomer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProviderCustomerNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PushSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_RouteOrderToService" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
