import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { startOfWeek } from "date-fns"

// Mock dependencies
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: { findFirst: vi.fn() },
    booking: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/cache/provider-stats-cache", () => ({
  getCachedDashboardStats: vi.fn().mockResolvedValue(null),
  setCachedDashboardStats: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"
import { getCachedDashboardStats, setCachedDashboardStats } from "@/lib/cache/provider-stats-cache"
import { GET } from "./route"

const mockAuth = vi.mocked(auth)
const mockRateLimiters = vi.mocked(rateLimiters)
const mockGetCachedStats = vi.mocked(getCachedDashboardStats)
const mockSetCachedStats = vi.mocked(setCachedDashboardStats)
const mockFindFirst = vi.mocked(prisma.provider.findFirst)
const mockFindMany = vi.mocked(prisma.booking.findMany)

function createRequest() {
  return new NextRequest(
    "http://localhost:3000/api/provider/dashboard/stats",
    { method: "GET" }
  )
}

describe("GET /api/provider/dashboard/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never)

    const response = await GET(createRequest())
    expect(response.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockRateLimiters.api.mockResolvedValueOnce(false)

    const response = await GET(createRequest())
    expect(response.status).toBe(429)
  })

  it("should return 404 when provider not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockFindFirst.mockResolvedValue(null)

    const response = await GET(createRequest())
    expect(response.status).toBe(404)
  })

  it("should return empty trends for provider with no bookings", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockFindFirst.mockResolvedValue({ id: "provider-1" } as never)
    mockFindMany.mockResolvedValue([])

    const response = await GET(createRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.bookingTrend).toHaveLength(8)
    expect(data.revenueTrend).toHaveLength(6)
    // All zero values
    expect(data.bookingTrend.every((w: { completed: number; cancelled: number }) => w.completed === 0 && w.cancelled === 0)).toBe(true)
    expect(data.revenueTrend.every((m: { revenue: number }) => m.revenue === 0)).toBe(true)
  })

  it("should correctly count completed and cancelled bookings per week", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockFindFirst.mockResolvedValue({ id: "provider-1" } as never)

    const now = new Date()
    // Use this week's Monday to guarantee the date falls in the current week bucket
    const thisWeekDate = startOfWeek(now, { weekStartsOn: 1 })

    mockFindMany.mockResolvedValue([
      {
        bookingDate: thisWeekDate,
        status: "completed",
        service: { price: 800 },
      },
      {
        bookingDate: thisWeekDate,
        status: "completed",
        service: { price: 1200 },
      },
      {
        bookingDate: thisWeekDate,
        status: "cancelled",
        service: { price: 500 },
      },
    ] as never)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(response.status).toBe(200)

    // The most recent week should have 2 completed, 1 cancelled
    const lastWeek = data.bookingTrend[data.bookingTrend.length - 1]
    expect(lastWeek.completed).toBe(2)
    expect(lastWeek.cancelled).toBe(1)
  })

  it("should calculate revenue from completed bookings only", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockFindFirst.mockResolvedValue({ id: "provider-1" } as never)

    const now = new Date()
    mockFindMany.mockResolvedValue([
      {
        bookingDate: now,
        status: "completed",
        service: { price: 800 },
      },
      {
        bookingDate: now,
        status: "cancelled",
        service: { price: 1200 },
      },
    ] as never)

    const response = await GET(createRequest())
    const data = await response.json()

    // Only completed booking should count for revenue
    const lastMonth = data.revenueTrend[data.revenueTrend.length - 1]
    expect(lastMonth.revenue).toBe(800)
  })

  it("should return exactly 8 weeks and 6 months", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockFindFirst.mockResolvedValue({ id: "provider-1" } as never)
    mockFindMany.mockResolvedValue([])

    const response = await GET(createRequest())
    const data = await response.json()

    expect(data.bookingTrend).toHaveLength(8)
    expect(data.revenueTrend).toHaveLength(6)
  })

  // --- Caching ---

  it("returns cached data on cache hit", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockFindFirst.mockResolvedValue({ id: "provider-1" } as never)

    const cachedData = {
      bookingTrend: [{ week: "v.8", completed: 5, cancelled: 0 }],
      revenueTrend: [{ month: "feb", revenue: 4000 }],
    }
    mockGetCachedStats.mockResolvedValueOnce(cachedData)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(cachedData)
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it("calls setCachedDashboardStats after DB fetch", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockFindFirst.mockResolvedValue({ id: "provider-1" } as never)
    mockFindMany.mockResolvedValue([])

    await GET(createRequest())

    expect(mockSetCachedStats).toHaveBeenCalledWith(
      "provider-1",
      expect.objectContaining({
        bookingTrend: expect.any(Array),
        revenueTrend: expect.any(Array),
      })
    )
  })

  it("should use select on booking query (not include)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockFindFirst.mockResolvedValue({ id: "provider-1" } as never)
    mockFindMany.mockResolvedValue([])

    await GET(createRequest())

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          bookingDate: true,
          status: true,
        }),
      })
    )
  })
})
