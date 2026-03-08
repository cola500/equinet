/**
 * GET /api/native/calendar tests
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
    booking: { findMany: vi.fn() },
    availability: { findMany: vi.fn() },
    availabilityException: { findMany: vi.fn() },
    provider: { findUnique: vi.fn() },
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
const mockFindBookings = vi.mocked(prisma.booking.findMany)
const mockFindAvailability = vi.mocked(prisma.availability.findMany)
const mockFindExceptions = vi.mocked(prisma.availabilityException.findMany)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockRateLimit = vi.mocked(rateLimiters.api)

function createRequest(params?: { from?: string; to?: string }) {
  const url = new URL("http://localhost:3000/api/native/calendar")
  if (params?.from) url.searchParams.set("from", params.from)
  if (params?.to) url.searchParams.set("to", params.to)
  return new NextRequest(url, {
    method: "GET",
    headers: { Authorization: "Bearer valid-jwt-token" },
  })
}

const mockProvider = { id: "provider-1" }

const mockBooking = {
  id: "booking-1",
  bookingDate: new Date("2026-03-10"),
  startTime: "10:00",
  endTime: "11:00",
  status: "confirmed",
  horseName: "Blansen",
  customer: { firstName: "Anna", lastName: "Andersson" },
  service: { name: "Hovslagare", price: 1500 },
  isManualBooking: false,
  payment: null,
}

const mockAvailability = {
  dayOfWeek: 1,
  startTime: "08:00",
  endTime: "17:00",
  isClosed: false,
}

const mockException = {
  date: new Date("2026-03-12"),
  isClosed: true,
  startTime: null,
  endTime: null,
  reason: "Semester",
}

describe("GET /api/native/calendar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: "user-1", tokenId: "token-1" })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockFindBookings.mockResolvedValue([mockBooking] as never)
    mockFindAvailability.mockResolvedValue([mockAvailability] as never)
    mockFindExceptions.mockResolvedValue([mockException] as never)
    mockRateLimit.mockResolvedValue(true)
  })

  // Auth
  it("returns 401 when Bearer token is missing", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(createRequest({ from: "2026-03-10", to: "2026-03-16" }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Ej inloggad")
  })

  // Rate limiting
  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await GET(createRequest({ from: "2026-03-10", to: "2026-03-16" }))
    expect(res.status).toBe(429)
  })

  it("returns 503 when rate limiter fails", async () => {
    mockRateLimit.mockRejectedValue(new RateLimitServiceError("Redis error"))
    const res = await GET(createRequest({ from: "2026-03-10", to: "2026-03-16" }))
    expect(res.status).toBe(503)
  })

  // Validation
  it("returns 400 when from param is missing", async () => {
    const res = await GET(createRequest({ to: "2026-03-16" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Valideringsfel")
  })

  it("returns 400 when to param is missing", async () => {
    const res = await GET(createRequest({ from: "2026-03-10" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Valideringsfel")
  })

  it("returns 400 when dates are invalid format", async () => {
    const res = await GET(createRequest({ from: "not-a-date", to: "2026-03-16" }))
    expect(res.status).toBe(400)
  })

  it("returns 400 when date range exceeds 31 days", async () => {
    const res = await GET(createRequest({ from: "2026-03-01", to: "2026-05-01" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Valideringsfel")
  })

  // Provider not found
  it("returns 404 when provider not found for user", async () => {
    mockFindProvider.mockResolvedValue(null)
    const res = await GET(createRequest({ from: "2026-03-10", to: "2026-03-16" }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Leverantör hittades inte")
  })

  // Success
  it("returns bookings, availability, and exceptions on success", async () => {
    const res = await GET(createRequest({ from: "2026-03-10", to: "2026-03-16" }))
    expect(res.status).toBe(200)
    const body = await res.json()

    // Bookings
    expect(body.bookings).toHaveLength(1)
    expect(body.bookings[0].id).toBe("booking-1")
    expect(body.bookings[0].startTime).toBe("10:00")
    expect(body.bookings[0].horseName).toBe("Blansen")
    expect(body.bookings[0].customerFirstName).toBe("Anna")
    expect(body.bookings[0].customerLastName).toBe("Andersson")
    expect(body.bookings[0].serviceName).toBe("Hovslagare")
    expect(body.bookings[0].servicePrice).toBe(1500)
    expect(body.bookings[0].isManualBooking).toBe(false)
    expect(body.bookings[0].isPaid).toBe(false)

    // Availability
    expect(body.availability).toHaveLength(1)
    expect(body.availability[0].dayOfWeek).toBe(1)

    // Exceptions
    expect(body.exceptions).toHaveLength(1)
    expect(body.exceptions[0].isClosed).toBe(true)
    expect(body.exceptions[0].reason).toBe("Semester")
  })

  it("returns empty arrays when no data exists", async () => {
    mockFindBookings.mockResolvedValue([])
    mockFindAvailability.mockResolvedValue([])
    mockFindExceptions.mockResolvedValue([])
    const res = await GET(createRequest({ from: "2026-03-10", to: "2026-03-16" }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.bookings).toEqual([])
    expect(body.availability).toEqual([])
    expect(body.exceptions).toEqual([])
  })

  it("queries bookings within the date range", async () => {
    await GET(createRequest({ from: "2026-03-10", to: "2026-03-16" }))
    expect(mockFindBookings).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          providerId: "provider-1",
          bookingDate: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        }),
        orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
      })
    )
  })

  it("returns isPaid true when booking has a payment", async () => {
    mockFindBookings.mockResolvedValue([
      { ...mockBooking, payment: { id: "pay-1" } },
    ] as never)
    const res = await GET(createRequest({ from: "2026-03-10", to: "2026-03-16" }))
    const body = await res.json()
    expect(body.bookings[0].isPaid).toBe(true)
  })

  it("returns 500 on unexpected error", async () => {
    mockFindBookings.mockRejectedValue(new Error("DB error"))
    const res = await GET(createRequest({ from: "2026-03-10", to: "2026-03-16" }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Internt serverfel")
  })
})
