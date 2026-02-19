import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  isFeatureEnabled,
  getFeatureFlags,
  getFeatureFlagDefinitions,
  FEATURE_FLAGS,
  setFeatureFlagOverride,
  removeFeatureFlagOverride,
  _resetRedisForTesting,
} from "./feature-flags"
import { clearRuntimeSettings, setRuntimeSetting } from "./settings/runtime-settings"

// Mock Redis -- return null by default (tests in-memory fallback path)
const mockRedisGet = vi.fn().mockResolvedValue(null)
const mockRedisSet = vi.fn().mockResolvedValue("OK")
const mockRedisMget = vi.fn().mockResolvedValue([])
const mockRedisDel = vi.fn().mockResolvedValue(1)

vi.mock("@upstash/redis", () => {
  return {
    Redis: class MockRedis {
      get = mockRedisGet
      set = mockRedisSet
      mget = mockRedisMget
      del = mockRedisDel
    },
  }
})

describe("feature-flags", () => {
  beforeEach(() => {
    clearRuntimeSettings()
    vi.clearAllMocks()
    _resetRedisForTesting()
    // Clear all FEATURE_* env vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("FEATURE_")) {
        delete process.env[key]
      }
    }
    // Reset Redis env so getRedis() returns null (in-memory fallback)
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  describe("isFeatureEnabled", () => {
    it("returns default value when no override exists", async () => {
      expect(await isFeatureEnabled("voice_logging")).toBe(true)
      expect(await isFeatureEnabled("group_bookings")).toBe(false)
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

    it("runtime setting overrides default", async () => {
      setRuntimeSetting("feature_group_bookings", "true")
      expect(await isFeatureEnabled("group_bookings")).toBe(true)

      setRuntimeSetting("feature_voice_logging", "false")
      expect(await isFeatureEnabled("voice_logging")).toBe(false)
    })

    it("env variable overrides runtime setting", async () => {
      process.env.FEATURE_GROUP_BOOKINGS = "false"
      setRuntimeSetting("feature_group_bookings", "true")
      expect(await isFeatureEnabled("group_bookings")).toBe(false)

      process.env.FEATURE_VOICE_LOGGING = "true"
      setRuntimeSetting("feature_voice_logging", "false")
      expect(await isFeatureEnabled("voice_logging")).toBe(true)
    })

    it("Redis override trumps runtime setting", async () => {
      // Enable Redis
      process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io"
      process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token"

      // Runtime says true, Redis says false
      setRuntimeSetting("feature_group_bookings", "true")
      const keys = Object.keys(FEATURE_FLAGS)
      const mgetResult = keys.map((k) => (k === "group_bookings" ? "false" : null))
      mockRedisMget.mockResolvedValueOnce(mgetResult)

      expect(await isFeatureEnabled("group_bookings")).toBe(false)
    })

    it("env variable overrides Redis", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io"
      process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token"

      process.env.FEATURE_GROUP_BOOKINGS = "true"
      const keys = Object.keys(FEATURE_FLAGS)
      const mgetResult = keys.map((k) => (k === "group_bookings" ? "false" : null))
      mockRedisMget.mockResolvedValueOnce(mgetResult)

      expect(await isFeatureEnabled("group_bookings")).toBe(true)
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
        group_bookings: false,
        business_insights: true,
        self_reschedule: true,
        recurring_bookings: false,
      })
    })

    it("reflects runtime overrides", async () => {
      setRuntimeSetting("feature_group_bookings", "true")
      const flags = await getFeatureFlags()
      expect(flags.group_bookings).toBe(true)
    })

    it("reflects env overrides", async () => {
      process.env.FEATURE_VOICE_LOGGING = "false"
      const flags = await getFeatureFlags()
      expect(flags.voice_logging).toBe(false)
    })

    it("reflects Redis overrides", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io"
      process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token"

      const keys = Object.keys(FEATURE_FLAGS)
      // Return "true" for group_bookings (last key), null for rest
      const mgetResult = keys.map((k) => (k === "group_bookings" ? "true" : null))
      mockRedisMget.mockResolvedValueOnce(mgetResult)

      const flags = await getFeatureFlags()
      expect(flags.group_bookings).toBe(true)
    })
  })

  describe("setFeatureFlagOverride", () => {
    it("writes to in-memory in local dev (no Redis)", async () => {
      await setFeatureFlagOverride("group_bookings", "true")
      expect(await isFeatureEnabled("group_bookings")).toBe(true)
    })

    it("writes to Redis when available", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io"
      process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token"

      await setFeatureFlagOverride("group_bookings", "true")
      expect(mockRedisSet).toHaveBeenCalledWith("feature_flag:group_bookings", "true")
    })

    it("throws when Redis write fails", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io"
      process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token"

      mockRedisSet.mockRejectedValueOnce(new Error("Redis connection failed"))

      await expect(
        setFeatureFlagOverride("group_bookings", "true")
      ).rejects.toThrow("Redis connection failed")
    })

    it("does NOT write to in-memory when Redis is configured", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io"
      process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token"

      await setFeatureFlagOverride("group_bookings", "true")

      // In-memory should NOT be updated -- verify via runtime settings
      const { getRuntimeSetting } = await import("./settings/runtime-settings")
      expect(getRuntimeSetting("feature_group_bookings")).toBeUndefined()
    })
  })

  describe("removeFeatureFlagOverride", () => {
    it("throws when Redis delete fails", async () => {
      process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io"
      process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token"

      mockRedisDel.mockRejectedValueOnce(new Error("Redis delete failed"))

      await expect(
        removeFeatureFlagOverride("group_bookings")
      ).rejects.toThrow("Redis delete failed")
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

  describe("getFeatureFlags after overrides", () => {
    it("reflects override after setFeatureFlagOverride", async () => {
      const flags1 = await getFeatureFlags()
      expect(flags1.group_bookings).toBe(false)

      await setFeatureFlagOverride("group_bookings", "true")

      const flags2 = await getFeatureFlags()
      expect(flags2.group_bookings).toBe(true)
    })

    it("reflects removal after removeFeatureFlagOverride", async () => {
      await setFeatureFlagOverride("group_bookings", "true")
      const flags1 = await getFeatureFlags()
      expect(flags1.group_bookings).toBe(true)

      await removeFeatureFlagOverride("group_bookings")

      const flags2 = await getFeatureFlags()
      expect(flags2.group_bookings).toBe(false)
    })
  })
})
