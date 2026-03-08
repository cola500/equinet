/**
 * POST /api/auth/native-login tests
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { login: vi.fn() },
  resetRateLimit: vi.fn(),
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))
vi.mock("@/domain/auth/AuthService", () => ({
  createAuthService: vi.fn(),
}))
vi.mock("@/lib/mobile-auth", () => ({
  getMobileTokenService: vi.fn(),
  createSessionCookieValue: vi.fn(),
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { POST } from "./route"
import { rateLimiters, resetRateLimit } from "@/lib/rate-limit"
import { createAuthService } from "@/domain/auth/AuthService"
import { getMobileTokenService, createSessionCookieValue } from "@/lib/mobile-auth"
import { Result } from "@/domain/shared"

const mockRateLimit = vi.mocked(rateLimiters.login)
const mockResetRateLimit = vi.mocked(resetRateLimit)
const mockCreateAuthService = vi.mocked(createAuthService)
const mockGetMobileTokenService = vi.mocked(getMobileTokenService)
const mockCreateSessionCookieValue = vi.mocked(createSessionCookieValue)

const mockAuthService = {
  verifyCredentials: vi.fn(),
}

const mockTokenService = {
  generateToken: vi.fn(),
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
  return new NextRequest("http://localhost:3000/api/auth/native-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/auth/native-login", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue(true)
    mockCreateAuthService.mockReturnValue(mockAuthService as never)
    mockGetMobileTokenService.mockReturnValue(mockTokenService as never)
    mockAuthService.verifyCredentials.mockResolvedValue(
      Result.ok(verifiedUser)
    )
    mockTokenService.generateToken.mockResolvedValue({
      jwt: "eyJ.test.jwt",
      expiresAt: new Date("2026-06-06T00:00:00Z"),
    })
    mockCreateSessionCookieValue.mockResolvedValue({
      name: "next-auth.session-token",
      value: "signed-session-jwt",
      maxAge: 86400,
      secure: false,
      domain: "localhost",
    })
  })

  it("returns token, sessionCookie, and user on successful login", async () => {
    const res = await POST(
      createRequest({ email: "test@test.se", password: "password123" })
    )
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.token).toBe("eyJ.test.jwt")
    expect(body.expiresAt).toBe("2026-06-06T00:00:00.000Z")
    expect(body.sessionCookie).toEqual({
      name: "next-auth.session-token",
      value: "signed-session-jwt",
      maxAge: 86400,
      secure: false,
      domain: "localhost",
    })
    expect(body.user).toEqual({
      id: "user-1",
      name: "Test User",
      userType: "provider",
      providerId: "provider-1",
    })
  })

  it("resets rate limit on successful login", async () => {
    await POST(createRequest({ email: "Test@Test.se", password: "password123" }))
    expect(mockResetRateLimit).toHaveBeenCalledWith("test@test.se")
  })

  it("passes deviceName to token service", async () => {
    await POST(
      createRequest({
        email: "test@test.se",
        password: "password123",
        deviceName: "iPhone 15 Pro",
      })
    )
    expect(mockTokenService.generateToken).toHaveBeenCalledWith(
      "user-1",
      "iPhone 15 Pro"
    )
  })

  it("returns 401 for invalid credentials", async () => {
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
  })

  it("returns 403 for unverified email", async () => {
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
    expect(body.error).toBe("Kontot är inte verifierat")
  })

  it("returns 403 for blocked account", async () => {
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
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await POST(
      createRequest({ email: "test@test.se", password: "password123" })
    )
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toContain("För många inloggningsförsök")
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/native-login", {
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

  it("returns 409 when max tokens exceeded", async () => {
    const { MaxTokensExceededError } = await import(
      "@/domain/auth/MobileTokenService"
    )
    mockTokenService.generateToken.mockRejectedValue(
      new MaxTokensExceededError("user-1")
    )
    const res = await POST(
      createRequest({ email: "test@test.se", password: "password123" })
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain("Max antal")
  })

  it("rate limits by lowercase email", async () => {
    await POST(
      createRequest({ email: "Test@Test.SE", password: "password123" })
    )
    expect(mockRateLimit).toHaveBeenCalledWith("test@test.se")
  })
})
