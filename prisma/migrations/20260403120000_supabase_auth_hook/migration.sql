-- Custom Access Token Hook for Supabase Auth
-- Adds userType, isAdmin, and providerId to JWT app_metadata claims.
-- After running this migration, activate the hook manually in:
--   Supabase Dashboard -> Auth -> Hooks -> Custom Access Token
--   Function: public.custom_access_token_hook
--
-- NOTE: Uses separate queries instead of LEFT JOIN because RLS on Provider
-- table blocks LEFT JOIN results for supabase_auth_admin role (the role
-- GoTrue uses to execute hooks). See S15-0 learnings.

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

  -- Get user info (separate query to avoid RLS issues with JOIN)
  SELECT u."userType", u."isAdmin"
  INTO user_type, is_admin
  FROM public."User" u
  WHERE u.id = (event->>'user_id')::text;

  IF user_type IS NOT NULL THEN
    -- Get provider_id separately (RLS on Provider blocks LEFT JOIN)
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

-- Grant execute to supabase_auth_admin (required for Auth hooks)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Grant SELECT on tables the hook reads (required when RLS is enabled)
GRANT SELECT ON public."User" TO supabase_auth_admin;
GRANT SELECT ON public."Provider" TO supabase_auth_admin;

-- Revoke from public for security
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;
