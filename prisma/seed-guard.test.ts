import { describe, it, expect } from "vitest"
import {
  assertSeedSafe,
  assertStagingSeedSafe,
  extractSupabaseProjectRef,
} from "./seed-guard"

describe("assertSeedSafe", () => {
  it("allows local Supabase URL (127.0.0.1)", () => {
    expect(() =>
      assertSeedSafe({ supabaseUrl: "http://127.0.0.1:54321", allowProd: false })
    ).not.toThrow()
  })

  it("allows local Supabase URL (localhost)", () => {
    expect(() =>
      assertSeedSafe({ supabaseUrl: "http://localhost:54321", allowProd: false })
    ).not.toThrow()
  })

  it("rejects hosted Supabase URL by default", () => {
    expect(() =>
      assertSeedSafe({
        supabaseUrl: "https://xybyzflfxnqqyxnvjklv.supabase.co",
        allowProd: false,
      })
    ).toThrow(/refusing to seed against hosted Supabase/i)
  })

  it("rejects Supabase pooler URL by default", () => {
    expect(() =>
      assertSeedSafe({
        supabaseUrl: "https://pooler.supabase.com:5432",
        allowProd: false,
      })
    ).toThrow(/refusing to seed/i)
  })

  it("allows hosted URL when ALLOW_SEED_PROD is true", () => {
    expect(() =>
      assertSeedSafe({
        supabaseUrl: "https://zzdamokfeenencuggjjp.supabase.co",
        allowProd: true,
      })
    ).not.toThrow()
  })

  it("includes the target URL in the error message", () => {
    expect(() =>
      assertSeedSafe({
        supabaseUrl: "https://xybyzflfxnqqyxnvjklv.supabase.co",
        allowProd: false,
      })
    ).toThrow(/xybyzflfxnqqyxnvjklv\.supabase\.co/)
  })
})

describe("extractSupabaseProjectRef", () => {
  it("extracts ref from a pooler connection string", () => {
    expect(
      extractSupabaseProjectRef(
        "postgresql://postgres.zzdamokfeenencuggjjp:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
      )
    ).toBe("zzdamokfeenencuggjjp")
  })

  it("extracts ref from a direct connection string", () => {
    expect(
      extractSupabaseProjectRef(
        "postgresql://postgres:pw@db.zzdamokfeenencuggjjp.supabase.co:5432/postgres"
      )
    ).toBe("zzdamokfeenencuggjjp")
  })

  it("extracts ref from a Supabase API URL", () => {
    expect(extractSupabaseProjectRef("https://zzdamokfeenencuggjjp.supabase.co")).toBe(
      "zzdamokfeenencuggjjp"
    )
  })

  it("returns null for localhost connection strings", () => {
    expect(
      extractSupabaseProjectRef("postgresql://postgres:postgres@127.0.0.1:54322/postgres")
    ).toBeNull()
  })

  it("returns null for an empty string", () => {
    expect(extractSupabaseProjectRef("")).toBeNull()
  })
})

describe("assertStagingSeedSafe", () => {
  const stagingPooler =
    "postgresql://postgres.zzdamokfeenencuggjjp:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
  const stagingDirect =
    "postgresql://postgres:pw@db.zzdamokfeenencuggjjp.supabase.co:5432/postgres"
  const prodPooler =
    "postgresql://postgres.xybyzflfxnqqyxnvjklv:pw@aws-0-eu-central-2.pooler.supabase.com:6543/postgres"
  const unknownHosted =
    "postgresql://postgres.abcdefghijklmnopqrst:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
  const local = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

  it("allows the staging pooler URL", () => {
    expect(() => assertStagingSeedSafe({ databaseUrl: stagingPooler })).not.toThrow()
  })

  it("allows the staging direct URL", () => {
    expect(() => assertStagingSeedSafe({ databaseUrl: stagingDirect })).not.toThrow()
  })

  it("rejects the production project ref", () => {
    expect(() => assertStagingSeedSafe({ databaseUrl: prodPooler })).toThrow(/production/i)
  })

  it("rejects an unknown hosted project ref", () => {
    expect(() => assertStagingSeedSafe({ databaseUrl: unknownHosted })).toThrow(
      /not the allowed staging project/i
    )
  })

  it("allows localhost in default (local dev) mode", () => {
    expect(() => assertStagingSeedSafe({ databaseUrl: local })).not.toThrow()
  })

  it("rejects localhost when staging is required", () => {
    expect(() =>
      assertStagingSeedSafe({ databaseUrl: local, requireStaging: true })
    ).toThrow(/localhost/i)
  })

  it("rejects production even when staging is required", () => {
    expect(() =>
      assertStagingSeedSafe({ databaseUrl: prodPooler, requireStaging: true })
    ).toThrow(/production/i)
  })

  it("falls back to supabaseUrl when databaseUrl is unparseable", () => {
    expect(() =>
      assertStagingSeedSafe({
        databaseUrl: "",
        supabaseUrl: "https://zzdamokfeenencuggjjp.supabase.co",
      })
    ).not.toThrow()
  })

  it("includes the offending ref in the error message", () => {
    expect(() => assertStagingSeedSafe({ databaseUrl: prodPooler })).toThrow(
      /xybyzflfxnqqyxnvjklv/
    )
  })
})
