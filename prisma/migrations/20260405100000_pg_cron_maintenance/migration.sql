-- pg_cron: Scheduled database maintenance jobs
-- Supabase Free includes pg_cron. These jobs clean up expired tokens
-- and old notification records to prevent unbounded table growth.

-- Enable pg_cron extension (already available on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage to postgres role (required on some Supabase setups)
GRANT USAGE ON SCHEMA cron TO postgres;

-- Job 1: Clean expired tokens (daily at 03:00 UTC)
-- Removes tokens that expired 30+ days ago from all 6 token tables.
-- 30-day grace period ensures no active references are broken.
SELECT cron.schedule(
  'cleanup-expired-tokens',
  '0 3 * * *',
  $$
  DO $body$
  BEGIN
    DELETE FROM "EmailVerificationToken" WHERE "expiresAt" < NOW() - INTERVAL '30 days';
    DELETE FROM "PasswordResetToken" WHERE "expiresAt" < NOW() - INTERVAL '30 days';
    DELETE FROM "CustomerInviteToken" WHERE "expiresAt" < NOW() - INTERVAL '30 days';
    DELETE FROM "HorseProfileToken" WHERE "expiresAt" < NOW() - INTERVAL '30 days';
    DELETE FROM "StableInviteToken" WHERE "expiresAt" < NOW() - INTERVAL '30 days';
    DELETE FROM "MobileToken"
      WHERE ("expiresAt" < NOW() - INTERVAL '30 days')
         OR ("revokedAt" IS NOT NULL AND "revokedAt" < NOW() - INTERVAL '30 days');
  END
  $body$;
  $$
);

-- Job 2: Clean old notification deliveries (weekly, Sunday 04:00 UTC)
-- NotificationDelivery is a dedup table for route announcements.
-- Records older than 90 days have no operational value.
SELECT cron.schedule(
  'cleanup-old-notification-deliveries',
  '0 4 * * 0',
  $$DELETE FROM "NotificationDelivery" WHERE "createdAt" < NOW() - INTERVAL '90 days'$$
);

-- Job 3: Clean old read notifications (weekly, Sunday 04:15 UTC)
-- Read notifications older than 1 year are unlikely to be accessed.
SELECT cron.schedule(
  'cleanup-old-read-notifications',
  '15 4 * * 0',
  $$DELETE FROM "Notification" WHERE "isRead" = true AND "createdAt" < NOW() - INTERVAL '365 days'$$
);
