/**
 * POST /api/auth/mobile-token/refresh tests
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/mobile-auth", () => ({
  getMobileTokenService: vi.fn(),
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { mobileToken: vi.fn() },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { POST } from "./route"
import { getMobileTokenService } from "@/lib/mobile-auth"
import { rateLimiters } from "@/lib/rate-limit"

const mockGetService = vi.mocked(getMobileTokenService)
const mockRateLimit = vi.mocked(rateLimiters.mobileToken)

const mockService = {
  generateToken: vi.fn(),
  verifyToken: vi.fn(),
  refreshToken: vi.fn(),
  revokeToken: vi.fn(),
  revokeAllForUser: vi.fn(),
}

function createRequest() {
  return new NextRequest("http://localhost:3000/api/auth/mobile-token/refresh", {
    method: "POST",
    headers: { Authorization: "Bearer old-jwt-token" },
  })
}

describe("POST /api/auth/mobile-token/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetService.mockReturnValue(mockService as never)
    mockRateLimit.mockResolvedValue(true)
    mockService.refreshToken.mockResolvedValue({
      jwt: "eyJ.new.jwt",
      expiresAt: new Date("2026-09-06T00:00:00Z"),
    })
  })

  it("returns 401 when no Bearer token", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/mobile-token/refresh", {
      method: "POST",
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await POST(createRequest())
    expect(res.status).toBe(429)
  })

  it("returns 401 when refresh fails (invalid/expired token)", async () => {
    mockService.refreshToken.mockResolvedValue(null)
    const res = await POST(createRequest())
    expect(res.status).toBe(401)
  })

  it("returns new token on successful refresh", async () => {
    const res = await POST(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.token).toBe("eyJ.new.jwt")
    expect(body.expiresAt).toBe("2026-09-06T00:00:00.000Z")
    expect(mockService.refreshToken).toHaveBeenCalledWith("old-jwt-token")
  })
})
