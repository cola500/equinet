/**
 * GET /api/native/dashboard tests
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/mobile-auth", () => ({
  authFromMobileToken: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: { findUnique: vi.fn() },
    booking: { findMany: vi.fn() },
    customerReview: { aggregate: vi.fn() },
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

import { GET } from "./route"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"

const mockAuth = vi.mocked(authFromMobileToken)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockFindBookings = vi.mocked(prisma.booking.findMany)
const mockAggregateReviews = vi.mocked(prisma.customerReview.aggregate)
const mockRateLimit = vi.mocked(rateLimiters.api)

function createRequest() {
  return new NextRequest("http://localhost:3000/api/native/dashboard", {
    method: "GET",
    headers: { Authorization: "Bearer valid-jwt-token" },
  })
}

// Provider with full onboarding data
const mockProviderFull = {
  id: "provider-1",
  businessName: "Test Stall",
  description: "Vi erbjuder ridlektioner",
  address: "Stallvägen 1",
  city: "Stockholm",
  postalCode: "12345",
  latitude: 59.3293,
  longitude: 18.0686,
  isActive: true,
  services: [{ id: "svc-1" }],
  availability: [{ id: "avail-1" }],
}

// Provider with incomplete onboarding
const mockProviderIncomplete = {
  id: "provider-2",
  businessName: "Nytt Stall",
  description: null,
  address: null,
  city: null,
  postalCode: null,
  latitude: null,
  longitude: null,
  isActive: false,
  services: [],
  availability: [],
}

const mockTodayBooking = {
  id: "booking-1",
  startTime: "09:00",
  endTime: "10:00",
  status: "confirmed",
  customer: { firstName: "Anna", lastName: "Andersson" },
  service: { name: "Ridlektion" },
}

const mockPendingBooking = {
  id: "booking-2",
  startTime: "14:00",
  endTime: "15:00",
  status: "pending",
  customer: { firstName: "Erik", lastName: "Eriksson" },
  service: { name: "Hovslagare" },
}

describe("GET /api/native/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: "user-1", tokenId: "token-1" })
    mockFindProvider.mockResolvedValue(mockProviderFull as never)
    mockFindBookings
      .mockResolvedValueOnce([mockTodayBooking] as never)   // today bookings
      .mockResolvedValueOnce([mockTodayBooking, mockPendingBooking] as never) // upcoming + pending
    mockAggregateReviews.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { _all: 12 },
    } as never)
    mockRateLimit.mockResolvedValue(true)
  })

  // Auth
  it("returns 401 when Bearer token is missing", async () => {
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
    const body = await res.json()
    expect(body.error).toBe("För många förfrågningar, försök igen senare")
  })

  it("returns 503 when rate limiter fails", async () => {
    mockRateLimit.mockRejectedValue(new RateLimitServiceError("Redis error"))
    const res = await GET(createRequest())
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe("Tjänsten är tillfälligt otillgänglig")
  })

  // Provider not found
  it("returns 404 when provider not found", async () => {
    mockFindProvider.mockResolvedValue(null)
    const res = await GET(createRequest())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Leverantör hittades inte")
  })

  // Success -- KPI counts
  it("returns correct KPI counts", async () => {
    const res = await GET(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.todayBookingCount).toBe(1)  // 1 confirmed today
    expect(body.upcomingBookingCount).toBe(2) // 2 total upcoming (confirmed+pending)
    expect(body.pendingBookingCount).toBe(1) // 1 pending
  })

  // Success -- todayBookings
  it("returns today bookings with correct fields", async () => {
    const res = await GET(createRequest())
    const body = await res.json()
    expect(body.todayBookings).toHaveLength(1)
    expect(body.todayBookings[0]).toEqual({
      id: "booking-1",
      startTime: "09:00",
      endTime: "10:00",
      customerFirstName: "Anna",
      customerLastName: "Andersson",
      serviceName: "Ridlektion",
      status: "confirmed",
    })
  })

  // Success -- review stats
  it("returns review stats", async () => {
    const res = await GET(createRequest())
    const body = await res.json()
    expect(body.reviewStats).toEqual({
      averageRating: 4.5,
      totalCount: 12,
    })
  })

  it("returns null averageRating when no reviews", async () => {
    mockAggregateReviews.mockResolvedValue({
      _avg: { rating: null },
      _count: { _all: 0 },
    } as never)
    const res = await GET(createRequest())
    const body = await res.json()
    expect(body.reviewStats).toEqual({
      averageRating: null,
      totalCount: 0,
    })
  })

  // Success -- onboarding status
  it("returns onboarding status when complete", async () => {
    const res = await GET(createRequest())
    const body = await res.json()
    expect(body.onboarding).toEqual({
      profileComplete: true,
      hasServices: true,
      hasAvailability: true,
      hasServiceArea: true,
      allComplete: true,
    })
  })

  it("returns onboarding status when incomplete", async () => {
    mockFindProvider.mockResolvedValue(mockProviderIncomplete as never)
    const res = await GET(createRequest())
    const body = await res.json()
    expect(body.onboarding).toEqual({
      profileComplete: false,
      hasServices: false,
      hasAvailability: false,
      hasServiceArea: false,
      allComplete: false,
    })
  })

  // Success -- priority action
  it("returns pending_bookings as priority when pending exist", async () => {
    const res = await GET(createRequest())
    const body = await res.json()
    expect(body.priorityAction.type).toBe("pending_bookings")
    expect(body.priorityAction.count).toBe(1)
  })

  it("returns incomplete_onboarding when no pending but onboarding incomplete", async () => {
    mockFindProvider.mockResolvedValue(mockProviderIncomplete as never)
    mockFindBookings
      .mockReset()
      .mockResolvedValueOnce([] as never)  // today bookings
      .mockResolvedValueOnce([] as never)  // upcoming
    const res = await GET(createRequest())
    const body = await res.json()
    expect(body.priorityAction.type).toBe("incomplete_onboarding")
  })

  it("returns none when no pending and onboarding complete", async () => {
    mockFindBookings
      .mockReset()
      .mockResolvedValueOnce([] as never)  // today bookings
      .mockResolvedValueOnce([{ ...mockTodayBooking, status: "confirmed" }] as never) // upcoming, no pending
    const res = await GET(createRequest())
    const body = await res.json()
    expect(body.priorityAction.type).toBe("none")
  })

  // Empty state
  it("returns empty state with zero counts", async () => {
    mockFindBookings
      .mockReset()
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
    mockAggregateReviews.mockResolvedValue({
      _avg: { rating: null },
      _count: { _all: 0 },
    } as never)
    const res = await GET(createRequest())
    const body = await res.json()
    expect(body.todayBookings).toEqual([])
    expect(body.todayBookingCount).toBe(0)
    expect(body.upcomingBookingCount).toBe(0)
    expect(body.pendingBookingCount).toBe(0)
  })

  // Error handling
  it("returns 500 on unexpected error", async () => {
    mockFindProvider.mockRejectedValue(new Error("DB error"))
    const res = await GET(createRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Internt serverfel")
  })
})
