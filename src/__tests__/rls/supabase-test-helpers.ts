/**
 * RLS Proof Test Helpers
 *
 * Seed/cleanup for integration tests against live Supabase project.
 * Uses service_role (bypasses RLS) for seeding, authenticated clients for queries.
 */
import { config } from "dotenv"
import { createClient, SupabaseClient } from "@supabase/supabase-js"

// Load env from .env.local (Vite test mode doesn't load it by default)
config({ path: ".env.local" })

// --- Config (from .env.local) ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

// --- Deterministic test IDs (b0-prefix for easy identification + cleanup) ---
export const IDS = {
  PROVIDER_A_USER: "b0000000-0000-4000-a000-000000000001",
  PROVIDER_B_USER: "b0000000-0000-4000-a000-000000000002",
  CUSTOMER_A_USER: "b0000000-0000-4000-a000-000000000003",
  PROVIDER_A: "b0000000-0000-4000-a000-000000000011",
  PROVIDER_B: "b0000000-0000-4000-a000-000000000012",
  SERVICE_A: "b0000000-0000-4000-a000-000000000021",
  SERVICE_B: "b0000000-0000-4000-a000-000000000022",
  BOOKING_A1: "b0000000-0000-4000-a000-000000000031",
  BOOKING_A2: "b0000000-0000-4000-a000-000000000032",
  BOOKING_B1: "b0000000-0000-4000-a000-000000000033",
  BOOKING_B2: "b0000000-0000-4000-a000-000000000034",
  PAYMENT_A1: "b0000000-0000-4000-a000-000000000041",
  PAYMENT_B1: "b0000000-0000-4000-a000-000000000042",
  HORSE_A: "b0000000-0000-4000-a000-000000000051",
  REVIEW_A: "b0000000-0000-4000-a000-000000000061",
  NOTIFICATION_A: "b0000000-0000-4000-a000-000000000071",
  NOTIFICATION_B: "b0000000-0000-4000-a000-000000000072",
  SERIES_A: "b0000000-0000-4000-a000-000000000081",
  SERIES_B: "b0000000-0000-4000-a000-000000000082",
  PROVIDER_CUSTOMER_A: "b0000000-0000-4000-a000-000000000091",
} as const

const TEST_PASSWORD = "rls-test-2026!"

// --- Client factories ---

export function createAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function createAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function createAuthenticatedClient(
  email: string
): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  })
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`)
  return client
}

/**
 * Verify that the Custom Access Token Hook is active and JWT contains providerId.
 * Without this, all provider-policy tests pass for the WRONG reason (NULL = no match).
 */
export async function verifyJwtClaims(client: SupabaseClient): Promise<void> {
  const {
    data: { session },
  } = await client.auth.getSession()
  if (!session?.access_token) {
    throw new Error("No session -- cannot verify JWT claims")
  }

  const payload = JSON.parse(
    Buffer.from(session.access_token.split(".")[1], "base64").toString()
  )
  const providerId = payload.app_metadata?.providerId

  if (!providerId) {
    throw new Error(
      "Custom Access Token Hook is NOT active -- providerId missing from JWT. " +
        "Activate it in Supabase Dashboard -> Auth -> Hooks -> Custom Access Token. " +
        "Without it, RLS provider policies silently deny all rows (false green tests)."
    )
  }
}

// --- Seed ---

export async function seedTestData(): Promise<void> {
  const admin = createAdminClient()
  const now = new Date().toISOString()

  // 1. Create auth users
  const users = [
    { id: IDS.PROVIDER_A_USER, email: "rls-test-provider-a@test.local" },
    { id: IDS.PROVIDER_B_USER, email: "rls-test-provider-b@test.local" },
    { id: IDS.CUSTOMER_A_USER, email: "rls-test-customer-a@test.local" },
  ]

  for (const u of users) {
    const { error } = await admin.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (error && !error.message.includes("already been registered")) {
      throw new Error(`Failed to create auth user ${u.email}: ${error.message}`)
    }
  }

  // 2. User records (needed by Custom Access Token Hook to enrich JWT)
  // NOTE: updatedAt has no DB default (@updatedAt is Prisma-only), must be set explicitly
  const { error: userErr } = await admin.from("User").upsert([
    {
      id: IDS.PROVIDER_A_USER,
      email: "rls-test-provider-a@test.local",
      userType: "provider",
      firstName: "ProvA",
      lastName: "Test",
      isAdmin: false,
      updatedAt: now,
    },
    {
      id: IDS.PROVIDER_B_USER,
      email: "rls-test-provider-b@test.local",
      userType: "provider",
      firstName: "ProvB",
      lastName: "Test",
      isAdmin: false,
      updatedAt: now,
    },
    {
      id: IDS.CUSTOMER_A_USER,
      email: "rls-test-customer-a@test.local",
      userType: "customer",
      firstName: "KundA",
      lastName: "Test",
      isAdmin: false,
      updatedAt: now,
    },
  ])
  if (userErr) throw new Error(`User seed failed: ${userErr.message}`)

  // 3. Provider records
  const { error: provErr } = await admin.from("Provider").upsert([
    {
      id: IDS.PROVIDER_A,
      userId: IDS.PROVIDER_A_USER,
      businessName: "RLS Test Hovslagare A",
      updatedAt: now,
    },
    {
      id: IDS.PROVIDER_B,
      userId: IDS.PROVIDER_B_USER,
      businessName: "RLS Test Hovslagare B",
      updatedAt: now,
    },
  ])
  if (provErr) throw new Error(`Provider seed failed: ${provErr.message}`)

  // 4. ProviderCustomer (Provider A has Customer A as client)
  const { error: pcErr } = await admin.from("ProviderCustomer").upsert([
    {
      id: IDS.PROVIDER_CUSTOMER_A,
      providerId: IDS.PROVIDER_A,
      customerId: IDS.CUSTOMER_A_USER,
    },
  ])
  if (pcErr) throw new Error(`ProviderCustomer seed failed: ${pcErr.message}`)

  // 5. Services
  const { error: svcErr } = await admin.from("Service").upsert([
    {
      id: IDS.SERVICE_A,
      providerId: IDS.PROVIDER_A,
      name: "RLS Hovvård A",
      price: 800,
      durationMinutes: 60,
      isActive: true,
    },
    {
      id: IDS.SERVICE_B,
      providerId: IDS.PROVIDER_B,
      name: "RLS Hovvård B",
      price: 900,
      durationMinutes: 45,
      isActive: true,
    },
  ])
  if (svcErr) throw new Error(`Service seed failed: ${svcErr.message}`)

  // 6. Bookings (2 per provider, Customer A is client on all)
  const { error: bookErr } = await admin.from("Booking").upsert([
    {
      id: IDS.BOOKING_A1,
      customerId: IDS.CUSTOMER_A_USER,
      providerId: IDS.PROVIDER_A,
      serviceId: IDS.SERVICE_A,
      bookingDate: "2026-05-01",
      startTime: "09:00",
      endTime: "10:00",
      status: "confirmed",
      updatedAt: now,
    },
    {
      id: IDS.BOOKING_A2,
      customerId: IDS.CUSTOMER_A_USER,
      providerId: IDS.PROVIDER_A,
      serviceId: IDS.SERVICE_A,
      bookingDate: "2026-05-02",
      startTime: "09:00",
      endTime: "10:00",
      status: "confirmed",
      updatedAt: now,
    },
    {
      id: IDS.BOOKING_B1,
      customerId: IDS.CUSTOMER_A_USER,
      providerId: IDS.PROVIDER_B,
      serviceId: IDS.SERVICE_B,
      bookingDate: "2026-05-01",
      startTime: "14:00",
      endTime: "14:45",
      status: "confirmed",
      updatedAt: now,
    },
    {
      id: IDS.BOOKING_B2,
      customerId: IDS.CUSTOMER_A_USER,
      providerId: IDS.PROVIDER_B,
      serviceId: IDS.SERVICE_B,
      bookingDate: "2026-05-02",
      startTime: "14:00",
      endTime: "14:45",
      status: "confirmed",
      updatedAt: now,
    },
  ])
  if (bookErr) throw new Error(`Booking seed failed: ${bookErr.message}`)

  // 7. Payments (1 per provider, linked via booking)
  const { error: payErr } = await admin.from("Payment").upsert([
    {
      id: IDS.PAYMENT_A1,
      bookingId: IDS.BOOKING_A1,
      amount: 800,
      provider: "swish",
      status: "succeeded",
      updatedAt: now,
    },
    {
      id: IDS.PAYMENT_B1,
      bookingId: IDS.BOOKING_B1,
      amount: 900,
      provider: "swish",
      status: "succeeded",
      updatedAt: now,
    },
  ])
  if (payErr) throw new Error(`Payment seed failed: ${payErr.message}`)

  // 8. Horse (owned by Customer A)
  const { error: horseErr } = await admin.from("Horse").upsert([
    {
      id: IDS.HORSE_A,
      ownerId: IDS.CUSTOMER_A_USER,
      name: "RLS Testhäst",
      updatedAt: now,
    },
  ])
  if (horseErr) throw new Error(`Horse seed failed: ${horseErr.message}`)

  // 9. CustomerReview (Customer A reviewed Provider A, linked to booking)
  const { error: revErr } = await admin.from("CustomerReview").upsert([
    {
      id: IDS.REVIEW_A,
      customerId: IDS.CUSTOMER_A_USER,
      providerId: IDS.PROVIDER_A,
      bookingId: IDS.BOOKING_A1,
      rating: 5,
      comment: "RLS test review",
    },
  ])
  if (revErr) throw new Error(`CustomerReview seed failed: ${revErr.message}`)

  // 10. Notifications (1 per provider user)
  const { error: notifErr } = await admin.from("Notification").upsert([
    {
      id: IDS.NOTIFICATION_A,
      userId: IDS.PROVIDER_A_USER,
      type: "booking_confirmed",
      message: "RLS test notis A",
      isRead: false,
    },
    {
      id: IDS.NOTIFICATION_B,
      userId: IDS.PROVIDER_B_USER,
      type: "booking_confirmed",
      message: "RLS test notis B",
      isRead: false,
    },
  ])
  if (notifErr)
    throw new Error(`Notification seed failed: ${notifErr.message}`)

  // 11. BookingSeries (1 per provider)
  const { error: seriesErr } = await admin.from("BookingSeries").upsert([
    {
      id: IDS.SERIES_A,
      providerId: IDS.PROVIDER_A,
      customerId: IDS.CUSTOMER_A_USER,
      serviceId: IDS.SERVICE_A,
      intervalWeeks: 1,
      totalOccurrences: 10,
      createdCount: 0,
      startTime: "09:00",
      status: "active",
    },
    {
      id: IDS.SERIES_B,
      providerId: IDS.PROVIDER_B,
      customerId: IDS.CUSTOMER_A_USER,
      serviceId: IDS.SERVICE_B,
      intervalWeeks: 2,
      totalOccurrences: 5,
      createdCount: 0,
      startTime: "14:00",
      status: "active",
    },
  ])
  if (seriesErr)
    throw new Error(`BookingSeries seed failed: ${seriesErr.message}`)
}

// --- Cleanup (reverse dependency order, try/catch to avoid masking test failures) ---

export async function cleanupTestData(): Promise<void> {
  const admin = createAdminClient()

  const allIds = Object.values(IDS)

  // Delete in dependency order (children first)
  const tables = [
    "BookingSeries",
    "Notification",
    "CustomerReview",
    "Horse",
    "Payment",
    "Booking",
    "Service",
    "ProviderCustomer",
    "Provider",
    "User",
  ]

  for (const table of tables) {
    try {
      await admin.from(table).delete().in("id", allIds)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Cleanup failed for ${table}: ${msg}`)
    }
  }

  // Delete auth users
  const userIds = [
    IDS.PROVIDER_A_USER,
    IDS.PROVIDER_B_USER,
    IDS.CUSTOMER_A_USER,
  ]
  for (const id of userIds) {
    try {
      await admin.auth.admin.deleteUser(id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Cleanup failed for auth user ${id}: ${msg}`)
    }
  }
}

export function hasSupabaseEnv(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Skip for local Supabase (127.0.0.1/localhost) -- RLS proof tests
  // require pre-seeded auth users that only exist on remote Supabase.
  const isLocal =
    url?.includes("127.0.0.1") || url?.includes("localhost")
  return !!(
    url &&
    !isLocal &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}
