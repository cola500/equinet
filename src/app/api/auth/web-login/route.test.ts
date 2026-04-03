/**
 * POST /api/auth/web-login tests
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { login: vi.fn() },
  resetRateLimit: vi.fn(),
}))
vi.mock("@/domain/auth/AuthService", () => ({
  createAuthService: vi.fn(),
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { POST } from "./route"
import { rateLimiters, resetRateLimit } from "@/lib/rate-limit"
import { createAuthService } from "@/domain/auth/AuthService"
import { Result } from "@/domain/shared"

const mockRateLimit = vi.mocked(rateLimiters.login)
const mockResetRateLimit = vi.mocked(resetRateLimit)
const mockCreateAuthService = vi.mocked(createAuthService)

const mockAuthService = {
  verifyCredentials: vi.fn(),
}

const verifiedUser = {
  id: "user-1",
  email: "test@test.se",
  name: "Test User",
  userType: "provider",
  isAdmin: false,
  providerId: "provider-1",
}

function createRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/auth/web-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/auth/web-login", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue(true)
    mockCreateAuthService.mockReturnValue(mockAuthService as never)
    mockAuthService.verifyCredentials.mockResolvedValue(
      Result.ok(verifiedUser)
    )
  })

  // --- Success ---

  it("returns 200 with success and type on valid credentials", async () => {
    const res = await POST(
      createRequest({ email: "test@test.se", password: "password123" })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it("resets rate limit on successful login", async () => {
    await POST(
      createRequest({ email: "Test@Test.se", password: "password123" })
    )
    expect(mockResetRateLimit).toHaveBeenCalledWith("test@test.se")
  })

  // --- Auth errors ---

  it("returns 401 with type INVALID_CREDENTIALS for wrong password", async () => {
    mockAuthService.verifyCredentials.mockResolvedValue(
      Result.fail({
        type: "INVALID_CREDENTIALS",
        message: "Ogiltig email eller lösenord",
      })
    )
    const res = await POST(
      createRequest({ email: "test@test.se", password: "wrong" })
    )
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Ogiltig email eller lösenord")
    expect(body.type).toBe("INVALID_CREDENTIALS")
  })

  it("returns 403 with type EMAIL_NOT_VERIFIED for unverified email", async () => {
    mockAuthService.verifyCredentials.mockResolvedValue(
      Result.fail({
        type: "EMAIL_NOT_VERIFIED",
        message: "EMAIL_NOT_VERIFIED",
      })
    )
    const res = await POST(
      createRequest({ email: "test@test.se", password: "password123" })
    )
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("Din e-post är inte verifierad")
    expect(body.type).toBe("EMAIL_NOT_VERIFIED")
  })

  it("returns 403 with type ACCOUNT_BLOCKED for blocked account", async () => {
    mockAuthService.verifyCredentials.mockResolvedValue(
      Result.fail({
        type: "ACCOUNT_BLOCKED",
        message: "Ditt konto har blockerats",
      })
    )
    const res = await POST(
      createRequest({ email: "test@test.se", password: "password123" })
    )
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("Ditt konto har blockerats")
    expect(body.type).toBe("ACCOUNT_BLOCKED")
  })

  // --- Rate limiting ---

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await POST(
      createRequest({ email: "test@test.se", password: "password123" })
    )
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toContain("För många inloggningsförsök")
  })

  it("rate limits by lowercase email", async () => {
    await POST(
      createRequest({ email: "Test@Test.SE", password: "password123" })
    )
    expect(mockRateLimit).toHaveBeenCalledWith("test@test.se")
  })

  // --- Validation ---

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/web-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Ogiltig JSON")
  })

  it("returns 400 when Zod rejects extra fields (strict)", async () => {
    const res = await POST(
      createRequest({
        email: "test@test.se",
        password: "password123",
        extraField: "hacker",
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Valideringsfel")
  })

  it("returns 400 when email is missing", async () => {
    const res = await POST(createRequest({ password: "password123" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when password is missing", async () => {
    const res = await POST(createRequest({ email: "test@test.se" }))
    expect(res.status).toBe(400)
  })

  // --- Server error ---

  it("returns 500 on unexpected error", async () => {
    mockAuthService.verifyCredentials.mockRejectedValue(
      new Error("DB connection lost")
    )
    const res = await POST(
      createRequest({ email: "test@test.se", password: "password123" })
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Internt serverfel")
  })
})
