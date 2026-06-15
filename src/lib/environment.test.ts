import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { isStagingSafe } from "./environment"

describe("isStagingSafe", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("is NOT safe in production (real side effects allowed)", () => {
    vi.stubEnv("VERCEL_ENV", "production")
    expect(isStagingSafe()).toBe(false)
  })

  it("is safe in preview deployments (staging runs as a preview)", () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    expect(isStagingSafe()).toBe(true)
  })

  it("is safe in development deployments", () => {
    vi.stubEnv("VERCEL_ENV", "development")
    expect(isStagingSafe()).toBe(true)
  })

  it("defaults to safe when VERCEL_ENV is unset (local/test)", () => {
    vi.stubEnv("VERCEL_ENV", "")
    expect(isStagingSafe()).toBe(true)
  })

  it("is independent of demo mode (decoupled from NEXT_PUBLIC_DEMO_MODE)", () => {
    // Demo off but production → not safe; demo has no influence on the signal.
    vi.stubEnv("VERCEL_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false")
    expect(isStagingSafe()).toBe(false)

    // Demo off but preview → still safe; the environment drives it, not demo.
    vi.stubEnv("VERCEL_ENV", "preview")
    expect(isStagingSafe()).toBe(true)
  })
})
