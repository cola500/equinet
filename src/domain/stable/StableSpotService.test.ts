import { describe, it, expect, beforeEach } from "vitest"
import { StableSpotService } from "./StableSpotService"
import { MockStableRepository } from "@/infrastructure/persistence/stable/MockStableRepository"

describe("StableSpotService", () => {
  let service: StableSpotService
  let repo: MockStableRepository
  let stableId: string

  beforeEach(async () => {
    repo = new MockStableRepository()
    service = new StableSpotService(repo)

    // Create a stable for tests
    const stable = await repo.create({ userId: "user-1", name: "Test Stall" })
    stableId = stable.id
  })

  describe("createSpot", () => {
    it("creates a spot for the stable", async () => {
      const result = await service.createSpot(stableId, { label: "Box 1" })

      expect(result.isSuccess).toBe(true)
      expect(result.value.label).toBe("Box 1")
      expect(result.value.status).toBe("available")
      expect(result.value.stableId).toBe(stableId)
    })
  })

  describe("getSpots", () => {
    it("returns spots for a stable", async () => {
      await service.createSpot(stableId, { label: "Box 1" })
      await service.createSpot(stableId, { label: "Box 2" })

      const spots = await service.getSpots(stableId)
      expect(spots).toHaveLength(2)
    })
  })

  describe("updateSpot", () => {
    it("updates a spot", async () => {
      const created = await service.createSpot(stableId, { label: "Box 1" })
      const result = await service.updateSpot(
        created.value.id,
        stableId,
        { status: "rented" }
      )

      expect(result.isSuccess).toBe(true)
      expect(result.value.status).toBe("rented")
    })

    it("returns NOT_FOUND for wrong stableId", async () => {
      const created = await service.createSpot(stableId, { label: "Box 1" })
      const result = await service.updateSpot(
        created.value.id,
        "wrong-stable-id",
        { status: "rented" }
      )

      expect(result.isFailure).toBe(true)
      expect(result.error).toBe("NOT_FOUND")
    })
  })

  describe("deleteSpot", () => {
    it("deletes a spot", async () => {
      const created = await service.createSpot(stableId, { label: "Box 1" })
      const result = await service.deleteSpot(created.value.id, stableId)

      expect(result.isSuccess).toBe(true)
      const spots = await service.getSpots(stableId)
      expect(spots).toHaveLength(0)
    })

    it("returns NOT_FOUND for wrong stableId", async () => {
      const created = await service.createSpot(stableId, { label: "Box 1" })
      const result = await service.deleteSpot(created.value.id, "wrong-stable-id")

      expect(result.isFailure).toBe(true)
      expect(result.error).toBe("NOT_FOUND")
    })
  })

  describe("getCounts", () => {
    it("returns correct counts", async () => {
      await service.createSpot(stableId, { label: "Box 1", status: "available" })
      await service.createSpot(stableId, { label: "Box 2", status: "rented" })
      await service.createSpot(stableId, { label: "Box 3", status: "available" })

      const counts = await service.getCounts(stableId)
      expect(counts.total).toBe(3)
      expect(counts.available).toBe(2)
    })
  })
})
