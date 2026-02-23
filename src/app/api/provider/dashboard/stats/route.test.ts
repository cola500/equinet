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

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { GET } from "./route"

const mockAuth = vi.mocked(auth)
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
    mockAuth.mockResolvedValue(null as any)

    const response = await GET(createRequest())
    expect(response.status).toBe(401)
  })

  it("should return 404 when provider not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any)
    mockFindFirst.mockResolvedValue(null)

    const response = await GET(createRequest())
    expect(response.status).toBe(404)
  })

  it("should return empty trends for provider with no bookings", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any)
    mockFindFirst.mockResolvedValue({ id: "provider-1" } as any)
    mockFindMany.mockResolvedValue([])

    const response = await GET(createRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.bookingTrend).toHaveLength(8)
    expect(data.revenueTrend).toHaveLength(6)
    // All zero values
    expect(data.bookingTrend.every((w: any) => w.completed === 0 && w.cancelled === 0)).toBe(true)
    expect(data.revenueTrend.every((m: any) => m.revenue === 0)).toBe(true)
  })

  it("should correctly count completed and cancelled bookings per week", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any)
    mockFindFirst.mockResolvedValue({ id: "provider-1" } as any)

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
    ] as any)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(response.status).toBe(200)

    // The most recent week should have 2 completed, 1 cancelled
    const lastWeek = data.bookingTrend[data.bookingTrend.length - 1]
    expect(lastWeek.completed).toBe(2)
    expect(lastWeek.cancelled).toBe(1)
  })

  it("should calculate revenue from completed bookings only", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any)
    mockFindFirst.mockResolvedValue({ id: "provider-1" } as any)

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
    ] as any)

    const response = await GET(createRequest())
    const data = await response.json()

    // Only completed booking should count for revenue
    const lastMonth = data.revenueTrend[data.revenueTrend.length - 1]
    expect(lastMonth.revenue).toBe(800)
  })

  it("should return exactly 8 weeks and 6 months", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any)
    mockFindFirst.mockResolvedValue({ id: "provider-1" } as any)
    mockFindMany.mockResolvedValue([])

    const response = await GET(createRequest())
    const data = await response.json()

    expect(data.bookingTrend).toHaveLength(8)
    expect(data.revenueTrend).toHaveLength(6)
  })

  it("should use select on booking query (not include)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as any)
    mockFindFirst.mockResolvedValue({ id: "provider-1" } as any)
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
