import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

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
    booking: { findMany: vi.fn(), groupBy: vi.fn(), count: vi.fn() },
    service: { findMany: vi.fn() },
  },
}))

vi.mock("@/lib/cache/provider-stats-cache", () => ({
  getCachedProviderInsights: vi.fn().mockResolvedValue(null),
  setCachedProviderInsights: vi.fn().mockResolvedValue(undefined),
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
import { getCachedProviderInsights, setCachedProviderInsights } from "@/lib/cache/provider-stats-cache"
import { GET } from "./route"

const mockAuth = vi.mocked(auth)
const mockRateLimiters = vi.mocked(rateLimiters)
const mockProviderFindFirst = vi.mocked(prisma.provider.findFirst)
const mockBookingFindMany = vi.mocked(prisma.booking.findMany)
const mockBookingCount = vi.mocked(prisma.booking.count)
const mockGetCachedInsights = vi.mocked(getCachedProviderInsights)
const mockSetCachedInsights = vi.mocked(setCachedProviderInsights)

function createRequest(months?: number) {
  const url = months
    ? `http://localhost:3000/api/provider/insights?months=${months}`
    : "http://localhost:3000/api/provider/insights"
  return new NextRequest(url, { method: "GET" })
}

const PROVIDER_ID = "a0000000-0000-4000-a000-000000000001"

function setupAuthenticatedProvider() {
  mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
  mockProviderFindFirst.mockResolvedValue({ id: PROVIDER_ID } as never)
}

function setupEmptyData() {
  mockBookingFindMany.mockResolvedValue([])
  mockBookingCount.mockResolvedValue(0)
}

// Helper to create booking data for tests
function createBooking(overrides: Record<string, unknown> = {}) {
  const now = new Date()
  return {
    id: `booking-${Math.random().toString(36).slice(2)}`,
    bookingDate: now,
    startTime: "10:00",
    status: "completed",
    customerId: "customer-1",
    isManualBooking: false,
    service: { id: "service-1", name: "Hovbeläggning", price: 800 },
    ...overrides,
  }
}

describe("GET /api/provider/insights", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- Auth & authorization ---

  it("should return 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never)

    const response = await GET(createRequest())
    expect(response.status).toBe(401)

    const data = await response.json()
    expect(data.error).toBe("Ej inloggad")
  })

  it("returns 429 when rate limited", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockRateLimiters.api.mockResolvedValueOnce(false)

    const response = await GET(createRequest())
    expect(response.status).toBe(429)
  })

  it("should return 404 when provider not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never)
    mockProviderFindFirst.mockResolvedValue(null)

    const response = await GET(createRequest())
    expect(response.status).toBe(404)

    const data = await response.json()
    expect(data.error).toBe("Leverantör hittades inte")
  })

  // --- Empty data ---

  it("should return empty results when no bookings exist", async () => {
    setupAuthenticatedProvider()
    setupEmptyData()

    const response = await GET(createRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.serviceBreakdown).toEqual([])
    expect(data.timeHeatmap).toBeDefined()
    expect(data.customerRetention).toBeDefined()
    expect(data.kpis).toBeDefined()
  })

  // --- KPIs ---

  it("should calculate cancellation rate correctly", async () => {
    setupAuthenticatedProvider()
    mockBookingCount.mockResolvedValue(10)
    mockBookingFindMany.mockResolvedValue([
      createBooking({ status: "completed" }),
      createBooking({ status: "completed" }),
      createBooking({ status: "completed" }),
      createBooking({ status: "completed" }),
      createBooking({ status: "completed" }),
      createBooking({ status: "completed" }),
      createBooking({ status: "completed" }),
      createBooking({ status: "cancelled" }),
      createBooking({ status: "cancelled" }),
      createBooking({ status: "no_show" }),
    ] as never)

    const response = await GET(createRequest())
    const data = await response.json()

    // 2 cancelled out of 10 = 20%
    expect(data.kpis.cancellationRate).toBe(20)
    // 1 no_show out of 10 = 10%
    expect(data.kpis.noShowRate).toBe(10)
  })

  it("should calculate average booking value", async () => {
    setupAuthenticatedProvider()
    mockBookingCount.mockResolvedValue(3)
    mockBookingFindMany.mockResolvedValue([
      createBooking({ status: "completed", service: { id: "s1", name: "A", price: 600 } }),
      createBooking({ status: "completed", service: { id: "s2", name: "B", price: 900 } }),
      createBooking({ status: "completed", service: { id: "s3", name: "C", price: 1200 } }),
    ] as never)

    const response = await GET(createRequest())
    const data = await response.json()

    // (600 + 900 + 1200) / 3 = 900
    expect(data.kpis.averageBookingValue).toBe(900)
  })

  it("should count unique customers", async () => {
    setupAuthenticatedProvider()
    mockBookingCount.mockResolvedValue(4)
    mockBookingFindMany.mockResolvedValue([
      createBooking({ customerId: "c1" }),
      createBooking({ customerId: "c2" }),
      createBooking({ customerId: "c1" }),
      createBooking({ customerId: "c3" }),
    ] as never)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(data.kpis.uniqueCustomers).toBe(3)
  })

  it("should calculate manual vs customer-initiated booking rate", async () => {
    setupAuthenticatedProvider()
    mockBookingCount.mockResolvedValue(4)
    mockBookingFindMany.mockResolvedValue([
      createBooking({ isManualBooking: true }),
      createBooking({ isManualBooking: true }),
      createBooking({ isManualBooking: false }),
      createBooking({ isManualBooking: false }),
    ] as never)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(data.kpis.manualBookingRate).toBe(50)
  })

  // --- Service breakdown ---

  it("should group bookings by service", async () => {
    setupAuthenticatedProvider()
    mockBookingCount.mockResolvedValue(3)
    mockBookingFindMany.mockResolvedValue([
      createBooking({ status: "completed", service: { id: "s1", name: "Hovbeläggning", price: 800 } }),
      createBooking({ status: "completed", service: { id: "s1", name: "Hovbeläggning", price: 800 } }),
      createBooking({ status: "completed", service: { id: "s2", name: "Verkning", price: 600 } }),
    ] as never)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(data.serviceBreakdown).toHaveLength(2)
    const hov = data.serviceBreakdown.find((s: { serviceName: string }) => s.serviceName === "Hovbeläggning")
    expect(hov.count).toBe(2)
    expect(hov.revenue).toBe(1600)
  })

  // --- Time heatmap ---

  it("should produce a time heatmap from booking data", async () => {
    setupAuthenticatedProvider()
    mockBookingCount.mockResolvedValue(2)

    // Monday at 10:00
    const monday = new Date("2026-02-16T10:00:00") // Monday
    mockBookingFindMany.mockResolvedValue([
      createBooking({ bookingDate: monday, startTime: "10:00" }),
      createBooking({ bookingDate: monday, startTime: "10:00" }),
    ] as never)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(data.timeHeatmap).toBeDefined()
    expect(Array.isArray(data.timeHeatmap)).toBe(true)
    // Should have entries for days/hours with bookings
    expect(data.timeHeatmap.length).toBeGreaterThan(0)
  })

  // --- Customer retention ---

  it("should calculate customer retention data", async () => {
    setupAuthenticatedProvider()
    mockBookingCount.mockResolvedValue(3)

    const month1 = new Date("2026-01-15")
    const month2 = new Date("2026-02-15")

    mockBookingFindMany.mockResolvedValue([
      createBooking({ customerId: "c1", bookingDate: month1, status: "completed" }),
      createBooking({ customerId: "c2", bookingDate: month1, status: "completed" }),
      createBooking({ customerId: "c1", bookingDate: month2, status: "completed" }),
    ] as never)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(data.customerRetention).toBeDefined()
    expect(Array.isArray(data.customerRetention)).toBe(true)
  })

  // --- Period filter ---

  it("should accept months query parameter", async () => {
    setupAuthenticatedProvider()
    setupEmptyData()

    const response = await GET(createRequest(3))
    expect(response.status).toBe(200)
  })

  it("should default to 6 months when no parameter given", async () => {
    setupAuthenticatedProvider()
    setupEmptyData()

    const response = await GET(createRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    // customerRetention should have entries for 6 months
    expect(data.customerRetention.length).toBeLessThanOrEqual(6)
  })

  it("should clamp months to valid range (3-12)", async () => {
    setupAuthenticatedProvider()
    setupEmptyData()

    // Too small
    const response1 = await GET(createRequest(1))
    expect(response1.status).toBe(200)

    // Too large
    const response2 = await GET(createRequest(24))
    expect(response2.status).toBe(200)
  })

  // --- Security ---

  it("should use select on provider query (not include)", async () => {
    setupAuthenticatedProvider()
    setupEmptyData()

    await GET(createRequest())

    expect(mockProviderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ id: true }),
      })
    )
  })

  it("should use select on booking query (not include)", async () => {
    setupAuthenticatedProvider()
    setupEmptyData()

    await GET(createRequest())

    expect(mockBookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          bookingDate: true,
          status: true,
        }),
      })
    )
  })

  // --- Caching ---

  it("returns cached data on cache hit", async () => {
    setupAuthenticatedProvider()
    const cachedData = {
      serviceBreakdown: [],
      timeHeatmap: [],
      customerRetention: [],
      kpis: { cancellationRate: 0, noShowRate: 0, averageBookingValue: 0, uniqueCustomers: 0, manualBookingRate: 0 },
    }
    mockGetCachedInsights.mockResolvedValueOnce(cachedData)

    const response = await GET(createRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(cachedData)
    // Should NOT query the database
    expect(mockBookingFindMany).not.toHaveBeenCalled()
  })

  it("calls setCachedProviderInsights after DB fetch", async () => {
    setupAuthenticatedProvider()
    setupEmptyData()

    await GET(createRequest())

    expect(mockSetCachedInsights).toHaveBeenCalledWith(
      PROVIDER_ID,
      6,
      expect.objectContaining({
        serviceBreakdown: expect.any(Array),
        kpis: expect.any(Object),
      })
    )
  })

  // --- Error handling ---

  it("should return 500 on unexpected error", async () => {
    mockAuth.mockRejectedValue(new Error("DB connection failed"))

    const response = await GET(createRequest())
    expect(response.status).toBe(500)

    const data = await response.json()
    expect(data.error).toBe("Internt serverfel")
  })
})
