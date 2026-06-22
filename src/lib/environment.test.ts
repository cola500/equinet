import { describe, it, expect, beforeEach, vi } from "vitest"
import { isStagingSafe } from "./environment"

describe("isStagingSafe", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns true (safe) when no env is set — local/test default", () => {
    // Neither IS_LIVE_PRODUCTION nor VERCEL_ENV present.
    expect(isStagingSafe()).toBe(true)
  })

  it("returns false (live production) only when IS_LIVE_PRODUCTION=true", () => {
    vi.stubEnv("IS_LIVE_PRODUCTION", "true")
    expect(isStagingSafe()).toBe(false)
  })

  it("returns true (safe) on staging's actual runtime: VERCEL_ENV=production WITHOUT IS_LIVE_PRODUCTION", () => {
    // This is the exact case PR #419 missed: staging deploys the staging branch
    // as its production target, so Vercel sets VERCEL_ENV=production on staging
    // too. The old VERCEL_ENV-based guard treated staging as "not safe" and
    // unblocked real side effects. The explicit IS_LIVE_PRODUCTION signal keeps
    // staging safe. This assertion would have been RED against #419.
    vi.stubEnv("VERCEL_ENV", "production")
    expect(isStagingSafe()).toBe(true)
  })

  it("returns true (safe) when IS_LIVE_PRODUCTION is set but empty", () => {
    // A blank env row (a known Vercel write footgun) must be treated as false,
    // i.e. safe — never accidentally unblock side effects.
    vi.stubEnv("IS_LIVE_PRODUCTION", "")
    expect(isStagingSafe()).toBe(true)
  })

  it("returns true (safe) for any value other than the exact string 'true'", () => {
    vi.stubEnv("IS_LIVE_PRODUCTION", "True")
    expect(isStagingSafe()).toBe(true)
    vi.stubEnv("IS_LIVE_PRODUCTION", "1")
    expect(isStagingSafe()).toBe(true)
    vi.stubEnv("IS_LIVE_PRODUCTION", "yes")
    expect(isStagingSafe()).toBe(true)
  })
})
