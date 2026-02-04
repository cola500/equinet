-- Enable Row Level Security on ALL tables
--
-- Why: Supabase exposes tables via PostgREST automatically.
-- Without RLS, anyone with the anon key can read/write all data.
-- Prisma uses service_role which bypasses RLS, so the app is unaffected.
--
-- This is a "deny all" approach: RLS is enabled with no permissive policies,
-- which blocks all PostgREST access while keeping Prisma fully functional.
-- If we later need Supabase JS client access, we can add granular policies.
--
-- Safe: ENABLE ROW LEVEL SECURITY is idempotent (no-op if already enabled).
-- Rollback: ALTER TABLE "TableName" DISABLE ROW LEVEL SECURITY;

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Provider" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Availability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AvailabilityException" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Horse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HorsePassportToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Upload" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FortnoxConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RouteOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Route" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RouteStop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailVerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HorseNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProviderVerification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupBookingRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupBookingParticipant" ENABLE ROW LEVEL SECURITY;
