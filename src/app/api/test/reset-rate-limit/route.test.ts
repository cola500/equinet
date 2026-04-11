import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/rate-limit", () => ({
  clearAllInMemoryRateLimits: vi.fn(),
  resetRateLimit: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from "./route"

describe("POST /api/test/reset-rate-limit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it("returns 404 when ALLOW_TEST_ENDPOINTS is not set", async () => {
    delete process.env.ALLOW_TEST_ENDPOINTS

    const res = await POST()

    expect(res.status).toBe(404)
  })

  it("returns 200 when ALLOW_TEST_ENDPOINTS is set", async () => {
    vi.stubEnv("ALLOW_TEST_ENDPOINTS", "true")

    const res = await POST()

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
  })
})
