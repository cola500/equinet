-- DropColumn: passwordHash from User
-- Supabase Auth handles all passwords in auth.users since Sprint 13.
-- The column has been redundant (set to '' for all new users via sync trigger).

ALTER TABLE "User" DROP COLUMN "passwordHash";

-- UpdateFunction: handle_new_user
-- Remove passwordHash from the INSERT (column no longer exists).

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
