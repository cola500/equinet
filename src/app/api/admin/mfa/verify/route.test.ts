import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

const mockGetAuthUser = vi.fn()
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}))

const mockMfaChallenge = vi.fn()
const mockMfaVerify = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      mfa: {
        challenge: () => mockMfaChallenge(),
        verify: () => mockMfaVerify(),
      },
    },
  }),
}))

const mockRateLimiter = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    mfaVerify: (...args: unknown[]) => mockRateLimiter(...args),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class RateLimitServiceError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "RateLimitServiceError"
    }
  },
}))

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), security: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}))

import { POST } from "./route"

const adminUser = {
  id: "a0000000-0000-4000-a000-000000000001",
  email: "admin@test.se",
  userType: "customer",
  isAdmin: true,
  providerId: null,
  stableId: null,
  authMethod: "supabase" as const,
}

const validFactorId = "a0000000-0000-4000-a000-000000000002"

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/admin/mfa/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/admin/mfa/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(adminUser)
    mockRateLimiter.mockResolvedValue(true)
    mockMfaChallenge.mockResolvedValue({
      data: { id: "challenge-1" },
      error: null,
    })
    mockMfaVerify.mockResolvedValue({ data: {}, error: null })
  })

  it("returns 401 when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const res = await POST(makeRequest({ factorId: validFactorId, code: "123456" }))
    expect(res.status).toBe(401)
  })

  it("returns 403 when not admin", async () => {
    mockGetAuthUser.mockResolvedValue({ ...adminUser, isAdmin: false })
    const res = await POST(makeRequest({ factorId: validFactorId, code: "123456" }))
    expect(res.status).toBe(403)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimiter.mockResolvedValue(false)
    const res = await POST(makeRequest({ factorId: validFactorId, code: "123456" }))
    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.error).toContain("För många")
  })

  it("returns 503 when rate limit service is unavailable", async () => {
    const { RateLimitServiceError } = await import("@/lib/rate-limit")
    mockRateLimiter.mockRejectedValue(new RateLimitServiceError("Redis down"))
    const res = await POST(makeRequest({ factorId: validFactorId, code: "123456" }))
    expect(res.status).toBe(503)
  })

  it("returns 400 for invalid body (missing code)", async () => {
    const res = await POST(makeRequest({ factorId: validFactorId }))
    expect(res.status).toBe(400)
  })

  it("returns 400 if code is wrong length", async () => {
    const res = await POST(makeRequest({ factorId: validFactorId, code: "12345" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 if factorId is not a UUID", async () => {
    const res = await POST(makeRequest({ factorId: "not-a-uuid", code: "123456" }))
    expect(res.status).toBe(400)
  })

  it("returns 200 on successful verify", async () => {
    const res = await POST(makeRequest({ factorId: validFactorId, code: "123456" }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it("calls rate limiter with userId", async () => {
    await POST(makeRequest({ factorId: validFactorId, code: "123456" }))
    expect(mockRateLimiter).toHaveBeenCalledWith(adminUser.id)
  })

  it("returns 401 if challenge fails", async () => {
    mockMfaChallenge.mockResolvedValue({
      data: null,
      error: { message: "factor not found" },
    })
    const res = await POST(makeRequest({ factorId: validFactorId, code: "123456" }))
    expect(res.status).toBe(401)
  })

  it("returns 401 if verify fails (wrong code)", async () => {
    mockMfaVerify.mockResolvedValue({
      data: null,
      error: { message: "Invalid TOTP code" },
    })
    const res = await POST(makeRequest({ factorId: validFactorId, code: "999999" }))
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toContain("Felaktig")
  })
})
