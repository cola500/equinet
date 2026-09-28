import { describe, it, expect, beforeEach, vi } from "vitest"
import { nextConfig } from "./next.config"

/**
 * Regression test for the local-dev img-src CSP gap: uploaded message
 * attachments (Supabase Storage) rendered in the messaging dialog, but the
 * signed-URL <img> was silently blocked by CSP in local dev because img-src
 * lacked the local Supabase origins that connect-src already allowed.
 *
 * The fix reuses the SAME localSupabaseCsp gate already trusted for
 * connect-src (isDev || isLocalSupabase) — this test exists specifically to
 * catch any future drift where img-src and connect-src fall out of sync, and
 * to prove the local origins never leak into a production build.
 */

async function catchAllCsp(): Promise<string> {
  const headers = await nextConfig.headers!()
  const entry = headers.find((h) => h.source === "/:path*")
  const csp = entry?.headers.find((h) => h.key === "Content-Security-Policy")
  if (!csp) throw new Error("No Content-Security-Policy header found for /:path*")
  return csp.value
}

async function routePlanningCsp(): Promise<string> {
  const headers = await nextConfig.headers!()
  const entry = headers.find((h) => h.source === "/provider/route-planning")
  const csp = entry?.headers.find((h) => h.key === "Content-Security-Policy")
  if (!csp) throw new Error("No Content-Security-Policy header found for /provider/route-planning")
  return csp.value
}

function imgSrcDirective(csp: string): string {
  const match = csp.split("; ").find((d) => d.startsWith("img-src"))
  if (!match) throw new Error("No img-src directive found in CSP")
  return match
}

describe("next.config CSP img-src (local Supabase Storage)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it("includes local Supabase origins in dev mode", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://xyzabc.supabase.co") // even with a remote URL configured

    const imgSrc = imgSrcDirective(await catchAllCsp())

    expect(imgSrc).toContain("http://127.0.0.1:54321")
    expect(imgSrc).toContain("http://localhost:54321")
  })

  it("includes local Supabase origins when NEXT_PUBLIC_SUPABASE_URL points at 127.0.0.1 (prod build run locally, e.g. offline E2E)", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")

    const imgSrc = imgSrcDirective(await catchAllCsp())

    expect(imgSrc).toContain("http://127.0.0.1:54321")
    expect(imgSrc).toContain("http://localhost:54321")
  })

  it("includes local Supabase origins when NEXT_PUBLIC_SUPABASE_URL points at localhost", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321")

    const imgSrc = imgSrcDirective(await catchAllCsp())

    expect(imgSrc).toContain("http://127.0.0.1:54321")
    expect(imgSrc).toContain("http://localhost:54321")
  })

  it("does NOT include local Supabase origins in a production build against a real Supabase project", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://xyzabc.supabase.co")

    const imgSrc = imgSrcDirective(await catchAllCsp())

    expect(imgSrc).not.toContain("127.0.0.1")
    expect(imgSrc).not.toContain("localhost")
    // The rest of the directive must stay exactly as before this change.
    expect(imgSrc).toBe("img-src 'self' data: blob: https:")
  })

  it("keeps every other CSP directive unchanged regardless of the local-Supabase gate", async () => {
    // Hold NODE_ENV fixed at "production" so only the Supabase-URL-driven
    // isLocalSupabase gate varies — isolates this change from the
    // separately-existing, unrelated isDev differences (script-src,
    // upgrade-insecure-requests).
    vi.stubEnv("NODE_ENV", "production")

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://xyzabc.supabase.co")
    const remoteCsp = await catchAllCsp()

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
    const localCsp = await catchAllCsp()

    // img-src/connect-src: this change. upgrade-insecure-requests: pre-existing,
    // unrelated use of the same isLocalSupabase gate — untouched by this change.
    const stripLocalGatedDirectives = (csp: string) =>
      csp
        .split("; ")
        .filter(
          (d) =>
            !d.startsWith("img-src") &&
            !d.startsWith("connect-src") &&
            d !== "upgrade-insecure-requests"
        )
        .join("; ")

    expect(stripLocalGatedDirectives(localCsp)).toBe(stripLocalGatedDirectives(remoteCsp))
  })

  it("also applies the same local-only gate on the /provider/route-planning img-src", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://xyzabc.supabase.co")
    const devImgSrc = imgSrcDirective(await routePlanningCsp())
    expect(devImgSrc).toContain("http://127.0.0.1:54321")
    expect(devImgSrc).toContain("http://localhost:54321")

    vi.stubEnv("NODE_ENV", "production")
    const prodImgSrc = imgSrcDirective(await routePlanningCsp())
    expect(prodImgSrc).not.toContain("127.0.0.1")
    expect(prodImgSrc).not.toContain("localhost")
  })
})
