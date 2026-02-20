import "fake-indexeddb/auto"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { offlineAwareFetcher, CACHEABLE_ENDPOINTS } from "./offline-fetcher"
import { offlineDb } from "./db"
import {
  reportConnectivityLoss,
  reportConnectivityRestored,
} from "@/hooks/useOnlineStatus"

vi.mock("@/hooks/useOnlineStatus", () => ({
  reportConnectivityLoss: vi.fn(),
  reportConnectivityRestored: vi.fn(),
}))

// Mock global fetch
const mockFetch = vi.fn()

describe("offlineAwareFetcher", () => {
  beforeEach(async () => {
    vi.stubGlobal("fetch", mockFetch)
    vi.clearAllMocks()
    await offlineDb.bookings.clear()
    await offlineDb.routes.clear()
    await offlineDb.profile.clear()
    await offlineDb.metadata.clear()
    await offlineDb.endpointCache.clear()
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

    it("writes cacheable data to IndexedDB endpoint cache", async () => {
      const mockData = [{ id: "1", status: "confirmed" }]
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      })

      await offlineAwareFetcher("/api/bookings")

      // Give fire-and-forget time to complete
      await new Promise((r) => setTimeout(r, 50))

      const cached = await offlineDb.endpointCache.get("/api/bookings")
      expect(cached).toBeDefined()
      expect(cached!.data).toEqual(mockData)
    })

    it("caches with full URL including query params", async () => {
      const mockData = [{ id: "1", status: "pending" }]
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      })

      await offlineAwareFetcher("/api/bookings?status=pending")

      await new Promise((r) => setTimeout(r, 50))

      const cached = await offlineDb.endpointCache.get("/api/bookings?status=pending")
      expect(cached).toBeDefined()
      expect(cached!.data).toEqual(mockData)
    })

    it("does NOT cache non-cacheable endpoints", async () => {
      const mockData = { users: [] }
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      })

      await offlineAwareFetcher("/api/admin/users")

      await new Promise((r) => setTimeout(r, 50))

      const cached = await offlineDb.endpointCache.get("/api/admin/users")
      expect(cached).toBeUndefined()
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
      // Pre-populate endpoint cache
      const now = Date.now()
      await offlineDb.endpointCache.put({
        url: "/api/bookings",
        data: [{ id: "1", status: "cached" }],
        cachedAt: now,
      })

      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"))

      const result = await offlineAwareFetcher("/api/bookings")
      expect(result).toEqual([{ id: "1", status: "cached" }])
    })

    it("returns cached data for URL with query params", async () => {
      const now = Date.now()
      await offlineDb.endpointCache.put({
        url: "/api/bookings?status=pending",
        data: [{ id: "1", status: "pending" }],
        cachedAt: now,
      })

      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"))

      const result = await offlineAwareFetcher("/api/bookings?status=pending")
      expect(result).toEqual([{ id: "1", status: "pending" }])
    })

    it("falls back to base URL when exact query match not found", async () => {
      const now = Date.now()
      await offlineDb.endpointCache.put({
        url: "/api/bookings",
        data: [{ id: "all" }],
        cachedAt: now,
      })

      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"))

      const result = await offlineAwareFetcher("/api/bookings?status=new")
      expect(result).toEqual([{ id: "all" }])
    })

    it("returns cached routes when network fails", async () => {
      const now = Date.now()
      await offlineDb.endpointCache.put({
        url: "/api/routes/my-routes",
        data: [{ id: "r1", name: "Route" }],
        cachedAt: now,
      })

      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"))

      const result = await offlineAwareFetcher("/api/routes/my-routes")
      expect(result).toEqual([{ id: "r1", name: "Route" }])
    })

    it("returns cached profile when network fails", async () => {
      const now = Date.now()
      await offlineDb.endpointCache.put({
        url: "/api/provider/profile",
        data: { name: "Provider" },
        cachedAt: now,
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
      const staleTime = Date.now() - 5 * 60 * 60 * 1000
      await offlineDb.endpointCache.put({
        url: "/api/bookings",
        data: [{ id: "1" }],
        cachedAt: staleTime,
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

  describe("connectivity reporting", () => {
    it("calls reportConnectivityRestored on successful fetch", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: "ok" }),
      })

      await offlineAwareFetcher("/api/bookings")

      expect(reportConnectivityRestored).toHaveBeenCalled()
    })

    it("calls reportConnectivityLoss on TypeError (network failure)", async () => {
      const now = Date.now()
      await offlineDb.endpointCache.put({
        url: "/api/bookings",
        data: [{ id: "1" }],
        cachedAt: now,
      })

      mockFetch.mockRejectedValue(new TypeError("Failed to fetch"))

      await offlineAwareFetcher("/api/bookings")

      expect(reportConnectivityLoss).toHaveBeenCalled()
    })

    it("does NOT call reportConnectivityLoss on non-TypeError errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      })

      try {
        await offlineAwareFetcher("/api/bookings")
      } catch {
        // expected
      }

      expect(reportConnectivityLoss).not.toHaveBeenCalled()
    })
  })
})
