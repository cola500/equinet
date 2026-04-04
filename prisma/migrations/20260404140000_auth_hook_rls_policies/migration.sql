-- RLS policies for supabase_auth_admin
-- Required by custom_access_token_hook which runs as supabase_auth_admin.
-- Without these policies, RLS blocks the hook from reading User/Provider data.
-- See S15-0: LEFT JOIN on RLS-enabled tables returns empty when the joining
-- table has no policy for the executing role.

-- Allow auth hook to read User data (userType, isAdmin)
CREATE POLICY auth_hook_read_user ON public."User"
  FOR SELECT TO supabase_auth_admin
  USING (true);

-- Allow auth hook to read Provider data (providerId lookup)
CREATE POLICY auth_hook_read_provider ON public."Provider"
  FOR SELECT TO supabase_auth_admin
  USING (true);
