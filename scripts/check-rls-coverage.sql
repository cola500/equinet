-- RLS coverage guardrail.
--
-- Fails (RAISE EXCEPTION -> non-zero exit) if any ordinary table in the
-- `public` schema does not have Row Level Security enabled. Run this against
-- a freshly-migrated database (see the "migration-from-scratch" CI job) so it
-- reflects the true cumulative result of every migration, regardless of
-- which migration enabled RLS or whether a table was later renamed.
--
-- Usage:
--   npx prisma db execute --file scripts/check-rls-coverage.sql --schema prisma/schema.prisma
--
-- To add a deliberate, justified exception, add the table name to
-- allowed_without_rls below with a comment explaining why. Do not add an
-- exception just to make CI pass -- every public table is exposed via
-- PostgREST by default, so an exception here is a real security decision.

DO $$
DECLARE
  offending text;
  allowed_without_rls text[] := ARRAY[]::text[];
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
  INTO offending
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'                 -- ordinary tables only, not views
    AND c.relrowsecurity = false
    AND c.relname != ALL(allowed_without_rls);

  IF offending IS NOT NULL THEN
    RAISE EXCEPTION
      'RLS-guardrail: following public tables are missing ENABLE ROW LEVEL SECURITY: %. '
      'Add "ALTER TABLE public."<table>" ENABLE ROW LEVEL SECURITY;" in a migration, '
      'or add the name to allowed_without_rls in this script with a justification.',
      offending;
  END IF;

  RAISE NOTICE 'RLS-guardrail: all public tables have Row Level Security enabled.';
END $$;
