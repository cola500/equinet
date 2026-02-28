import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock Redis before importing the module
const mockGet = vi.fn()
const mockSetex = vi.fn()

vi.mock("@upstash/redis", () => ({
  Redis: class {
    get = mockGet
    setex = mockSetex
  },
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}))

// Must import AFTER mocks
import {
  getCachedProviderInsights,
  setCachedProviderInsights,
  getCachedDashboardStats,
  setCachedDashboardStats,
} from "./provider-stats-cache"

const PROVIDER_ID = "provider-1"

const MOCK_INSIGHTS = {
  serviceBreakdown: [{ serviceName: "Hovvård", count: 5, revenue: 4000 }],
  timeHeatmap: [],
  customerRetention: [],
  kpis: {
    cancellationRate: 10,
    noShowRate: 5,
    averageBookingValue: 800,
    uniqueCustomers: 3,
    manualBookingRate: 25,
  },
}

const MOCK_DASHBOARD_STATS = {
  bookingTrend: [{ week: "v.8", completed: 3, cancelled: 1 }],
  revenueTrend: [{ month: "feb", revenue: 2400 }],
}

describe("provider-stats-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io"
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token"
  })

  describe("getCachedProviderInsights", () => {
    it("returns null on cache miss", async () => {
      mockGet.mockResolvedValue(null)
      const result = await getCachedProviderInsights(PROVIDER_ID, 6)
      expect(result).toBeNull()
    })

    it("returns cached data on hit", async () => {
      mockGet.mockResolvedValue(MOCK_INSIGHTS)
      const result = await getCachedProviderInsights(PROVIDER_ID, 6)
      expect(result).toEqual(MOCK_INSIGHTS)
    })

    it("returns null on Redis error (fail open)", async () => {
      mockGet.mockRejectedValue(new Error("Connection refused"))
      const result = await getCachedProviderInsights(PROVIDER_ID, 6)
      expect(result).toBeNull()
    })
  })

  describe("setCachedProviderInsights", () => {
    it("stores data with 10min TTL (600s)", async () => {
      mockSetex.mockResolvedValue("OK")

      await setCachedProviderInsights(PROVIDER_ID, 6, MOCK_INSIGHTS)

      expect(mockSetex).toHaveBeenCalledWith(
        expect.stringMatching(/^provider-insights:/),
        600,
        MOCK_INSIGHTS
      )
    })
  })

  describe("getCachedDashboardStats", () => {
    it("returns null on cache miss", async () => {
      mockGet.mockResolvedValue(null)
      const result = await getCachedDashboardStats(PROVIDER_ID)
      expect(result).toBeNull()
    })

    it("returns cached data on hit", async () => {
      mockGet.mockResolvedValue(MOCK_DASHBOARD_STATS)
      const result = await getCachedDashboardStats(PROVIDER_ID)
      expect(result).toEqual(MOCK_DASHBOARD_STATS)
    })

    it("returns null on Redis error (fail open)", async () => {
      mockGet.mockRejectedValue(new Error("Connection refused"))
      const result = await getCachedDashboardStats(PROVIDER_ID)
      expect(result).toBeNull()
    })
  })

  describe("setCachedDashboardStats", () => {
    it("stores data with 5min TTL (300s)", async () => {
      mockSetex.mockResolvedValue("OK")

      await setCachedDashboardStats(PROVIDER_ID, MOCK_DASHBOARD_STATS)

      expect(mockSetex).toHaveBeenCalledWith(
        expect.stringMatching(/^dashboard-stats:/),
        300,
        MOCK_DASHBOARD_STATS
      )
    })
  })
})
