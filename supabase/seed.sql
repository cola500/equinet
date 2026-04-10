-- Supabase seed: Auth triggers for local development and E2E
--
-- SOURCE: These functions mirror the Prisma migrations:
--   - prisma/migrations/20260404120000_remove_password_hash/migration.sql (handle_new_user)
--   - prisma/migrations/20260403120000_supabase_auth_hook/migration.sql (custom_access_token_hook)
--   - prisma/migrations/20260404140000_auth_hook_rls_policies/migration.sql (RLS policies)
--
-- WHY: `supabase start` starts a clean DB. Prisma migrations install these
-- triggers, but if `prisma migrate deploy` hasn't run yet (or seed.sql runs
-- first during `supabase db reset`), this ensures the triggers exist.
-- All statements are idempotent (CREATE OR REPLACE, IF NOT EXISTS).

-----------------------------------------------------------------------
-- 1. handle_new_user: Sync auth.users -> public.User on signup
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public."User" (
    id,
    email,
    "userType",
    "firstName",
    "lastName",
    "emailVerified",
    "emailVerifiedAt",
    "createdAt",
    "updatedAt"
  ) VALUES (
    NEW.id,
    NEW.email,
    'customer',
    COALESCE(NEW.raw_user_meta_data->>'firstName', ''),
    COALESCE(NEW.raw_user_meta_data->>'lastName', ''),
    NEW.email_confirmed_at IS NOT NULL,
    NEW.email_confirmed_at,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger (idempotent: drop + create)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-----------------------------------------------------------------------
-- 2. custom_access_token_hook: Add claims to JWT
-----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_type text;
  is_admin boolean;
  provider_id text;
BEGIN
  claims := event->'claims';

  SELECT u."userType", u."isAdmin"
  INTO user_type, is_admin
  FROM public."User" u
  WHERE u.id = (event->>'user_id')::text;

  IF user_type IS NOT NULL THEN
    SELECT p.id INTO provider_id
    FROM public."Provider" p
    WHERE p."userId" = (event->>'user_id')::text;

    claims := jsonb_set(claims, '{app_metadata}', COALESCE(claims->'app_metadata', '{}'::jsonb));
    claims := jsonb_set(claims, '{app_metadata, userType}', to_jsonb(user_type));
    claims := jsonb_set(claims, '{app_metadata, isAdmin}', to_jsonb(is_admin));

    IF provider_id IS NOT NULL THEN
      claims := jsonb_set(claims, '{app_metadata, providerId}', to_jsonb(provider_id));
    END IF;

    event := jsonb_set(event, '{claims}', claims);
  END IF;

  RETURN event;
END;
$$;

-- Grants for supabase_auth_admin (required for Auth hooks)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON public."User" TO supabase_auth_admin;
GRANT SELECT ON public."Provider" TO supabase_auth_admin;

-- Revoke from public for security
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;

-----------------------------------------------------------------------
-- 3. RLS policies for auth hook
-----------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'auth_hook_read_user' AND tablename = 'User'
  ) THEN
    CREATE POLICY auth_hook_read_user ON public."User"
      FOR SELECT TO supabase_auth_admin
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'auth_hook_read_provider' AND tablename = 'Provider'
  ) THEN
    CREATE POLICY auth_hook_read_provider ON public."Provider"
      FOR SELECT TO supabase_auth_admin
      USING (true);
  END IF;
END
$$;
