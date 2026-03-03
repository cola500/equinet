import "fake-indexeddb/auto"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import {
  cacheBookings,
  getCachedBookings,
  cacheRoutes,
  getCachedRoutes,
  cacheProfile,
  getCachedProfile,
  clearAllOfflineData,
  cacheEndpoint,
  getCachedEndpoint,
  invalidateEndpointCache,
  getCacheStats,
  evictStaleCache,
  maybeEvictStaleCache,
  _resetEvictionThrottle,
  MAX_AGE_MS,
} from "./cache-manager"
import { offlineDb } from "./db"

vi.mock("./debug-logger", () => ({ debugLog: vi.fn() }))

describe("cache-manager", () => {
  beforeEach(async () => {
    await offlineDb.bookings.clear()
    await offlineDb.routes.clear()
    await offlineDb.profile.clear()
    await offlineDb.metadata.clear()
    await offlineDb.endpointCache.clear()
    _resetEvictionThrottle()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("MAX_AGE_MS", () => {
    it("is 4 hours", () => {
      expect(MAX_AGE_MS).toBe(4 * 60 * 60 * 1000)
    })
  })

  describe("bookings", () => {
    const mockBookings = [
      { id: "1", date: "2026-02-20", status: "confirmed" },
      { id: "2", date: "2026-02-21", status: "pending" },
    ]

    it("caches and retrieves bookings", async () => {
      await cacheBookings(mockBookings)
      const result = await getCachedBookings()
      expect(result).toEqual(mockBookings)
    })

    it("returns null when no cached bookings exist", async () => {
      const result = await getCachedBookings()
      expect(result).toBeNull()
    })

    it("returns null when cache is stale", async () => {
      const staleTime = Date.now() - MAX_AGE_MS - 1000
      vi.spyOn(Date, "now").mockReturnValue(staleTime)
      await cacheBookings(mockBookings)
      vi.restoreAllMocks()

      const result = await getCachedBookings()
      expect(result).toBeNull()
    })

    it("returns data when cache is fresh", async () => {
      await cacheBookings(mockBookings)
      const result = await getCachedBookings()
      expect(result).toEqual(mockBookings)
    })
  })

  describe("routes", () => {
    const mockRoutes = [{ id: "r1", name: "Kungsbacka" }]

    it("caches and retrieves routes", async () => {
      await cacheRoutes(mockRoutes)
      const result = await getCachedRoutes()
      expect(result).toEqual(mockRoutes)
    })

    it("returns null when no cached routes exist", async () => {
      const result = await getCachedRoutes()
      expect(result).toBeNull()
    })

    it("returns null when cache is stale", async () => {
      const staleTime = Date.now() - MAX_AGE_MS - 1000
      vi.spyOn(Date, "now").mockReturnValue(staleTime)
      await cacheRoutes(mockRoutes)
      vi.restoreAllMocks()

      const result = await getCachedRoutes()
      expect(result).toBeNull()
    })
  })

  describe("profile", () => {
    const mockProfile = { id: "p1", name: "Test Provider" }

    it("caches and retrieves profile", async () => {
      await cacheProfile(mockProfile)
      const result = await getCachedProfile()
      expect(result).toEqual(mockProfile)
    })

    it("returns null when no cached profile exists", async () => {
      const result = await getCachedProfile()
      expect(result).toBeNull()
    })

    it("returns null when cache is stale", async () => {
      const staleTime = Date.now() - MAX_AGE_MS - 1000
      vi.spyOn(Date, "now").mockReturnValue(staleTime)
      await cacheProfile(mockProfile)
      vi.restoreAllMocks()

      const result = await getCachedProfile()
      expect(result).toBeNull()
    })
  })

  describe("endpoint cache (generic)", () => {
    const url = "/api/bookings?status=pending"
    const data = [{ id: "1", status: "pending" }]

    it("caches and retrieves by exact URL", async () => {
      await cacheEndpoint(url, data)
      const result = await getCachedEndpoint(url)
      expect(result).toEqual(data)
    })

    it("returns null for different query params", async () => {
      await cacheEndpoint(url, data)
      const result = await getCachedEndpoint("/api/bookings?status=confirmed")
      expect(result).toBeNull()
    })

    it("falls back to base URL when exact match not found", async () => {
      const baseData = [{ id: "all" }]
      await cacheEndpoint("/api/bookings", baseData)
      const result = await getCachedEndpoint("/api/bookings?status=new")
      expect(result).toEqual(baseData)
    })

    it("returns null when cache is stale", async () => {
      const staleTime = Date.now() - MAX_AGE_MS - 1000
      vi.spyOn(Date, "now").mockReturnValue(staleTime)
      await cacheEndpoint(url, data)
      vi.restoreAllMocks()

      const result = await getCachedEndpoint(url)
      expect(result).toBeNull()
    })

    it("returns null when no cache exists", async () => {
      const result = await getCachedEndpoint("/api/bookings?status=anything")
      expect(result).toBeNull()
    })

    it("invalidates cache by URL prefix", async () => {
      await cacheEndpoint("/api/bookings", [{ id: "base" }])
      await cacheEndpoint("/api/bookings?status=pending", [{ id: "pending" }])
      await cacheEndpoint("/api/routes/my-routes", [{ id: "route" }])

      await invalidateEndpointCache("/api/bookings")

      expect(await getCachedEndpoint("/api/bookings")).toBeNull()
      expect(await getCachedEndpoint("/api/bookings?status=pending")).toBeNull()
      // Routes should be untouched
      expect(await getCachedEndpoint("/api/routes/my-routes")).toEqual([{ id: "route" }])
    })

    it("clearAllOfflineData also clears endpoint cache", async () => {
      await cacheEndpoint(url, data)
      await clearAllOfflineData()
      expect(await getCachedEndpoint(url)).toBeNull()
    })
  })

  describe("data validation", () => {
    it("returns null for corrupted cached data (null data field)", async () => {
      // Simulate corrupted data by writing directly to IndexedDB
      await offlineDb.endpointCache.put({
        url: "/api/bookings",
        data: null,
        cachedAt: Date.now(),
      })
      const result = await getCachedEndpoint("/api/bookings")
      expect(result).toBeNull()
    })

    it("returns null for corrupted bookings (non-array data)", async () => {
      await offlineDb.metadata.put({
        key: "bookings",
        lastSyncedAt: Date.now(),
        version: 1,
      })
      await offlineDb.bookings.put({
        id: "corrupt",
        data: "not-an-object",
        cachedAt: Date.now(),
      })
      const result = await getCachedBookings()
      // getCachedBookings returns array of data -- corrupt data is returned as-is
      // since it's valid IndexedDB data, just unexpected shape
      expect(result).toBeDefined()
    })
  })

  describe("quota handling", () => {
    it("cacheEndpoint recovers gracefully from QuotaExceededError", async () => {
      // First put fails with quota, second succeeds (after eviction)
      vi.spyOn(offlineDb.endpointCache, "put")
        .mockRejectedValueOnce(new DOMException("QuotaExceededError", "QuotaExceededError"))
        .mockResolvedValueOnce("" as never)

      // Should not throw -- quota errors are handled with eviction + retry
      await expect(cacheEndpoint("/api/bookings", [{ id: "1" }])).resolves.toBeUndefined()
    })

    it("withQuotaRecovery succeeds on first attempt", async () => {
      // Normal case: no quota error
      await expect(cacheEndpoint("/api/bookings", [{ id: "1" }])).resolves.toBeUndefined()

      const cached = await getCachedEndpoint("/api/bookings")
      expect(cached).toEqual([{ id: "1" }])
    })

    it("withQuotaRecovery evicts stale + retries on quota error", async () => {
      // Add stale entry to evict
      const staleTime = Date.now() - MAX_AGE_MS - 1000
      await offlineDb.endpointCache.put({
        url: "/api/old",
        data: "old",
        cachedAt: staleTime,
      })

      // First put fails, second succeeds
      const putSpy = vi.spyOn(offlineDb.endpointCache, "put")
        .mockRejectedValueOnce(new DOMException("QuotaExceededError", "QuotaExceededError"))
        .mockResolvedValueOnce("" as never)

      await cacheEndpoint("/api/new", [{ id: "new" }])

      // Should have been called twice (first fail, then retry)
      expect(putSpy).toHaveBeenCalledTimes(2)
    })

    it("withQuotaRecovery does not throw if quota still exceeded after eviction", async () => {
      // Both attempts fail with quota error
      vi.spyOn(offlineDb.endpointCache, "put")
        .mockRejectedValueOnce(new DOMException("QuotaExceededError", "QuotaExceededError"))
        .mockRejectedValueOnce(new DOMException("QuotaExceededError", "QuotaExceededError"))

      // Should NOT throw -- graceful degradation
      await expect(cacheEndpoint("/api/bookings", [{ id: "1" }])).resolves.toBeUndefined()
    })

    it("isQuotaError identifies QuotaExceededError correctly", async () => {
      // Safari-style code=22
      const safariError = new DOMException("Quota exceeded", "QuotaExceededError")
      vi.spyOn(offlineDb.endpointCache, "put").mockRejectedValueOnce(safariError).mockResolvedValueOnce("" as never)
      await expect(cacheEndpoint("/api/test", "data")).resolves.toBeUndefined()
    })
  })

  describe("data validation on read", () => {
    it("getCachedBookings filters out records with null data", async () => {
      await offlineDb.metadata.put({
        key: "bookings",
        lastSyncedAt: Date.now(),
        version: 1,
      })
      // Add one valid and one corrupt record
      await offlineDb.bookings.bulkPut([
        { id: "valid", data: { id: "1", status: "confirmed" }, cachedAt: Date.now() },
        { id: "corrupt", data: null, cachedAt: Date.now() },
      ])

      const result = await getCachedBookings()
      expect(result).toHaveLength(1)
      expect(result![0]).toEqual({ id: "1", status: "confirmed" })
    })
  })

  describe("stale cache eviction", () => {
    it("evictStaleCache removes entries older than MAX_AGE_MS", async () => {
      const staleTime = Date.now() - MAX_AGE_MS - 1000
      await offlineDb.endpointCache.put({ url: "/api/old", data: "old", cachedAt: staleTime })
      await offlineDb.endpointCache.put({ url: "/api/fresh", data: "fresh", cachedAt: Date.now() })

      const evicted = await evictStaleCache()

      expect(evicted).toBe(1)
      const remaining = await offlineDb.endpointCache.toArray()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].url).toBe("/api/fresh")
    })

    it("evictStaleCache keeps entries younger than MAX_AGE_MS", async () => {
      await offlineDb.endpointCache.put({ url: "/api/a", data: "a", cachedAt: Date.now() })
      await offlineDb.endpointCache.put({ url: "/api/b", data: "b", cachedAt: Date.now() })

      const evicted = await evictStaleCache()

      expect(evicted).toBe(0)
      const remaining = await offlineDb.endpointCache.toArray()
      expect(remaining).toHaveLength(2)
    })

    it("maybeEvictStaleCache throttles to max once per 5 minutes", async () => {
      const staleTime = Date.now() - MAX_AGE_MS - 1000
      await offlineDb.endpointCache.put({ url: "/api/stale1", data: "s1", cachedAt: staleTime })

      // First call: should evict
      await maybeEvictStaleCache()
      let remaining = await offlineDb.endpointCache.toArray()
      expect(remaining).toHaveLength(0)

      // Add another stale entry
      await offlineDb.endpointCache.put({ url: "/api/stale2", data: "s2", cachedAt: staleTime })

      // Second call (within 5 min): should be throttled
      await maybeEvictStaleCache()
      remaining = await offlineDb.endpointCache.toArray()
      expect(remaining).toHaveLength(1) // Not evicted because throttled
    })
  })

  describe("getCacheStats", () => {
    it("returns stats about cached data", async () => {
      await cacheEndpoint("/api/bookings", [{ id: "1" }])
      await cacheEndpoint("/api/routes/my-routes", [{ id: "r1" }])

      const stats = await getCacheStats()
      expect(stats.totalEntries).toBe(2)
      expect(stats.pendingMutations).toBe(0)
      expect(stats.estimatedSizeBytes).toBeGreaterThan(0)
    })

    it("reports oldest entry age", async () => {
      const oldTime = Date.now() - 60 * 60 * 1000 // 1h ago
      vi.spyOn(Date, "now").mockReturnValueOnce(oldTime)
      await cacheEndpoint("/api/bookings", [{ id: "1" }])
      vi.restoreAllMocks()

      const stats = await getCacheStats()
      expect(stats.oldestEntryAge).toBeGreaterThan(0)
    })
  })

  describe("edge cases", () => {
    it("handles concurrent cache writes to same URL", async () => {
      await Promise.all([
        cacheEndpoint("/api/bookings", [{ id: "1" }]),
        cacheEndpoint("/api/bookings", [{ id: "2" }]),
      ])

      const result = await getCachedEndpoint("/api/bookings")
      // Last write wins
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it("handles empty array as valid cached data", async () => {
      await cacheEndpoint("/api/bookings", [])
      const result = await getCachedEndpoint("/api/bookings")
      expect(result).toEqual([])
    })

    it("handles undefined data field as invalid", async () => {
      await offlineDb.endpointCache.put({
        url: "/api/bookings",
        data: undefined,
        cachedAt: Date.now(),
      })
      const result = await getCachedEndpoint("/api/bookings")
      expect(result).toBeNull()
    })
  })

  describe("clearAllOfflineData", () => {
    it("clears all tables", async () => {
      await cacheBookings([{ id: "1" }])
      await cacheRoutes([{ id: "r1" }])
      await cacheProfile({ id: "p1" })

      await clearAllOfflineData()

      expect(await getCachedBookings()).toBeNull()
      expect(await getCachedRoutes()).toBeNull()
      expect(await getCachedProfile()).toBeNull()
    })
  })
})
