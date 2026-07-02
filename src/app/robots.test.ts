import { describe, it, expect, beforeEach, vi } from "vitest"

describe("robots.ts", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("disallows all crawlers when not live production (default safe)", async () => {
    // No IS_LIVE_PRODUCTION → safe → noindex.
    const robots = (await import("./robots")).default
    const result = robots()

    expect(result.rules).toEqual([{ userAgent: "*", disallow: "/" }])
    expect(result.sitemap).toBeUndefined()
  })

  it("stays noindex on staging's runtime: VERCEL_ENV=production WITHOUT IS_LIVE_PRODUCTION", async () => {
    // Regression for #419: staging reports VERCEL_ENV=production but must not be
    // indexable. RED against the reverted #419 guard, which flipped robots.txt
    // to indexable on staging.
    vi.stubEnv("VERCEL_ENV", "production")
    const robots = (await import("./robots")).default
    const result = robots()

    expect(result.rules).toEqual([{ userAgent: "*", disallow: "/" }])
    expect(result.sitemap).toBeUndefined()
  })

  it("uses production rules with sitemap in live production (IS_LIVE_PRODUCTION=true)", async () => {
    vi.stubEnv("IS_LIVE_PRODUCTION", "true")
    const robots = (await import("./robots")).default
    const result = robots()

    expect(Array.isArray(result.rules) ? result.rules[0] : result.rules).toMatchObject({
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/", "/provider/", "/stable/"],
    })
    expect(result.sitemap).toBe("https://equinet-app.vercel.app/sitemap.xml")
  })
})
