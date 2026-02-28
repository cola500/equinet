import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import {
  isFeatureEnabled,
  getFeatureFlags,
  getFeatureFlagDefinitions,
  FEATURE_FLAGS,
  setFeatureFlagOverride,
  removeFeatureFlagOverride,
  _setRepositoryForTesting,
  _resetRedisForTesting,
} from "./feature-flags"
import { MockFeatureFlagRepository } from "@/infrastructure/persistence/feature-flag"

describe("feature-flags", () => {
  let mockRepo: MockFeatureFlagRepository

  beforeEach(() => {
    mockRepo = new MockFeatureFlagRepository()
    _setRepositoryForTesting(mockRepo)
    // Clear all FEATURE_* env vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("FEATURE_")) {
        delete process.env[key]
      }
    }
  })

  afterEach(() => {
    _setRepositoryForTesting(null)
  })

  describe("isFeatureEnabled", () => {
    it("returns default value when no override exists", async () => {
      expect(await isFeatureEnabled("voice_logging")).toBe(true)
      expect(await isFeatureEnabled("group_bookings")).toBe(true)
    })

    it("returns false for unknown flag", async () => {
      expect(await isFeatureEnabled("nonexistent_flag")).toBe(false)
    })

    it("env variable overrides default", async () => {
      process.env.FEATURE_GROUP_BOOKINGS = "true"
      expect(await isFeatureEnabled("group_bookings")).toBe(true)

      process.env.FEATURE_VOICE_LOGGING = "false"
      expect(await isFeatureEnabled("voice_logging")).toBe(false)
    })

    it("DB override overrides default", async () => {
      await mockRepo.upsert("group_bookings", true)
      await mockRepo.upsert("voice_logging", false)

      // Both overrides should be visible (single cache fetch)
      expect(await isFeatureEnabled("group_bookings")).toBe(true)
      expect(await isFeatureEnabled("voice_logging")).toBe(false)
    })

    it("env variable overrides DB", async () => {
      process.env.FEATURE_GROUP_BOOKINGS = "false"
      await mockRepo.upsert("group_bookings", true)
      expect(await isFeatureEnabled("group_bookings")).toBe(false)

      process.env.FEATURE_VOICE_LOGGING = "true"
      await mockRepo.upsert("voice_logging", false)
      expect(await isFeatureEnabled("voice_logging")).toBe(true)
    })
  })

  describe("getFeatureFlags", () => {
    it("returns all flags with their current state", async () => {
      const flags = await getFeatureFlags()
      expect(flags).toEqual({
        voice_logging: true,
        route_planning: true,
        route_announcements: true,
        customer_insights: true,
        due_for_service: true,
        group_bookings: true,
        business_insights: true,
        self_reschedule: true,
        recurring_bookings: true,
        offline_mode: true,
        follow_provider: true,
        municipality_watch: true,
        provider_subscription: false,
      })
    })

    it("reflects DB overrides", async () => {
      await mockRepo.upsert("group_bookings", true)
      const flags = await getFeatureFlags()
      expect(flags.group_bookings).toBe(true)
    })

    it("reflects env overrides", async () => {
      process.env.FEATURE_VOICE_LOGGING = "false"
      const flags = await getFeatureFlags()
      expect(flags.voice_logging).toBe(false)
    })

    it("caches result for 30s (no second DB call)", async () => {
      const findAllSpy = vi.spyOn(mockRepo, "findAll")

      await getFeatureFlags()
      await getFeatureFlags()
      await getFeatureFlags()

      // Should only have called findAll once due to cache
      expect(findAllSpy.mock.calls.length).toBe(1)
    })

    it("re-fetches after cache expiry", async () => {
      vi.useFakeTimers()
      try {
        const findAllSpy = vi.spyOn(mockRepo, "findAll")

        await getFeatureFlags()
        expect(findAllSpy.mock.calls.length).toBe(1)

        // Fast-forward 31s
        vi.advanceTimersByTime(31_000)

        await getFeatureFlags()
        expect(findAllSpy.mock.calls.length).toBe(2)
      } finally {
        vi.useRealTimers()
      }
    })

    it("falls back to defaults on DB error", async () => {
      vi.spyOn(mockRepo, "findAll").mockRejectedValueOnce(new Error("DB down"))

      const flags = await getFeatureFlags()
      // Should return defaults without crashing
      expect(flags.voice_logging).toBe(true)
      expect(flags.group_bookings).toBe(true)
    })
  })

  describe("setFeatureFlagOverride", () => {
    it("writes to repository", async () => {
      await setFeatureFlagOverride("group_bookings", "true")

      const flag = await mockRepo.findByKey("group_bookings")
      expect(flag).not.toBeNull()
      expect(flag!.enabled).toBe(true)
    })

    it("invalidates cache", async () => {
      // Populate cache
      await getFeatureFlags()

      // Override a flag
      await setFeatureFlagOverride("group_bookings", "true")

      // Should see the override immediately (cache invalidated)
      const flags = await getFeatureFlags()
      expect(flags.group_bookings).toBe(true)
    })

    it("throws descriptive error on DB failure", async () => {
      vi.spyOn(mockRepo, "upsert").mockRejectedValueOnce(new Error("Connection refused"))

      await expect(
        setFeatureFlagOverride("group_bookings", "true")
      ).rejects.toThrow("Kunde inte uppdatera flaggan group_bookings: Connection refused")
    })
  })

  describe("removeFeatureFlagOverride", () => {
    it("sets flag to default value in repository", async () => {
      await setFeatureFlagOverride("group_bookings", "true")
      await removeFeatureFlagOverride("group_bookings")

      // group_bookings default is true
      const flags = await getFeatureFlags()
      expect(flags.group_bookings).toBe(true)
    })

    it("throws descriptive error on DB failure", async () => {
      vi.spyOn(mockRepo, "upsert").mockRejectedValueOnce(new Error("Timeout"))

      await expect(
        removeFeatureFlagOverride("group_bookings")
      ).rejects.toThrow("Kunde inte uppdatera flaggan group_bookings: Timeout")
    })
  })

  describe("getFeatureFlagDefinitions", () => {
    it("returns metadata for all flags", () => {
      const definitions = getFeatureFlagDefinitions()
      expect(definitions).toHaveLength(Object.keys(FEATURE_FLAGS).length)
      expect(definitions[0]).toHaveProperty("key")
      expect(definitions[0]).toHaveProperty("label")
      expect(definitions[0]).toHaveProperty("description")
      expect(definitions[0]).toHaveProperty("defaultEnabled")
    })
  })

  describe("FEATURE_FLAGS registry", () => {
    it("has consistent key property matching the record key", () => {
      for (const [recordKey, flag] of Object.entries(FEATURE_FLAGS)) {
        expect(flag.key).toBe(recordKey)
      }
    })
  })

  describe("_resetRedisForTesting alias", () => {
    it("is an alias for _setRepositoryForTesting(null)", () => {
      // Should not throw
      _resetRedisForTesting()
    })
  })
})
