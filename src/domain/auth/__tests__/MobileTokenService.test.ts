/**
 * MobileTokenService - TDD tests
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { MobileTokenService, MaxTokensExceededError } from "../MobileTokenService"
import { MockMobileTokenRepository } from "@/infrastructure/persistence/mobile-token"

describe("MobileTokenService", () => {
  let service: MobileTokenService
  let repo: MockMobileTokenRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new MockMobileTokenRepository()
    service = new MobileTokenService({
      repository: repo,
      secret: "test-secret-that-is-at-least-32-characters-long",
    })
  })

  describe("generateToken", () => {
    it("returns a JWT and expiresAt", async () => {
      const result = await service.generateToken("user-123", "iPhone 15")

      expect(result.jwt).toBeDefined()
      expect(result.jwt.split(".")).toHaveLength(3) // JWT has 3 parts
      expect(result.expiresAt).toBeInstanceOf(Date)
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now())
    })

    it("stores token hash in repository (not plaintext JWT)", async () => {
      const result = await service.generateToken("user-123")

      // The repo should have a token with a hash, not the JWT itself
      const allTokens = await repo.findByTokenHash(result.jwt)
      // findByTokenHash uses the raw JWT -- won't match because repo stores hash
      expect(allTokens).toBeNull()
    })

    it("creates token with 90-day expiry", async () => {
      const before = Date.now()
      const result = await service.generateToken("user-123")
      const after = Date.now()

      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000
      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + ninetyDaysMs - 1000)
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + ninetyDaysMs + 1000)
    })
  })

  describe("verifyToken", () => {
    it("verifies a valid token and returns userId + tokenId", async () => {
      const { jwt } = await service.generateToken("user-123")

      const result = await service.verifyToken(jwt)

      expect(result).not.toBeNull()
      expect(result!.userId).toBe("user-123")
      expect(result!.tokenId).toBeDefined()
    })

    it("returns null for expired token", async () => {
      // Create a service with very short expiry for testing
      const shortService = new MobileTokenService({
        repository: repo,
        secret: "test-secret-that-is-at-least-32-characters-long",
        expiryDays: 0, // expires immediately
      })

      const { jwt } = await shortService.generateToken("user-123")

      // Wait a moment to ensure expiry
      await new Promise((resolve) => setTimeout(resolve, 50))

      const result = await service.verifyToken(jwt)
      expect(result).toBeNull()
    })

    it("returns null for revoked token", async () => {
      const { jwt } = await service.generateToken("user-123")
      const verified = await service.verifyToken(jwt)
      expect(verified).not.toBeNull()

      // Revoke the token
      await service.revokeToken(verified!.tokenId, "user-123")

      const result = await service.verifyToken(jwt)
      expect(result).toBeNull()
    })

    it("returns null for invalid JWT", async () => {
      const result = await service.verifyToken("not.a.valid.jwt")
      expect(result).toBeNull()
    })

    it("returns null for JWT signed with wrong secret", async () => {
      const otherService = new MobileTokenService({
        repository: repo,
        secret: "different-secret-that-is-at-least-32-chars",
      })

      const { jwt } = await otherService.generateToken("user-123")
      const result = await service.verifyToken(jwt)
      expect(result).toBeNull()
    })

    it("updates lastUsedAt on successful verification", async () => {
      const { jwt } = await service.generateToken("user-123")
      const result = await service.verifyToken(jwt)
      expect(result).not.toBeNull()

      // Check that lastUsedAt was updated in the repository
      const storedToken = await repo.findById(result!.tokenId)
      expect(storedToken?.lastUsedAt).not.toBeNull()
    })
  })

  describe("refreshToken", () => {
    it("returns a new JWT and revokes the old one", async () => {
      const { jwt: oldJwt } = await service.generateToken("user-123")
      const oldVerified = await service.verifyToken(oldJwt)
      expect(oldVerified).not.toBeNull()

      const result = await service.refreshToken(oldJwt)
      expect(result).not.toBeNull()
      expect(result!.jwt).not.toBe(oldJwt)
      expect(result!.expiresAt).toBeInstanceOf(Date)

      // Old token should be revoked
      const oldResult = await service.verifyToken(oldJwt)
      expect(oldResult).toBeNull()

      // New token should be valid
      const newResult = await service.verifyToken(result!.jwt)
      expect(newResult).not.toBeNull()
      expect(newResult!.userId).toBe("user-123")
    })

    it("returns null for invalid token", async () => {
      const result = await service.refreshToken("invalid.jwt.token")
      expect(result).toBeNull()
    })
  })

  describe("generateToken max active tokens", () => {
    it("throws MaxTokensExceededError when user has 5 active tokens", async () => {
      // Generate 5 tokens
      for (let i = 0; i < 5; i++) {
        await service.generateToken("user-123", `device-${i}`)
      }

      // 6th should throw
      await expect(
        service.generateToken("user-123", "device-6")
      ).rejects.toThrow(MaxTokensExceededError)
    })

    it("allows generating after revoking one", async () => {
      const tokens = []
      for (let i = 0; i < 5; i++) {
        const result = await service.generateToken("user-123", `device-${i}`)
        const verified = await service.verifyToken(result.jwt)
        tokens.push(verified!)
      }

      // Revoke one
      await service.revokeToken(tokens[0].tokenId, "user-123")

      // Now should succeed
      const result = await service.generateToken("user-123", "new-device")
      expect(result.jwt).toBeDefined()
    })

    it("does not count other users' tokens", async () => {
      for (let i = 0; i < 5; i++) {
        await service.generateToken("user-other", `device-${i}`)
      }

      // user-123 should still be able to create tokens
      const result = await service.generateToken("user-123")
      expect(result.jwt).toBeDefined()
    })
  })

  describe("refreshToken atomicity", () => {
    it("revokes old and creates new atomically", async () => {
      const { jwt: oldJwt } = await service.generateToken("user-123")

      const result = await service.refreshToken(oldJwt)
      expect(result).not.toBeNull()

      // Old should be revoked
      expect(await service.verifyToken(oldJwt)).toBeNull()
      // New should work
      expect(await service.verifyToken(result!.jwt)).not.toBeNull()
    })

    it("does not count against max tokens (rotation replaces)", async () => {
      // Fill up to max
      const jwts: string[] = []
      for (let i = 0; i < 5; i++) {
        const result = await service.generateToken("user-123", `device-${i}`)
        jwts.push(result.jwt)
      }

      // Refresh should work (it revokes the old one atomically)
      const result = await service.refreshToken(jwts[0])
      expect(result).not.toBeNull()
      expect(result!.jwt).toBeDefined()
    })
  })

  describe("revokeToken", () => {
    it("revokes a specific token", async () => {
      const { jwt } = await service.generateToken("user-123")
      const verified = await service.verifyToken(jwt)

      await service.revokeToken(verified!.tokenId, "user-123")

      const result = await service.verifyToken(jwt)
      expect(result).toBeNull()
    })
  })

  describe("revokeAllForUser", () => {
    it("revokes all tokens for a user", async () => {
      const { jwt: jwt1 } = await service.generateToken("user-123")
      const { jwt: jwt2 } = await service.generateToken("user-123", "iPad")
      const { jwt: otherJwt } = await service.generateToken("user-456")

      const count = await service.revokeAllForUser("user-123")
      expect(count).toBe(2)

      // Both user-123 tokens should be invalid
      expect(await service.verifyToken(jwt1)).toBeNull()
      expect(await service.verifyToken(jwt2)).toBeNull()

      // user-456 token should still be valid
      expect(await service.verifyToken(otherJwt)).not.toBeNull()
    })
  })
})
