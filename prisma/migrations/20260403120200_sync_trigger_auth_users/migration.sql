-- CreateFunction: handle_new_user
-- Syncs new Supabase Auth users to public.User automatically.
-- userType is hardcoded to 'customer' -- NEVER read from user-controlled metadata.
-- Provider upgrade must happen via an explicit, authenticated admin/onboarding process.

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
    "passwordHash",
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
    '',
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

-- CreateTrigger: on_auth_user_created
-- Fires after every new sign-up in Supabase Auth.

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
