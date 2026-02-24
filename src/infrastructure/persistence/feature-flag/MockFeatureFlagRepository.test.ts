import { describe, it, expect, beforeEach } from "vitest"
import { MockFeatureFlagRepository } from "./MockFeatureFlagRepository"

describe("MockFeatureFlagRepository", () => {
  let repo: MockFeatureFlagRepository

  beforeEach(() => {
    repo = new MockFeatureFlagRepository()
  })

  describe("findAll", () => {
    it("returns empty array when no flags exist", async () => {
      const result = await repo.findAll()
      expect(result).toEqual([])
    })

    it("returns all seeded flags", async () => {
      await repo.upsert("flag_a", true)
      await repo.upsert("flag_b", false)

      const result = await repo.findAll()
      expect(result).toHaveLength(2)
      expect(result.map((f) => f.key)).toEqual(["flag_a", "flag_b"])
    })
  })

  describe("upsert", () => {
    it("creates a new flag", async () => {
      const result = await repo.upsert("new_flag", true, "admin@test.se")

      expect(result.key).toBe("new_flag")
      expect(result.enabled).toBe(true)
      expect(result.updatedBy).toBe("admin@test.se")
      expect(result.updatedAt).toBeInstanceOf(Date)
    })

    it("updates existing flag", async () => {
      await repo.upsert("existing_flag", false)
      const updated = await repo.upsert("existing_flag", true, "admin@test.se")

      expect(updated.key).toBe("existing_flag")
      expect(updated.enabled).toBe(true)
      expect(updated.updatedBy).toBe("admin@test.se")

      // Should still be one flag, not two
      const all = await repo.findAll()
      expect(all).toHaveLength(1)
    })

    it("defaults updatedBy to null", async () => {
      const result = await repo.upsert("flag", true)
      expect(result.updatedBy).toBeNull()
    })
  })

  describe("findByKey", () => {
    it("returns null when flag does not exist", async () => {
      const result = await repo.findByKey("nonexistent")
      expect(result).toBeNull()
    })

    it("returns the flag when it exists", async () => {
      await repo.upsert("target_flag", true, "admin@test.se")

      const result = await repo.findByKey("target_flag")
      expect(result).not.toBeNull()
      expect(result!.key).toBe("target_flag")
      expect(result!.enabled).toBe(true)
      expect(result!.updatedBy).toBe("admin@test.se")
    })
  })
})
