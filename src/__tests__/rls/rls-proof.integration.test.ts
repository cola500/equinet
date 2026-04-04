/**
 * S14-5: RLS Proof Tests
 *
 * Integration tests against live Supabase project that prove RLS policies
 * actually block cross-tenant access on all 7 core domain tables.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 *           SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Run: npx vitest run src/__tests__/rls/rls-proof.integration.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  IDS,
  createAdminClient,
  createAnonClient,
  createAuthenticatedClient,
  seedTestData,
  cleanupTestData,
  hasSupabaseEnv,
  verifyJwtClaims,
} from "./supabase-test-helpers"

describe.skipIf(!hasSupabaseEnv())("RLS proof tests (Supabase)", () => {
  let providerAClient: SupabaseClient
  let providerBClient: SupabaseClient
  let customerAClient: SupabaseClient
  let adminClient: SupabaseClient

  beforeAll(async () => {
    // Clean up any leftover data from a previous failed run
    await cleanupTestData()

    // Seed fresh test data
    await seedTestData()

    // Sign in as each test user
    providerAClient = await createAuthenticatedClient(
      "rls-test-provider-a@test.local"
    )
    providerBClient = await createAuthenticatedClient(
      "rls-test-provider-b@test.local"
    )
    customerAClient = await createAuthenticatedClient(
      "rls-test-customer-a@test.local"
    )
    adminClient = createAdminClient()

    // Verify JWT claims are correct (guards against false green tests)
    await verifyJwtClaims(providerAClient)
  }, 30_000)

  afterAll(async () => {
    await cleanupTestData()
  }, 15_000)

  // =========================================================================
  // Booking (2 policies: provider read, customer read)
  // =========================================================================

  describe("Booking", () => {
    it("Provider A sees only their own bookings (2)", async () => {
      const { data } = await providerAClient
        .from("Booking")
        .select("id, providerId")
        .in("id", [
          IDS.BOOKING_A1,
          IDS.BOOKING_A2,
          IDS.BOOKING_B1,
          IDS.BOOKING_B2,
        ])

      expect(data).toHaveLength(2)
      expect(data!.every((b) => b.providerId === IDS.PROVIDER_A)).toBe(true)
    })

    it("Provider B sees only their own bookings (2)", async () => {
      const { data } = await providerBClient
        .from("Booking")
        .select("id, providerId")
        .in("id", [
          IDS.BOOKING_A1,
          IDS.BOOKING_A2,
          IDS.BOOKING_B1,
          IDS.BOOKING_B2,
        ])

      expect(data).toHaveLength(2)
      expect(data!.every((b) => b.providerId === IDS.PROVIDER_B)).toBe(true)
    })

    it("Provider A cannot see Provider B bookings", async () => {
      const { data, error } = await providerAClient
        .from("Booking")
        .select("id")
        .in("id", [IDS.BOOKING_B1, IDS.BOOKING_B2])

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it("Customer A sees bookings where they are the customer (4)", async () => {
      const { data } = await customerAClient
        .from("Booking")
        .select("id, customerId")
        .in("id", [
          IDS.BOOKING_A1,
          IDS.BOOKING_A2,
          IDS.BOOKING_B1,
          IDS.BOOKING_B2,
        ])

      // Customer A is the customer on all 4 test bookings
      expect(data).toHaveLength(4)
      expect(data!.every((b) => b.customerId === IDS.CUSTOMER_A_USER)).toBe(
        true
      )
    })

    it("Anon client sees no bookings", async () => {
      const anon = createAnonClient()
      const { data } = await anon
        .from("Booking")
        .select("id")
        .in("id", [
          IDS.BOOKING_A1,
          IDS.BOOKING_A2,
          IDS.BOOKING_B1,
          IDS.BOOKING_B2,
        ])

      expect(data).toHaveLength(0)
    })

    it("Service role (admin) sees all bookings", async () => {
      const { data } = await adminClient
        .from("Booking")
        .select("id")
        .in("id", [
          IDS.BOOKING_A1,
          IDS.BOOKING_A2,
          IDS.BOOKING_B1,
          IDS.BOOKING_B2,
        ])

      expect(data).toHaveLength(4)
    })
  })

  // =========================================================================
  // Payment (2 policies: provider via booking JOIN, customer via booking JOIN)
  // =========================================================================

  describe("Payment", () => {
    it("Provider A sees payments for their bookings", async () => {
      const { data } = await providerAClient
        .from("Payment")
        .select("id")
        .in("id", [IDS.PAYMENT_A1, IDS.PAYMENT_B1])

      expect(data).toHaveLength(1)
      expect(data![0].id).toBe(IDS.PAYMENT_A1)
    })

    it("Provider A cannot see Provider B payments", async () => {
      const { data, error } = await providerAClient
        .from("Payment")
        .select("id")
        .eq("id", IDS.PAYMENT_B1)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it("Customer A sees payments for their bookings (both providers)", async () => {
      const { data } = await customerAClient
        .from("Payment")
        .select("id")
        .in("id", [IDS.PAYMENT_A1, IDS.PAYMENT_B1])

      // Customer A is on both bookings
      expect(data).toHaveLength(2)
    })
  })

  // =========================================================================
  // Service (2 policies: provider own, public active)
  // =========================================================================

  describe("Service", () => {
    it("Provider A sees own services", async () => {
      const { data } = await providerAClient
        .from("Service")
        .select("id, providerId")
        .eq("id", IDS.SERVICE_A)

      expect(data).toHaveLength(1)
      expect(data![0].providerId).toBe(IDS.PROVIDER_A)
    })

    it("All authenticated users see active services (booking flow)", async () => {
      const { data } = await customerAClient
        .from("Service")
        .select("id")
        .in("id", [IDS.SERVICE_A, IDS.SERVICE_B])

      // Both services are active, any authenticated user can see them
      expect(data).toHaveLength(2)
    })

    it("Anon client cannot see services (policy is TO authenticated)", async () => {
      const anon = createAnonClient()
      const { data } = await anon
        .from("Service")
        .select("id")
        .in("id", [IDS.SERVICE_A, IDS.SERVICE_B])

      expect(data).toHaveLength(0)
    })
  })

  // =========================================================================
  // Horse (2 policies: owner read, provider via ProviderCustomer)
  // =========================================================================

  describe("Horse", () => {
    it("Horse owner sees their horse", async () => {
      const { data } = await customerAClient
        .from("Horse")
        .select("id, ownerId")
        .eq("id", IDS.HORSE_A)

      expect(data).toHaveLength(1)
      expect(data![0].ownerId).toBe(IDS.CUSTOMER_A_USER)
    })

    it("Provider A sees horses of their customers (via ProviderCustomer)", async () => {
      const { data } = await providerAClient
        .from("Horse")
        .select("id")
        .eq("id", IDS.HORSE_A)

      expect(data).toHaveLength(1)
    })

    it("Provider B cannot see horse (no ProviderCustomer relation)", async () => {
      const { data, error } = await providerBClient
        .from("Horse")
        .select("id")
        .eq("id", IDS.HORSE_A)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })
  })

  // =========================================================================
  // CustomerReview (2 policies: provider read, customer read)
  // =========================================================================

  describe("CustomerReview", () => {
    it("Provider A sees reviews about them", async () => {
      const { data } = await providerAClient
        .from("CustomerReview")
        .select("id, providerId")
        .eq("id", IDS.REVIEW_A)

      expect(data).toHaveLength(1)
      expect(data![0].providerId).toBe(IDS.PROVIDER_A)
    })

    it("Provider B cannot see Provider A reviews", async () => {
      const { data, error } = await providerBClient
        .from("CustomerReview")
        .select("id")
        .eq("id", IDS.REVIEW_A)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it("Customer A sees their own review", async () => {
      const { data } = await customerAClient
        .from("CustomerReview")
        .select("id, customerId")
        .eq("id", IDS.REVIEW_A)

      expect(data).toHaveLength(1)
      expect(data![0].customerId).toBe(IDS.CUSTOMER_A_USER)
    })
  })

  // =========================================================================
  // Notification (1 policy: user reads own)
  // =========================================================================

  describe("Notification", () => {
    it("Provider A user sees only their notifications", async () => {
      const { data } = await providerAClient
        .from("Notification")
        .select("id, userId")
        .in("id", [IDS.NOTIFICATION_A, IDS.NOTIFICATION_B])

      expect(data).toHaveLength(1)
      expect(data![0].id).toBe(IDS.NOTIFICATION_A)
      expect(data![0].userId).toBe(IDS.PROVIDER_A_USER)
    })

    it("Provider B user sees only their notifications", async () => {
      const { data } = await providerBClient
        .from("Notification")
        .select("id")
        .in("id", [IDS.NOTIFICATION_A, IDS.NOTIFICATION_B])

      expect(data).toHaveLength(1)
      expect(data![0].id).toBe(IDS.NOTIFICATION_B)
    })

    it("Provider A cannot see Provider B notifications", async () => {
      const { data, error } = await providerAClient
        .from("Notification")
        .select("id")
        .eq("id", IDS.NOTIFICATION_B)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })
  })

  // =========================================================================
  // BookingSeries (2 policies: provider read, customer read)
  // =========================================================================

  describe("BookingSeries", () => {
    it("Provider A sees only their series", async () => {
      const { data } = await providerAClient
        .from("BookingSeries")
        .select("id, providerId")
        .in("id", [IDS.SERIES_A, IDS.SERIES_B])

      expect(data).toHaveLength(1)
      expect(data![0].id).toBe(IDS.SERIES_A)
      expect(data![0].providerId).toBe(IDS.PROVIDER_A)
    })

    it("Provider A cannot see Provider B series", async () => {
      const { data, error } = await providerAClient
        .from("BookingSeries")
        .select("id")
        .eq("id", IDS.SERIES_B)

      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    })

    it("Customer A sees series where they are the customer (both)", async () => {
      const { data } = await customerAClient
        .from("BookingSeries")
        .select("id, customerId")
        .in("id", [IDS.SERIES_A, IDS.SERIES_B])

      // Customer A is customer on both series
      expect(data).toHaveLength(2)
      expect(data!.every((s) => s.customerId === IDS.CUSTOMER_A_USER)).toBe(
        true
      )
    })
  })
})
