/**
 * GET /api/native/insights - Business insights for native iOS
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: { findUnique: vi.fn() },
    booking: { findMany: vi.fn() },
  },
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class RateLimitServiceError extends Error {},
}))
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

import { GET } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"

const mockAuth = vi.mocked(getAuthUser)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockFindManyBookings = vi.mocked(prisma.booking.findMany)
const mockRateLimit = vi.mocked(rateLimiters.api)
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

function createRequest(months?: number) {
  const url = new URL("http://localhost:3000/api/native/insights")
  if (months !== undefined) url.searchParams.set("months", String(months))
  return new NextRequest(url, {
    method: "GET",
    headers: { Authorization: "Bearer valid-jwt-token" },
  })
}

// Mock booking data for calculations
const mockBookings = [
  {
    id: "b1",
    bookingDate: new Date("2026-03-15"),
    startTime: "10:00",
    status: "completed",
    customerId: "c1",
    isManualBooking: false,
    service: { id: "s1", name: "Hovvård", price: 1200 },
  },
  {
    id: "b2",
    bookingDate: new Date("2026-03-16"),
    startTime: "14:00",
    status: "completed",
    customerId: "c2",
    isManualBooking: true,
    service: { id: "s1", name: "Hovvård", price: 1200 },
  },
  {
    id: "b3",
    bookingDate: new Date("2026-02-10"),
    startTime: "09:00",
    status: "cancelled",
    customerId: "c1",
    isManualBooking: false,
    service: { id: "s2", name: "Tandvård", price: 800 },
  },
  {
    id: "b4",
    bookingDate: new Date("2026-01-20"),
    startTime: "11:00",
    status: "no_show",
    customerId: "c3",
    isManualBooking: false,
    service: { id: "s1", name: "Hovvård", price: 1200 },
  },
]

describe("GET /api/native/insights", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "bearer" as const })
    mockFindProvider.mockResolvedValue({ id: "provider-1" } as never)
    mockRateLimit.mockResolvedValue(true)
    mockIsFeatureEnabled.mockResolvedValue(true)
    mockFindManyBookings.mockResolvedValue([] as never)
  })

  // Auth
  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(createRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Ej inloggad")
  })

  // Rate limiting
  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await GET(createRequest())
    expect(res.status).toBe(429)
  })

  it("returns 503 when rate limiter fails", async () => {
    mockRateLimit.mockRejectedValue(new RateLimitServiceError("Redis error"))
    const res = await GET(createRequest())
    expect(res.status).toBe(503)
  })

  // Feature flag
  it("returns 404 when feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValue(false)
    const res = await GET(createRequest())
    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("business_insights")
  })

  // Provider
  it("returns 404 when provider not found", async () => {
    mockFindProvider.mockResolvedValue(null)
    const res = await GET(createRequest())
    expect(res.status).toBe(404)
  })

  // Empty data
  it("returns empty insights when no bookings", async () => {
    const res = await GET(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.kpis).toBeDefined()
    expect(body.kpis.cancellationRate).toBe(0)
    expect(body.kpis.uniqueCustomers).toBe(0)
    expect(body.serviceBreakdown).toEqual([])
    expect(body.timeHeatmap).toBeDefined()
    expect(body.customerRetention).toBeDefined()
  })

  // KPI calculations
  it("calculates KPIs correctly", async () => {
    mockFindManyBookings.mockResolvedValue(mockBookings as never)
    const res = await GET(createRequest(6))
    expect(res.status).toBe(200)
    const body = await res.json()

    // 4 total: 2 completed, 1 cancelled, 1 no_show
    expect(body.kpis.cancellationRate).toBe(25) // 1/4 = 25%
    expect(body.kpis.noShowRate).toBe(25) // 1/4 = 25%
    expect(body.kpis.averageBookingValue).toBe(1200) // (1200+1200)/2
    expect(body.kpis.uniqueCustomers).toBe(3) // c1, c2, c3
    expect(body.kpis.manualBookingRate).toBe(25) // 1/4 = 25%
  })

  // Service breakdown
  it("returns service breakdown sorted by revenue", async () => {
    mockFindManyBookings.mockResolvedValue(mockBookings as never)
    const res = await GET(createRequest(6))
    const body = await res.json()

    // Only completed bookings: 2x Hovvård (2400kr)
    expect(body.serviceBreakdown).toHaveLength(1)
    expect(body.serviceBreakdown[0].serviceName).toBe("Hovvård")
    expect(body.serviceBreakdown[0].count).toBe(2)
    expect(body.serviceBreakdown[0].revenue).toBe(2400)
  })

  // Time heatmap
  it("returns time heatmap excluding cancelled bookings", async () => {
    mockFindManyBookings.mockResolvedValue(mockBookings as never)
    const res = await GET(createRequest(6))
    const body = await res.json()

    // 3 non-cancelled bookings with valid startTime
    expect(body.timeHeatmap.length).toBeGreaterThanOrEqual(1)
    // No cancelled booking hours should appear
    const totalCount = body.timeHeatmap.reduce(
      (sum: number, h: { count: number }) => sum + h.count,
      0
    )
    expect(totalCount).toBe(3) // b1, b2, b4 (not b3 cancelled)
  })

  // Months param
  it("clamps months parameter to 3-12 range", async () => {
    // months=1 should clamp to 3
    await GET(createRequest(1))
    expect(mockFindManyBookings).toHaveBeenCalled()
    // Verify the where clause uses a date ~3 months ago (not 1 month)
    const call = mockFindManyBookings.mock.calls[0][0] as { where: { bookingDate: { gte: Date } } }
    const dateGte = call.where.bookingDate.gte
    const now = new Date()
    const monthsDiff =
      (now.getFullYear() - dateGte.getFullYear()) * 12 +
      (now.getMonth() - dateGte.getMonth())
    expect(monthsDiff).toBeGreaterThanOrEqual(2) // ~3 months
  })

  // Error
  it("returns 500 on unexpected error", async () => {
    mockFindManyBookings.mockRejectedValue(new Error("DB error"))
    const res = await GET(createRequest())
    expect(res.status).toBe(500)
  })
})
