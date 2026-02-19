import "fake-indexeddb/auto"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { offlineAwareFetcher, CACHEABLE_ENDPOINTS } from "./offline-fetcher"
import { offlineDb } from "./db"

// Mock global fetch
const mockFetch = vi.fn()

describe("offlineAwareFetcher", () => {
  beforeEach(async () => {
    vi.stubGlobal("fetch", mockFetch)
    await offlineDb.bookings.clear()
    await offlineDb.routes.clear()
    await offlineDb.profile.clear()
    await offlineDb.metadata.clear()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe("CACHEABLE_ENDPOINTS", () => {
    it("includes bookings, routes, and profile endpoints", () => {
      expect(CACHEABLE_ENDPOINTS).toContain("/api/bookings")
      expect(CACHEABLE_ENDPOINTS).toContain("/api/routes/my-routes")
      expect(CACHEABLE_ENDPOINTS).toContain("/api/provider/profile")
    })
  })

  describe("when online (network-first)", () => {
    it("returns data from network on success", async () => {
      const mockData = [{ id: "1", status: "confirmed" }]
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      })

      const result = await offlineAwareFetcher("/api/bookings")
      expect(result).toEqual(mockData)
    })

    it("writes cacheable data to IndexedDB", async () => {
      const mockData = [{ id: "1", status: "confirmed" }]
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      })

      await offlineAwareFetcher("/api/bookings")

      // Give fire-and-forget time to complete
      await new Promise((r) => setTimeout(r, 50))

      const meta = await offlineDb.metadata.get("bookings")
      expect(meta).toBeDefined()
    })

    it("does NOT cache non-cacheable endpoints", async () => {
      const mockData = { users: [] }
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      })

      await offlineAwareFetcher("/api/admin/users")

      await new Promise((r) => setTimeout(r, 50))

      const meta = await offlineDb.metadata.get("admin/users")
      expect(meta).toBeUndefined()
    })

    it("throws on non-OK response without cache", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      })

      await expect(offlineAwareFetcher("/api/bookings")).rejects.toThrow(
        "API request failed"
      )
    })
  })

  describe("when offline (cache-fallback)", () => {
    it("returns cached bookings when network fails", async () => {
      // Pre-populate cache
      const now = Date.now()
      await offlineDb.bookings.bulkPut([
        { id: "1", data: { id: "1", status: "cached" }, cachedAt: now },
      ])
      await offlineDb.metadata.put({
        key: "bookings",
        lastSyncedAt: now,
        version: 1,
      })

      // Simulate network failure
      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"))

      const result = await offlineAwareFetcher("/api/bookings")
      expect(result).toEqual([{ id: "1", status: "cached" }])
    })

    it("returns cached routes when network fails", async () => {
      const now = Date.now()
      await offlineDb.routes.bulkPut([
        { id: "r1", data: { id: "r1", name: "Route" }, cachedAt: now },
      ])
      await offlineDb.metadata.put({
        key: "routes",
        lastSyncedAt: now,
        version: 1,
      })

      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"))

      const result = await offlineAwareFetcher("/api/routes/my-routes")
      expect(result).toEqual([{ id: "r1", name: "Route" }])
    })

    it("returns cached profile when network fails", async () => {
      const now = Date.now()
      await offlineDb.profile.put({
        id: "profile",
        data: { name: "Provider" },
        cachedAt: now,
      })
      await offlineDb.metadata.put({
        key: "profile",
        lastSyncedAt: now,
        version: 1,
      })

      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"))

      const result = await offlineAwareFetcher("/api/provider/profile")
      expect(result).toEqual({ name: "Provider" })
    })

    it("throws when network fails and no cache exists", async () => {
      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"))

      await expect(offlineAwareFetcher("/api/bookings")).rejects.toThrow()
    })

    it("throws when network fails and cache is stale", async () => {
      // Pre-populate with stale cache (>4h old)
      const staleTime = Date.now() - 5 * 60 * 60 * 1000
      await offlineDb.bookings.bulkPut([
        { id: "1", data: { id: "1" }, cachedAt: staleTime },
      ])
      await offlineDb.metadata.put({
        key: "bookings",
        lastSyncedAt: staleTime,
        version: 1,
      })

      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"))

      await expect(offlineAwareFetcher("/api/bookings")).rejects.toThrow()
    })

    it("throws for non-cacheable endpoints when offline", async () => {
      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"))

      await expect(
        offlineAwareFetcher("/api/admin/settings")
      ).rejects.toThrow()
    })
  })
})
