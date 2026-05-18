import { describe, it, expect, beforeEach, vi } from "vitest"

describe("robots.ts", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("disallows all crawlers in demo mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true")
    const robots = (await import("./robots")).default
    const result = robots()

    expect(result.rules).toEqual([{ userAgent: "*", disallow: "/" }])
    expect(result.sitemap).toBeUndefined()
  })

  it("uses production rules with sitemap when demo mode is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "")
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
