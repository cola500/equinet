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
  MAX_AGE_MS,
} from "./cache-manager"
import { offlineDb } from "./db"

describe("cache-manager", () => {
  beforeEach(async () => {
    await offlineDb.bookings.clear()
    await offlineDb.routes.clear()
    await offlineDb.profile.clear()
    await offlineDb.metadata.clear()
    await offlineDb.endpointCache.clear()
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
