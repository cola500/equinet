import { describe, it, expect, afterEach, vi } from "vitest"
import { GET } from "./route"

describe("GET /api/test/payment-provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns 404 unless test endpoints are explicitly allowed", async () => {
    vi.stubEnv("ALLOW_TEST_ENDPOINTS", "")

    const res = await GET()

    expect(res.status).toBe(404)
  })

  it("reports the mock gateway when PAYMENT_PROVIDER is not stripe", async () => {
    vi.stubEnv("ALLOW_TEST_ENDPOINTS", "true")
    vi.stubEnv("PAYMENT_PROVIDER", "mock")

    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ provider: "mock" })
  })

  it("reports stripe without exposing any key", async () => {
    vi.stubEnv("ALLOW_TEST_ENDPOINTS", "true")
    vi.stubEnv("PAYMENT_PROVIDER", "stripe")
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy")

    const res = await GET()
    const body = await res.json()

    expect(body).toEqual({ provider: "stripe" })
    expect(JSON.stringify(body)).not.toContain("sk_")
  })
})
