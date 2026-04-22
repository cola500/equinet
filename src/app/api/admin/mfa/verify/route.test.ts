import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

const mockGetAuthUser = vi.fn()
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}))

const mockMfaChallenge = vi.fn()
const mockMfaVerify = vi.fn()
const mockListFactors = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      mfa: {
        challenge: () => mockMfaChallenge(),
        verify: () => mockMfaVerify(),
        listFactors: () => mockListFactors(),
      },
    },
  }),
}))

const mockRateLimiter = vi.fn()
const mockResetRateLimit = vi.fn()
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    mfaVerify: (...args: unknown[]) => mockRateLimiter(...args),
  },
  resetRateLimit: (...args: unknown[]) => mockResetRateLimit(...args),
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

const mockAuditCreate = vi.fn().mockResolvedValue({})
vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminAuditLog: { create: (...args: unknown[]) => mockAuditCreate(...args) },
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
const otherFactorId = "a0000000-0000-4000-a000-000000000003"

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
    mockResetRateLimit.mockResolvedValue(undefined)
    mockListFactors.mockResolvedValue({
      data: {
        all: [{ id: validFactorId, factor_type: "totp", status: "verified" }],
        totp: [{ id: validFactorId }],
      },
      error: null,
    })
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

  // --- S51-0.1: Rate-limit ordering (B1) ---

  it("does not consume rate limit on zod-fail (rate limiter not called)", async () => {
    const res = await POST(makeRequest({ factorId: validFactorId })) // missing code
    expect(res.status).toBe(400)
    expect(mockRateLimiter).not.toHaveBeenCalled()
  })

  it("resets rate limit on success (net zero consumption)", async () => {
    const res = await POST(makeRequest({ factorId: validFactorId, code: "123456" }))
    expect(res.status).toBe(200)
    expect(mockRateLimiter).toHaveBeenCalledWith(adminUser.id)
    expect(mockResetRateLimit).toHaveBeenCalledWith(adminUser.id, "mfaVerify")
  })

  it("does not reset rate limit on verify-fail (token stays consumed)", async () => {
    mockMfaVerify.mockResolvedValue({ data: null, error: { message: "Invalid TOTP code" } })
    const res = await POST(makeRequest({ factorId: validFactorId, code: "999999" }))
    expect(res.status).toBe(401)
    expect(mockRateLimiter).toHaveBeenCalledWith(adminUser.id)
    expect(mockResetRateLimit).not.toHaveBeenCalled()
  })

  // --- S51-0.1: IDOR-check (B2) ---

  it("returns 403 when factorId does not belong to session user and does not reset rate limit", async () => {
    // listFactors returns only validFactorId, but request sends otherFactorId
    const res = await POST(makeRequest({ factorId: otherFactorId, code: "123456" }))
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain("Åtkomst nekad")
    expect(mockResetRateLimit).not.toHaveBeenCalled()
  })

  // --- S51-0.1: AdminAuditLog on challenge-failure (M1) ---

  it("writes AdminAuditLog on challenge failure", async () => {
    mockMfaChallenge.mockResolvedValue({ data: null, error: { message: "factor not found" } })
    await POST(makeRequest({ factorId: validFactorId, code: "123456" }))
    await new Promise((r) => setTimeout(r, 0))
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "mfa.challenge.failure" }),
      })
    )
  })
})
