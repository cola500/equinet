import { describe, it, expect, beforeEach } from "vitest"
import { StableService } from "./StableService"
import { MockStableRepository } from "@/infrastructure/persistence/stable/MockStableRepository"

describe("StableService", () => {
  let service: StableService
  let repo: MockStableRepository

  beforeEach(() => {
    repo = new MockStableRepository()
    service = new StableService(repo)
  })

  describe("createStable", () => {
    it("creates a stable for a user", async () => {
      const result = await service.createStable("user-1", {
        name: "Solängens Stall",
        municipality: "Alingsås",
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.name).toBe("Solängens Stall")
      expect(result.value.userId).toBe("user-1")
      expect(result.value.municipality).toBe("Alingsås")
    })

    it("returns ALREADY_EXISTS if user already has a stable", async () => {
      await service.createStable("user-1", { name: "Stall A" })
      const result = await service.createStable("user-1", { name: "Stall B" })

      expect(result.isFailure).toBe(true)
      expect(result.error).toBe("ALREADY_EXISTS")
    })
  })

  describe("getByUserId", () => {
    it("returns stable for user", async () => {
      await service.createStable("user-1", { name: "Stall A" })
      const stable = await service.getByUserId("user-1")

      expect(stable).not.toBeNull()
      expect(stable!.name).toBe("Stall A")
    })

    it("returns null if user has no stable", async () => {
      const stable = await service.getByUserId("nonexistent")
      expect(stable).toBeNull()
    })
  })

  describe("updateStable", () => {
    it("updates stable fields", async () => {
      await service.createStable("user-1", { name: "Stall A" })
      const result = await service.updateStable("user-1", {
        name: "Stall B",
        city: "Göteborg",
      })

      expect(result.isSuccess).toBe(true)
      expect(result.value.name).toBe("Stall B")
      expect(result.value.city).toBe("Göteborg")
    })

    it("returns NOT_FOUND if user has no stable", async () => {
      const result = await service.updateStable("nonexistent", { name: "X" })
      expect(result.isFailure).toBe(true)
      expect(result.error).toBe("NOT_FOUND")
    })
  })

  describe("getPublicById", () => {
    it("returns public stable with counts", async () => {
      const createResult = await service.createStable("user-1", { name: "Stall A" })
      const stableId = createResult.value.id

      // Add spots
      await repo.createSpot({ stableId, label: "Box 1", status: "available" })
      await repo.createSpot({ stableId, label: "Box 2", status: "rented" })

      const result = await service.getPublicById(stableId)
      expect(result).not.toBeNull()
      expect(result!.name).toBe("Stall A")
      expect(result!._count.spots).toBe(2)
      expect(result!._count.availableSpots).toBe(1)
    })

    it("returns null for nonexistent stable", async () => {
      const result = await service.getPublicById("nonexistent")
      expect(result).toBeNull()
    })
  })
})
