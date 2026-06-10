import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

const MIGRATION_DIR = "20260608120000_horse_provider_booking_read"
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

// Background: horse_provider_read (20260404120000) only lets a provider read a
// customer's horse when a ProviderCustomer link exists — which is created only
// when a provider manually adds a customer, never on booking. So a provider
// could not read the horse on their own booking via the Supabase client, which
// broke the stable name in the provider bookings list. This policy closes that
// gap: a provider may read a Horse referenced by one of their own bookings.
describe("horse_provider_booking_read RLS migration", () => {
  it("migration file exists", () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true)
  })

  it("creates horse_provider_booking_read as a SELECT policy on Horse", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
    expect(sql).toContain("CREATE POLICY horse_provider_booking_read")
    expect(sql).toContain('ON public."Horse"')
    expect(sql).toContain("FOR SELECT")
    expect(sql).toContain("TO authenticated")
  })

  it("scopes the policy to the provider's own bookings via rls_provider_id()", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
    // EXISTS subquery joining Booking on horseId and the caller's provider id.
    expect(sql).toContain('FROM public."Booking"')
    expect(sql).toContain('"horseId" = "Horse"."id"')
    expect(sql).toContain('"providerId" = rls_provider_id()')
  })

  it("is idempotent (drops the policy if it already exists)", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8")
    expect(sql).toContain('DROP POLICY IF EXISTS horse_provider_booking_read ON public."Horse"')
  })
})
