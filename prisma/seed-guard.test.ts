import { describe, it, expect } from "vitest"
import { assertSeedSafe } from "./seed-guard"

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
