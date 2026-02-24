import { describe, it, expect, beforeEach } from "vitest"
import { MunicipalityWatchService } from "./MunicipalityWatchService"
import { MockMunicipalityWatchRepository } from "@/infrastructure/persistence/municipality-watch/MockMunicipalityWatchRepository"

describe("MunicipalityWatchService", () => {
  let service: MunicipalityWatchService
  let repo: MockMunicipalityWatchRepository

  beforeEach(() => {
    repo = new MockMunicipalityWatchRepository()
    service = new MunicipalityWatchService(repo)
  })

  describe("addWatch", () => {
    it("should create a watch for valid municipality and service type", async () => {
      const result = await service.addWatch("customer-1", "Kungsbacka", "Hovslagning")

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.municipality).toBe("Kungsbacka")
        expect(result.value.serviceTypeName).toBe("Hovslagning")
      }
    })

    it("should reject invalid municipality", async () => {
      const result = await service.addWatch("customer-1", "FakeCity", "Hovslagning")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("INVALID_MUNICIPALITY")
      }
    })

    it("should reject empty service type name", async () => {
      const result = await service.addWatch("customer-1", "Kungsbacka", "")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("INVALID_SERVICE_TYPE")
      }
    })

    it("should reject whitespace-only service type name", async () => {
      const result = await service.addWatch("customer-1", "Kungsbacka", "   ")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("INVALID_SERVICE_TYPE")
      }
    })

    it("should allow duplicate (idempotent)", async () => {
      await service.addWatch("customer-1", "Kungsbacka", "Hovslagning")
      const result = await service.addWatch("customer-1", "Kungsbacka", "Hovslagning")

      expect(result.ok).toBe(true)
    })

    it("should enforce max 10 watches per customer", async () => {
      // Create 10 watches
      for (let i = 0; i < 10; i++) {
        await service.addWatch("customer-1", "Kungsbacka", `Service-${i}`)
      }

      // 11th should fail
      const result = await service.addWatch("customer-1", "Kungsbacka", "Service-10")

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("MAX_WATCHES_REACHED")
      }
    })

    it("should allow 10th watch but not 11th", async () => {
      for (let i = 0; i < 9; i++) {
        await service.addWatch("customer-1", "Kungsbacka", `Service-${i}`)
      }

      const tenth = await service.addWatch("customer-1", "Kungsbacka", "Service-9")
      expect(tenth.ok).toBe(true)

      const eleventh = await service.addWatch("customer-1", "Kungsbacka", "Service-10")
      expect(eleventh.ok).toBe(false)
    })
  })

  describe("removeWatch", () => {
    it("should remove an existing watch", async () => {
      const addResult = await service.addWatch("customer-1", "Kungsbacka", "Hovslagning")
      expect(addResult.ok).toBe(true)

      const watchId = addResult.ok ? addResult.value.id : ""
      const result = await service.removeWatch(watchId, "customer-1")
      expect(result).toBe(true)
    })

    it("should return false for non-existent watch", async () => {
      const result = await service.removeWatch("nonexistent", "customer-1")
      expect(result).toBe(false)
    })
  })

  describe("getWatches", () => {
    it("should return empty array when no watches", async () => {
      const watches = await service.getWatches("customer-1")
      expect(watches).toEqual([])
    })

    it("should return all watches for customer", async () => {
      await service.addWatch("customer-1", "Kungsbacka", "Hovslagning")
      await service.addWatch("customer-1", "Mölndal", "Tandrasp")

      const watches = await service.getWatches("customer-1")
      expect(watches).toHaveLength(2)
    })
  })
})
