/**
 * POST/DELETE /api/auth/mobile-token tests
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({ auth: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { mobileToken: vi.fn() },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))
vi.mock("@/lib/mobile-auth", () => ({
  getMobileTokenService: vi.fn(),
  authFromMobileToken: vi.fn(),
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { POST, DELETE } from "./route"
import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { getMobileTokenService, authFromMobileToken } from "@/lib/mobile-auth"

const mockAuth = vi.mocked(auth)
const mockRateLimit = vi.mocked(rateLimiters.mobileToken)
const mockGetService = vi.mocked(getMobileTokenService)
const mockAuthFromMobileToken = vi.mocked(authFromMobileToken)

const mockSession = {
  user: { id: "user-1", email: "test@test.se", userType: "provider" },
} as never

const mockService = {
  generateToken: vi.fn(),
  verifyToken: vi.fn(),
  refreshToken: vi.fn(),
  revokeToken: vi.fn(),
  revokeAllForUser: vi.fn(),
}

function createPostRequest(body: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost:3000/api/auth/mobile-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function createDeleteRequest() {
  return new NextRequest("http://localhost:3000/api/auth/mobile-token", {
    method: "DELETE",
    headers: { Authorization: "Bearer test-jwt-token" },
  })
}

describe("POST /api/auth/mobile-token", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(mockSession)
    mockRateLimit.mockResolvedValue(true)
    mockGetService.mockReturnValue(mockService as never)
    mockService.generateToken.mockResolvedValue({
      jwt: "eyJ.test.jwt",
      expiresAt: new Date("2026-06-06T00:00:00Z"),
    })
  })

  it("throws 401 response when not authenticated", async () => {
    const authResponse = new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401 }
    )
    mockAuth.mockRejectedValue(authResponse)
    await expect(POST(createPostRequest())).rejects.toBe(authResponse)
  })

  it("returns 401 when session is null", async () => {
    mockAuth.mockResolvedValue(null as never)
    const res = await POST(createPostRequest())
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await POST(createPostRequest())
    expect(res.status).toBe(429)
  })

  it("returns token on success", async () => {
    const res = await POST(createPostRequest({ deviceName: "iPhone 15" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.token).toBe("eyJ.test.jwt")
    expect(body.expiresAt).toBe("2026-06-06T00:00:00.000Z")
    expect(mockService.generateToken).toHaveBeenCalledWith("user-1", "iPhone 15")
  })

  it("works without deviceName", async () => {
    const res = await POST(createPostRequest({}))
    expect(res.status).toBe(200)
    expect(mockService.generateToken).toHaveBeenCalledWith("user-1", undefined)
  })

  it("returns 409 when max active tokens exceeded", async () => {
    const { MaxTokensExceededError } = await import("@/domain/auth/MobileTokenService")
    mockService.generateToken.mockRejectedValue(new MaxTokensExceededError("user-1"))
    const res = await POST(createPostRequest())
    expect(res.status).toBe(409)
  })

  it("returns 400 for invalid body (extra fields with strict)", async () => {
    const res = await POST(createPostRequest({ deviceName: "iPhone", extraField: true }))
    expect(res.status).toBe(400)
  })
})

describe("DELETE /api/auth/mobile-token", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthFromMobileToken.mockResolvedValue({
      userId: "user-1",
      tokenId: "token-1",
    })
    mockGetService.mockReturnValue(mockService as never)
  })

  it("returns 401 when Bearer token is invalid", async () => {
    mockAuthFromMobileToken.mockResolvedValue(null)
    const res = await DELETE(createDeleteRequest())
    expect(res.status).toBe(401)
  })

  it("revokes token and returns 200", async () => {
    const res = await DELETE(createDeleteRequest())
    expect(res.status).toBe(200)
    expect(mockService.revokeToken).toHaveBeenCalledWith("token-1", "user-1")
  })
})
