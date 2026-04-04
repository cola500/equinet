import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

const MIGRATION_DIR = "20260404130000_rls_write_policies"
const MIGRATION_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "prisma",
  "migrations",
  MIGRATION_DIR,
  "migration.sql"
)

describe("RLS write policies migration", () => {
  it("migration file exists", () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true)
  })

  describe("Booking write policies", () => {
    it("creates booking_provider_insert policy", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("booking_provider_insert")
      expect(sql).toMatch(/FOR INSERT/)
      expect(sql).toContain("rls_provider_id()")
    })

    it("creates booking_provider_update policy", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("booking_provider_update")
      expect(sql).toMatch(/FOR UPDATE/)
    })

    it("creates booking_customer_insert policy", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("booking_customer_insert")
      expect(sql).toContain("auth.uid()")
    })

    it("creates booking_customer_update policy", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("booking_customer_update")
    })
  })

  describe("Service write policies", () => {
    it("creates service_provider_insert policy", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("service_provider_insert")
      expect(sql).toContain("rls_provider_id()")
    })

    it("creates service_provider_update policy", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("service_provider_update")
    })

    it("creates service_provider_delete policy", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("service_provider_delete")
      expect(sql).toMatch(/FOR DELETE/)
    })
  })

  describe("Horse write policies", () => {
    it("creates horse_owner_insert policy", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("horse_owner_insert")
      expect(sql).toContain("auth.uid()")
    })

    it("creates horse_owner_update policy", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("horse_owner_update")
    })
  })

  describe("CustomerReview write policies", () => {
    it("creates review_customer_insert policy", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("review_customer_insert")
      expect(sql).toContain("auth.uid()")
    })

    it("creates review_customer_update policy", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("review_customer_update")
    })

    it("creates review_provider_update for reply", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("review_provider_update")
      expect(sql).toContain("rls_provider_id()")
    })
  })

  describe("Notification write policy", () => {
    it("creates notification_user_update policy", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("notification_user_update")
      expect(sql).toMatch(/"userId"\s*=\s*auth\.uid\(\)/)
    })
  })

  describe("BookingSeries write policies", () => {
    it("creates booking_series_provider_insert policy", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("booking_series_provider_insert")
      expect(sql).toContain("rls_provider_id()")
    })

    it("creates booking_series_provider_update policy", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).toContain("booking_series_provider_update")
    })
  })

  describe("policy completeness", () => {
    const EXPECTED_POLICIES = [
      "booking_provider_insert",
      "booking_provider_update",
      "booking_customer_insert",
      "booking_customer_update",
      "service_provider_insert",
      "service_provider_update",
      "service_provider_delete",
      "horse_owner_insert",
      "horse_owner_update",
      "review_customer_insert",
      "review_customer_update",
      "review_provider_update",
      "notification_user_update",
      "booking_series_provider_insert",
      "booking_series_provider_update",
    ]

    it(`contains all ${EXPECTED_POLICIES.length} expected policies`, () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      for (const policyName of EXPECTED_POLICIES) {
        expect(sql).toContain(policyName)
      }
    })

    it("all policies target authenticated role", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      const policyBlocks = sql.split("CREATE POLICY").slice(1)
      for (const block of policyBlocks) {
        expect(block).toMatch(/TO authenticated/i)
      }
    })

    it("no Payment INSERT/UPDATE/DELETE policies (system-only)", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).not.toMatch(/CREATE POLICY.*ON public\."Payment"/i)
    })

    it("no Notification INSERT policy (system-only)", () => {
      const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
      expect(sql).not.toContain("notification_user_insert")
    })
  })
})
