-- Fix: public."BookingSeries" had RLS policies (booking_series_customer_read,
-- booking_series_provider_insert, booking_series_provider_read,
-- booking_series_provider_update) but RLS itself was never enabled on the table.
--
-- Root cause: the table was created in 20260217181129_add_booking_series, after
-- the bulk RLS-enable migration (20260204120000_enable_rls) had already run, so
-- it was missed there. The policies were added later in 20260404120000_rls_read_policies
-- and 20260404130000_rls_write_policies without a matching ENABLE ROW LEVEL SECURITY.
--
-- Impact (production, verified 2026-08-05): anon + authenticated had full CRUD
-- grants and RLS off, meaning any unauthenticated request could read/write/delete
-- rows in BookingSeries via PostgREST. Already applied directly on prod
-- (xybyzflfxnqqyxnvjklv) to close the hole immediately; this migration exists to
-- sync schema history so `prisma migrate deploy` doesn't diverge.
--
-- Safe: ENABLE ROW LEVEL SECURITY is idempotent (no-op if already enabled).

ALTER TABLE public."BookingSeries" ENABLE ROW LEVEL SECURITY;
