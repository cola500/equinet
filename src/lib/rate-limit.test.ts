import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"

// ---
// In-memory mode tests (default when UPSTASH env vars are absent)
// ---

describe("rate-limit (in-memory mode)", () => {
  // We need to reset modules between groups that toggle env vars
  let rateLimiters: typeof import("./rate-limit")["rateLimiters"]
  let getClientIP: typeof import("./rate-limit")["getClientIP"]
  let resetRateLimit: typeof import("./rate-limit")["resetRateLimit"]

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.resetModules()
    // Ensure Upstash is NOT configured
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN

    const mod = await import("./rate-limit")
    rateLimiters = mod.rateLimiters
    getClientIP = mod.getClientIP
    resetRateLimit = mod.resetRateLimit
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // --- getClientIP ---

  describe("getClientIP", () => {
    function makeRequest(headers: Record<string, string> = {}): Request {
      const h = new Headers()
      for (const [k, v] of Object.entries(headers)) {
        h.set(k, v)
      }
      return new Request("http://localhost/test", { headers: h })
    }

    it("should return x-real-ip when valid IPv4", () => {
      const req = makeRequest({ "x-real-ip": "203.0.113.1" })
      expect(getClientIP(req)).toBe("203.0.113.1")
    })

    it("should return first IP from x-forwarded-for when valid", () => {
      const req = makeRequest({ "x-forwarded-for": "198.51.100.5, 10.0.0.1" })
      expect(getClientIP(req)).toBe("198.51.100.5")
    })

    it("should prioritize x-real-ip over x-forwarded-for", () => {
      const req = makeRequest({
        "x-real-ip": "203.0.113.1",
        "x-forwarded-for": "198.51.100.5",
      })
      expect(getClientIP(req)).toBe("203.0.113.1")
    })

    it("should return 'unknown' when no headers present", () => {
      const req = makeRequest()
      expect(getClientIP(req)).toBe("unknown")
    })

    it("should skip invalid x-real-ip (XSS attempt) and fall to x-forwarded-for", () => {
      const req = makeRequest({
        "x-real-ip": "<script>alert(1)</script>",
        "x-forwarded-for": "198.51.100.5",
      })
      expect(getClientIP(req)).toBe("198.51.100.5")
    })

    it("should skip invalid x-real-ip and return 'unknown' when no valid fallback", () => {
      const req = makeRequest({ "x-real-ip": "not-an-ip" })
      expect(getClientIP(req)).toBe("unknown")
    })

    it("should handle comma-separated IPs in x-forwarded-for and return first", () => {
      const req = makeRequest({ "x-forwarded-for": "192.168.1.1, 10.0.0.1, 172.16.0.1" })
      expect(getClientIP(req)).toBe("192.168.1.1")
    })

    it("should return 'unknown' when first IP in x-forwarded-for is invalid", () => {
      const req = makeRequest({ "x-forwarded-for": "garbage, 10.0.0.1" })
      expect(getClientIP(req)).toBe("unknown")
    })

    it("should accept valid IPv6 address", () => {
      const req = makeRequest({ "x-real-ip": "2001:db8::1" })
      expect(getClientIP(req)).toBe("2001:db8::1")
    })

    it("should return 'unknown' for empty string in x-real-ip", () => {
      const req = makeRequest({ "x-real-ip": "" })
      expect(getClientIP(req)).toBe("unknown")
    })
  })

  // --- rateLimiters (in-memory) ---

  describe("rateLimiters (in-memory fallback)", () => {
    it("should allow first request for new identifier", async () => {
      const result = await rateLimiters.login("new-user@test.com")
      expect(result).toBe(true)
    })

    it("should allow requests under the limit", async () => {
      // In-memory login limit is 50 in dev/test
      for (let i = 0; i < 10; i++) {
        const result = await rateLimiters.login("under-limit@test.com")
        expect(result).toBe(true)
      }
    })

    it("should block requests over the limit", async () => {
      const identifier = "over-limit@test.com"
      // In-memory registration limit is 50
      for (let i = 0; i < 50; i++) {
        await rateLimiters.registration(identifier)
      }

      const blocked = await rateLimiters.registration(identifier)
      expect(blocked).toBe(false)
    })

    it("should use separate counters for different identifiers", async () => {
      const id1 = "user-a@test.com"
      const id2 = "user-b@test.com"

      // Exhaust id1
      for (let i = 0; i < 50; i++) {
        await rateLimiters.registration(id1)
      }
      const blockedId1 = await rateLimiters.registration(id1)
      expect(blockedId1).toBe(false)

      // id2 should still be allowed
      const allowedId2 = await rateLimiters.registration(id2)
      expect(allowedId2).toBe(true)
    })

    it("should reset counter after window expires", async () => {
      const identifier = "window-test@test.com"

      // Exhaust the limit (registration = 50 req / 1 hour)
      for (let i = 0; i < 50; i++) {
        await rateLimiters.registration(identifier)
      }
      expect(await rateLimiters.registration(identifier)).toBe(false)

      // Advance past the window (1 hour + 1 ms)
      vi.advanceTimersByTime(60 * 60 * 1000 + 1)

      // Should be allowed again
      const result = await rateLimiters.registration(identifier)
      expect(result).toBe(true)
    })

    it("should have all 9 limiter types callable", async () => {
      const limiterTypes = [
        "login",
        "registration",
        "api",
        "passwordReset",
        "booking",
        "profileUpdate",
        "serviceCreate",
        "geocode",
        "resendVerification",
      ] as const

      for (const type of limiterTypes) {
        const result = await rateLimiters[type](`test-${type}`)
        expect(result).toBe(true)
      }
    })
  })

  // --- resetRateLimit ---

  describe("resetRateLimit", () => {
    it("should reset counter for an identifier", async () => {
      const identifier = "reset-test@test.com"

      // Exhaust the limit
      for (let i = 0; i < 50; i++) {
        await rateLimiters.registration(identifier)
      }
      expect(await rateLimiters.registration(identifier)).toBe(false)

      // Reset
      await resetRateLimit(identifier)

      // Should be allowed again
      const result = await rateLimiters.registration(identifier)
      expect(result).toBe(true)
    })

    it("should not affect other identifiers", async () => {
      const id1 = "reset-a@test.com"
      const id2 = "reset-b@test.com"

      // Use up some of both
      for (let i = 0; i < 50; i++) {
        await rateLimiters.registration(id1)
        await rateLimiters.registration(id2)
      }

      // Reset only id1
      await resetRateLimit(id1)

      expect(await rateLimiters.registration(id1)).toBe(true)
      expect(await rateLimiters.registration(id2)).toBe(false)
    })
  })
})

// ---
// Upstash mode tests (mocked)
// ---

describe("rate-limit (Upstash mode)", () => {
  const mockLimit = vi.fn()

  // vi.mock is hoisted -- these run before any imports
  vi.mock("@upstash/ratelimit", () => {
    const mockLimitFn = vi.fn()
    class MockRatelimit {
      limit = mockLimitFn
      // Ratelimit.slidingWindow is a static method
      static slidingWindow() {
        return {}
      }
    }
    return { Ratelimit: MockRatelimit, __mockLimit: mockLimitFn }
  })

  vi.mock("@upstash/redis", () => {
    class MockRedis {}
    return { Redis: MockRedis }
  })

  beforeEach(async () => {
    vi.resetModules()

    // Set Upstash env vars BEFORE importing
    process.env.UPSTASH_REDIS_REST_URL = "https://fake-redis.upstash.io"
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token"

    // Get reference to the mock function from the mocked module
    const { __mockLimit } = await import("@upstash/ratelimit") as any
    // Sync our local reference
    mockLimit.mockImplementation((...args: any[]) => __mockLimit(...args))
    // Clear previous calls
    __mockLimit.mockReset()
  })

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  it("should allow request when Upstash returns success: true", async () => {
    const { __mockLimit } = await import("@upstash/ratelimit") as any
    __mockLimit.mockResolvedValue({ success: true })

    const { rateLimiters } = await import("./rate-limit")
    const result = await rateLimiters.login("test@example.com")
    expect(result).toBe(true)
  })

  it("should block request when Upstash returns success: false", async () => {
    const { __mockLimit } = await import("@upstash/ratelimit") as any
    __mockLimit.mockResolvedValue({ success: false })

    const { rateLimiters } = await import("./rate-limit")
    const result = await rateLimiters.login("test@example.com")
    expect(result).toBe(false)
  })

  it("should fail-open when Upstash throws an error", async () => {
    const { __mockLimit } = await import("@upstash/ratelimit") as any
    __mockLimit.mockRejectedValue(new Error("Upstash connection failed"))

    const { rateLimiters } = await import("./rate-limit")
    const result = await rateLimiters.login("test@example.com")
    expect(result).toBe(true) // fail-open
  })
})
