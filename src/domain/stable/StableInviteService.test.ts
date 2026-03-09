import { describe, it, expect, beforeEach } from "vitest"
import { StableInviteService } from "./StableInviteService"
import { MockStableInviteRepository } from "@/infrastructure/persistence/stable-invite/MockStableInviteRepository"

describe("StableInviteService", () => {
  let service: StableInviteService
  let repo: MockStableInviteRepository

  beforeEach(() => {
    repo = new MockStableInviteRepository()
    repo.seedStable("stable-1", "Testgården", "Göteborg")
    service = new StableInviteService(repo)
  })

  describe("createInvite", () => {
    it("creates an invite token for an email", async () => {
      const result = await service.createInvite("stable-1", "anna@test.se")

      expect(result.isSuccess).toBe(true)
      expect(result.value).toHaveProperty("token")
      expect(result.value.token).toHaveLength(64) // hex of 32 bytes
    })

    it("invalidates old pending invites for same email+stable", async () => {
      await service.createInvite("stable-1", "anna@test.se")
      const result2 = await service.createInvite("stable-1", "anna@test.se")

      expect(result2.isSuccess).toBe(true)

      // Old invite should be marked as used
      const invites = await repo.findByStableId("stable-1")
      const pending = invites.filter((i) => i.usedAt === null)
      expect(pending).toHaveLength(1) // Only the newest
    })

    it("sets 7-day expiry", async () => {
      const before = Date.now()
      const result = await service.createInvite("stable-1", "anna@test.se")

      const sevenDays = 7 * 24 * 60 * 60 * 1000
      const expiresAt = result.value.expiresAt.getTime()
      expect(expiresAt).toBeGreaterThanOrEqual(before + sevenDays - 1000)
      expect(expiresAt).toBeLessThanOrEqual(before + sevenDays + 1000)
    })
  })

  describe("validateToken", () => {
    it("returns token info for valid token", async () => {
      const created = await service.createInvite("stable-1", "anna@test.se")
      const result = await service.validateToken(created.value.token)

      expect(result.isSuccess).toBe(true)
      expect(result.value.email).toBe("anna@test.se")
      expect(result.value.stableName).toBe("Testgården")
    })

    it("fails for non-existent token", async () => {
      const result = await service.validateToken("nonexistent")

      expect(result.isFailure).toBe(true)
      expect(result.error).toBe("TOKEN_NOT_FOUND")
    })

    it("fails for expired token", async () => {
      const created = await service.createInvite("stable-1", "anna@test.se")

      // Manually expire the token
      const token = await repo.findByToken(created.value.token)
      if (token) {
        const expired = { ...token, expiresAt: new Date(Date.now() - 1000) }
        // Replace in mock
        await repo.create({
          token: "expired-token",
          email: "anna@test.se",
          stableId: "stable-1",
          expiresAt: new Date(Date.now() - 1000),
        })
      }

      const result = await service.validateToken("expired-token")
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe("TOKEN_EXPIRED")
    })

    it("fails for already used token", async () => {
      const created = await service.createInvite("stable-1", "anna@test.se")

      // Accept it first
      await service.acceptInvite(created.value.token)

      const result = await service.validateToken(created.value.token)
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe("TOKEN_USED")
    })
  })

  describe("acceptInvite", () => {
    it("marks the token as used", async () => {
      const created = await service.createInvite("stable-1", "anna@test.se")
      const result = await service.acceptInvite(created.value.token)

      expect(result.isSuccess).toBe(true)

      // Verify marked as used
      const token = await repo.findByToken(created.value.token)
      expect(token?.usedAt).not.toBeNull()
    })

    it("fails for invalid token", async () => {
      const result = await service.acceptInvite("nonexistent")
      expect(result.isFailure).toBe(true)
    })

    it("returns stable info on success", async () => {
      const created = await service.createInvite("stable-1", "anna@test.se")
      const result = await service.acceptInvite(created.value.token)

      expect(result.isSuccess).toBe(true)
      expect(result.value.stableName).toBe("Testgården")
      expect(result.value.stableId).toBe("stable-1")
    })
  })

  describe("listInvites", () => {
    it("returns invites for a stable", async () => {
      await service.createInvite("stable-1", "anna@test.se")
      await service.createInvite("stable-1", "erik@test.se")

      const invites = await service.listInvites("stable-1")
      expect(invites).toHaveLength(2)
    })

    it("returns empty array for stable with no invites", async () => {
      const invites = await service.listInvites("stable-2")
      expect(invites).toHaveLength(0)
    })
  })
})
