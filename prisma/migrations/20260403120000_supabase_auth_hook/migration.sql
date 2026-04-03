-- Custom Access Token Hook for Supabase Auth
-- Adds userType, isAdmin, and providerId to JWT app_metadata claims.
-- After running this migration, activate the hook manually in:
--   Supabase Dashboard -> Auth -> Hooks -> Custom Access Token
--   Function: public.custom_access_token_hook

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  app_user record;
BEGIN
  claims := event->'claims';

  SELECT
    u."userType",
    u."isAdmin",
    p.id AS provider_id
  INTO app_user
  FROM public."User" u
  LEFT JOIN public."Provider" p ON p."userId" = u.id
  WHERE u.id = (event->>'user_id')::text;

  IF app_user IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', COALESCE(claims->'app_metadata', '{}'::jsonb));
    claims := jsonb_set(claims, '{app_metadata, userType}', to_jsonb(app_user."userType"));
    claims := jsonb_set(claims, '{app_metadata, isAdmin}', to_jsonb(app_user."isAdmin"));

    IF app_user.provider_id IS NOT NULL THEN
      claims := jsonb_set(claims, '{app_metadata, providerId}', to_jsonb(app_user.provider_id));
    END IF;

    event := jsonb_set(event, '{claims}', claims);
  END IF;

  RETURN event;
END;
$$;

-- Grant execute to supabase_auth_admin (required for Auth hooks)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke from public for security
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;
