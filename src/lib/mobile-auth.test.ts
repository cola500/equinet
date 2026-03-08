/**
 * mobile-auth helper tests
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"

const mockVerifyToken = vi.fn()

vi.mock("@/domain/auth/MobileTokenService", () => {
  return {
    MobileTokenService: class {
      verifyToken = mockVerifyToken
      generateToken = vi.fn()
      refreshToken = vi.fn()
      revokeToken = vi.fn()
      revokeAllForUser = vi.fn()
    },
  }
})

vi.mock("@/infrastructure/persistence/mobile-token", () => ({
  mobileTokenRepository: {},
}))

// Must set NEXTAUTH_SECRET before importing
process.env.NEXTAUTH_SECRET = "test-secret-that-is-at-least-32-characters-long"

import { authFromMobileToken, getMobileTokenService } from "./mobile-auth"

describe("authFromMobileToken", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null when no Authorization header", async () => {
    const req = new Request("http://localhost/api/widget/next-booking")
    const result = await authFromMobileToken(req)
    expect(result).toBeNull()
  })

  it("returns null when Authorization is not Bearer", async () => {
    const req = new Request("http://localhost/api/widget/next-booking", {
      headers: { Authorization: "Basic abc123" },
    })
    const result = await authFromMobileToken(req)
    expect(result).toBeNull()
  })

  it("returns null when Bearer token is empty", async () => {
    const req = new Request("http://localhost/api/widget/next-booking", {
      headers: { Authorization: "Bearer " },
    })
    const result = await authFromMobileToken(req)
    expect(result).toBeNull()
  })

  it("calls verifyToken with the JWT and returns result", async () => {
    mockVerifyToken.mockResolvedValue({ userId: "user-123", tokenId: "token-456" })

    const req = new Request("http://localhost/api/widget/next-booking", {
      headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.test.token" },
    })
    const result = await authFromMobileToken(req)
    expect(result).toEqual({ userId: "user-123", tokenId: "token-456" })
    expect(mockVerifyToken).toHaveBeenCalledWith("eyJhbGciOiJIUzI1NiJ9.test.token")
  })

  it("returns null when verifyToken returns null", async () => {
    mockVerifyToken.mockResolvedValue(null)

    const req = new Request("http://localhost/api/widget/next-booking", {
      headers: { Authorization: "Bearer invalid-token" },
    })
    const result = await authFromMobileToken(req)
    expect(result).toBeNull()
  })
})

describe("getMobileTokenService", () => {
  it("returns a MobileTokenService instance", () => {
    const service = getMobileTokenService()
    expect(service).toBeDefined()
  })

  it("returns the same instance (singleton)", () => {
    const s1 = getMobileTokenService()
    const s2 = getMobileTokenService()
    expect(s1).toBe(s2)
  })
})
