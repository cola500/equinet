/**
 * Reconciliation logic for the loginable demo customer's Supabase Auth
 * account (scripts/seed-demo-provider.ts, --customer-login).
 *
 * Pulled out of the seed script (like demo-booking-scheduler.ts) so the
 * reconciliation decision — which side (auth vs. public.User) is stale and
 * needs to be rebuilt — can be unit-tested without a real database or
 * Supabase project.
 */

export interface AuthAdminUserRecord {
  id: string
  email?: string | null
}

export interface AuthAdminCreateResult {
  data: { user: AuthAdminUserRecord | null } | null
  error: { code?: string; message?: string } | null
}

export interface AuthAdminListResult {
  data: { users: AuthAdminUserRecord[] } | null
}

/** The subset of Supabase's `supabase.auth.admin` used here. */
export interface AuthAdminClient {
  createUser(args: {
    email: string
    password: string
    email_confirm: boolean
    user_metadata: Record<string, unknown>
    app_metadata: Record<string, unknown>
  }): Promise<AuthAdminCreateResult>
  listUsers(args: { page: number; perPage: number }): Promise<AuthAdminListResult>
  deleteUser(id: string): Promise<unknown>
}

export interface PublicUserRecord {
  id: string
}

/** The subset of public.User access needed to reconcile the auth linkage. */
export interface PublicUserStore {
  /** Find the public.User row for this email, if any. */
  findByEmail(email: string): Promise<PublicUserRecord | null>
  /** Wait for the DB trigger to create/link the public.User row for this auth id. Throws on timeout. */
  waitForLinked(id: string, email: string): Promise<void>
  /** Delete a public.User row and all of its demo-seeded dependents (bookings, horses, ...). */
  deleteWithDependents(id: string): Promise<void>
}

/**
 * Create (or reconcile) a loginable Supabase-auth-backed demo customer.
 * Returns the public.User id to use for the rest of the seed run.
 *
 * Handles two ways the auth.users row and the public.User row for the same
 * email can drift apart across separate seed invocations:
 *
 * 1. Orphaned auth user: an earlier `--customer-login` run created the auth
 *    account, then a later `--reset` (without `--customer-login`) deleted the
 *    public.User without touching auth.users.
 * 2. Mismatched public.User: a plain `--reset` (without `--customer-login`)
 *    created a fresh, non-auth-linked public.User for this email under a
 *    random id, while an OLDER auth.users row for the same email still
 *    exists under a DIFFERENT id. Reusing that public.User's id would
 *    silently authenticate a real login as the wrong Supabase user (the auth
 *    account that actually owns the email has no matching public.User).
 *
 * In both cases the stale side is deleted and a fresh, correctly-linked pair
 * is created, so repeated runs converge to one consistent (auth, public)
 * pair per email — deterministic and idempotent.
 */
export async function reconcileCustomerAuth(
  authAdmin: AuthAdminClient,
  users: PublicUserStore,
  email: string,
  firstName: string,
  lastName: string,
  password: string
): Promise<string> {
  const create = () =>
    authAdmin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { firstName, lastName },
      app_metadata: { userType: "customer", isAdmin: false },
    })

  let { data, error } = await create()

  if (error && (error.code === "email_exists" || error.code === "user_already_exists")) {
    const { data: list } = await authAdmin.listUsers({ page: 1, perPage: 1000 })
    const authUser = list?.users.find((u) => u.email === email)
    const existing = await users.findByEmail(email)

    if (existing && authUser && existing.id === authUser.id) {
      // Auth account and public.User are already correctly linked → reuse.
      await users.waitForLinked(existing.id, email)
      return existing.id
    }

    if (existing) {
      // public.User exists but under a DIFFERENT id than the current auth
      // account — not safe to reuse. Remove it (and its dependents) so a
      // fresh, correctly-linked pair can be created below.
      await users.deleteWithDependents(existing.id)
    }

    // Orphaned (or now-mismatched) auth user → delete it and recreate.
    if (authUser) await authAdmin.deleteUser(authUser.id)
    ;({ data, error } = await create())
  }

  if (error || !data?.user) {
    throw new Error(`Failed to create customer auth for ${email}: ${error?.message ?? "unknown"}`)
  }

  await users.waitForLinked(data.user.id, email)
  return data.user.id
}
