import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

const MIGRATION_DIR = "20260404120000_rls_read_policies"
const MIGRATION_PATH = path.resolve(
  __dirname,
  "..",
  MIGRATION_DIR,
  "migration.sql"
)

describe("RLS read policies migration", () => {
  it("migration file exists", () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true)
  })

  describe("helper function", () => {
    it("creates rls_provider_id() function", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.rls_provider_id()")
      expect(sql).toContain("app_metadata")
      expect(sql).toContain("providerId")
      expect(sql).toContain("STABLE")
    })
  })

  describe("updates existing PoC policy", () => {
    it("alters booking_provider_read to use rls_provider_id()", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toMatch(/DROP POLICY.*booking_provider_read/i)
      expect(sql).toContain("booking_provider_read")
      expect(sql).toContain("rls_provider_id()")
    })
  })

  describe("Booking policies", () => {
    it("creates booking_customer_read policy", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("booking_customer_read")
      expect(sql).toContain("auth.uid()")
      expect(sql).toMatch(/"customerId"\s*=\s*auth\.uid\(\)/)
    })
  })

  describe("Payment policies", () => {
    it("creates payment_provider_read with JOIN to Booking", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("payment_provider_read")
      expect(sql).toContain("rls_provider_id()")
      // Payment must JOIN Booking since it has no direct providerId
      expect(sql).toMatch(/EXISTS\s*\(\s*SELECT/i)
    })

    it("creates payment_customer_read with JOIN to Booking", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("payment_customer_read")
      expect(sql).toContain("auth.uid()")
    })
  })

  describe("Service policies", () => {
    it("creates service_provider_read for own services", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("service_provider_read")
      expect(sql).toContain("rls_provider_id()")
    })

    it("creates service_public_read for active services", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("service_public_read")
      expect(sql).toMatch(/"isActive"\s*=\s*true/i)
    })
  })

  describe("Horse policies", () => {
    it("creates horse_owner_read for horse owners", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("horse_owner_read")
      expect(sql).toContain("auth.uid()")
      expect(sql).toMatch(/"ownerId"\s*=\s*auth\.uid\(\)/)
    })

    it("creates horse_provider_read via ProviderCustomer", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("horse_provider_read")
      expect(sql).toContain("ProviderCustomer")
      expect(sql).toContain("rls_provider_id()")
    })
  })

  describe("CustomerReview policies", () => {
    it("creates review_provider_read", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("review_provider_read")
      expect(sql).toContain("rls_provider_id()")
    })

    it("creates review_customer_read", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("review_customer_read")
      expect(sql).toContain("auth.uid()")
    })
  })

  describe("Notification policy", () => {
    it("creates notification_user_read", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("notification_user_read")
      expect(sql).toMatch(/"userId"\s*=\s*auth\.uid\(\)/)
    })
  })

  describe("BookingSeries policies", () => {
    it("creates booking_series_provider_read", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("booking_series_provider_read")
      expect(sql).toContain("rls_provider_id()")
    })

    it("creates booking_series_customer_read", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("booking_series_customer_read")
      expect(sql).toContain("auth.uid()")
    })
  })

  describe("policy completeness", () => {
    const EXPECTED_POLICIES = [
      "booking_provider_read",
      "booking_customer_read",
      "payment_provider_read",
      "payment_customer_read",
      "service_provider_read",
      "service_public_read",
      "horse_owner_read",
      "horse_provider_read",
      "review_provider_read",
      "review_customer_read",
      "notification_user_read",
      "booking_series_provider_read",
      "booking_series_customer_read",
    ]

    it("contains all 13 expected policies", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      for (const policyName of EXPECTED_POLICIES) {
        expect(sql).toContain(policyName)
      }
    })

    it("all policies are SELECT-only for authenticated role", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      const policyBlocks = sql.split("CREATE POLICY").slice(1) // skip first empty split
      for (const block of policyBlocks) {
        expect(block).toMatch(/FOR SELECT/i)
        expect(block).toMatch(/TO authenticated/i)
      }
    })
  })
})
