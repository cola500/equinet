import { describe, it, expect, beforeEach, afterEach } from "vitest"

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
      expect(await isFeatureEnabled("route_planning")).toBe(true)
    })

    it("returns false for unknown flag", async () => {
      expect(await isFeatureEnabled("nonexistent_flag")).toBe(false)
    })

    it("env variable overrides default", async () => {
      process.env.FEATURE_ROUTE_PLANNING = "true"
      expect(await isFeatureEnabled("route_planning")).toBe(true)

      process.env.FEATURE_VOICE_LOGGING = "false"
      expect(await isFeatureEnabled("voice_logging")).toBe(false)
    })

    it("DB override overrides default", async () => {
      await mockRepo.upsert("route_planning", true)
      await mockRepo.upsert("voice_logging", false)

      // Both overrides should be visible (single cache fetch)
      expect(await isFeatureEnabled("route_planning")).toBe(true)
      expect(await isFeatureEnabled("voice_logging")).toBe(false)
    })

    it("env variable overrides DB", async () => {
      process.env.FEATURE_ROUTE_PLANNING = "false"
      await mockRepo.upsert("route_planning", true)
      expect(await isFeatureEnabled("route_planning")).toBe(false)

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
        customer_insights: true,
        offline_mode: true,
        provider_subscription: false,
        push_notifications: false,
        stable_profiles: false,
        stripe_payments: false,
        data_retention: false,
      })
    })

    it("reflects DB overrides", async () => {
      await mockRepo.upsert("route_planning", true)
      const flags = await getFeatureFlags()
      expect(flags.route_planning).toBe(true)
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
      expect(flags.route_planning).toBe(true)
    })
  })

  describe("setFeatureFlagOverride", () => {
    it("writes to repository", async () => {
      await setFeatureFlagOverride("route_planning", "true")

      const flag = await mockRepo.findByKey("route_planning")
      expect(flag).not.toBeNull()
      expect(flag!.enabled).toBe(true)
    })

    it("invalidates cache", async () => {
      // Populate cache
      await getFeatureFlags()

      // Override a flag
      await setFeatureFlagOverride("route_planning", "true")

      // Should see the override immediately (cache invalidated)
      const flags = await getFeatureFlags()
      expect(flags.route_planning).toBe(true)
    })

    it("throws descriptive error on DB failure", async () => {
      vi.spyOn(mockRepo, "upsert").mockRejectedValueOnce(new Error("Connection refused"))

      await expect(
        setFeatureFlagOverride("route_planning", "true")
      ).rejects.toThrow("Kunde inte uppdatera flaggan route_planning: Connection refused")
    })
  })

  describe("removeFeatureFlagOverride", () => {
    it("sets flag to default value in repository", async () => {
      await setFeatureFlagOverride("route_planning", "true")
      await removeFeatureFlagOverride("route_planning")

      // route_planning default is true
      const flags = await getFeatureFlags()
      expect(flags.route_planning).toBe(true)
    })

    it("throws descriptive error on DB failure", async () => {
      vi.spyOn(mockRepo, "upsert").mockRejectedValueOnce(new Error("Timeout"))

      await expect(
        removeFeatureFlagOverride("route_planning")
      ).rejects.toThrow("Kunde inte uppdatera flaggan route_planning: Timeout")
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

  describe("source of truth (DB)", () => {
    it("env var overrides a DB row", async () => {
      await mockRepo.upsert("voice_logging", false)
      process.env.FEATURE_VOICE_LOGGING = "true"

      const flags = await getFeatureFlags()

      expect(flags.voice_logging).toBe(true)
    })

    it("DB row overrides code default", async () => {
      // route_planning defaults to true; DB row turns it off
      await mockRepo.upsert("route_planning", false)

      const flags = await getFeatureFlags()

      expect(flags.route_planning).toBe(false)
    })

    it("setFeatureFlagOverride changes the effective value", async () => {
      await setFeatureFlagOverride("route_planning", "false")
      expect((await getFeatureFlags()).route_planning).toBe(false)

      await setFeatureFlagOverride("route_planning", "true")
      expect((await getFeatureFlags()).route_planning).toBe(true)
    })

    it("removeFeatureFlagOverride resets to code default", async () => {
      await setFeatureFlagOverride("route_planning", "false")
      expect((await getFeatureFlags()).route_planning).toBe(false)

      await removeFeatureFlagOverride("route_planning")
      expect((await getFeatureFlags()).route_planning).toBe(true)
    })
  })
})
