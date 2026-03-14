/**
 * GET /api/native/bookings tests
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
const mockRateLimit = vi.mocked(rateLimiters.api)

function createRequest(params?: { status?: string }) {
  const url = new URL("http://localhost:3000/api/native/bookings")
  if (params?.status) url.searchParams.set("status", params.status)
  return new NextRequest(url, {
    method: "GET",
    headers: { Authorization: "Bearer valid-jwt-token" },
  })
}

const mockProvider = { id: "provider-1" }

const mockBooking = {
  id: "booking-1",
  bookingDate: new Date("2026-03-14"),
  startTime: "10:00",
  endTime: "11:00",
  status: "pending",
  horseName: "Blansen",
  customerNotes: "Var snäll",
  providerNotes: null,
  cancellationMessage: null,
  isManualBooking: false,
  bookingSeriesId: null,
  customer: { firstName: "Anna", lastName: "Andersson", email: "anna@example.com", phone: "070-1234567" },
  service: { name: "Ridlektion", price: 450 },
  horse: { id: "horse-1", breed: "Halvblod" },
  payment: null,
  customerReview: null,
}

describe("GET /api/native/bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: "user-1", tokenId: "token-1" })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockFindBookings.mockResolvedValue([mockBooking] as never)
    mockRateLimit.mockResolvedValue(true)
  })

  it("returns 401 when Bearer token is missing", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(createRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Ej inloggad")
  })

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

  it("returns 404 when provider not found", async () => {
    mockFindProvider.mockResolvedValue(null)
    const res = await GET(createRequest())
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Leverantör hittades inte")
  })

  it("returns 400 for invalid status query param", async () => {
    const res = await GET(createRequest({ status: "invalid" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Valideringsfel")
  })

  it("returns bookings with correct fields on success", async () => {
    const res = await GET(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toHaveLength(1)
    const b = body[0]
    expect(b.id).toBe("booking-1")
    expect(b.startTime).toBe("10:00")
    expect(b.endTime).toBe("11:00")
    expect(b.status).toBe("pending")
    expect(b.serviceName).toBe("Ridlektion")
    expect(b.servicePrice).toBe(450)
    expect(b.customerFirstName).toBe("Anna")
    expect(b.customerLastName).toBe("Andersson")
    expect(b.customerEmail).toBe("anna@example.com")
    expect(b.customerPhone).toBe("070-1234567")
    expect(b.horseName).toBe("Blansen")
    expect(b.horseId).toBe("horse-1")
    expect(b.horseBreed).toBe("Halvblod")
    expect(b.isPaid).toBe(false)
    expect(b.invoiceNumber).toBeNull()
    expect(b.isManualBooking).toBe(false)
    expect(b.bookingSeriesId).toBeNull()
    expect(b.customerNotes).toBe("Var snäll")
    expect(b.providerNotes).toBeNull()
    expect(b.cancellationMessage).toBeNull()
    expect(b.customerReview).toBeNull()
  })

  it("filters bookings by status query param", async () => {
    await GET(createRequest({ status: "pending" }))
    expect(mockFindBookings).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          providerId: "provider-1",
          status: "pending",
        }),
      })
    )
  })

  it("returns all bookings when no status filter", async () => {
    await GET(createRequest())
    expect(mockFindBookings).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerId: "provider-1" },
      })
    )
  })

  it("returns empty array when no bookings", async () => {
    mockFindBookings.mockResolvedValue([])
    const res = await GET(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it("includes customerReview when present", async () => {
    mockFindBookings.mockResolvedValue([{
      ...mockBooking,
      customerReview: { id: "review-1", rating: 4, comment: "Bra kund" },
    }] as never)
    const res = await GET(createRequest())
    const body = await res.json()
    expect(body[0].customerReview).toEqual({
      id: "review-1",
      rating: 4,
      comment: "Bra kund",
    })
  })

  it("returns isPaid true and invoiceNumber when payment exists", async () => {
    mockFindBookings.mockResolvedValue([{
      ...mockBooking,
      payment: { id: "pay-1", invoiceNumber: "INV-001" },
    }] as never)
    const res = await GET(createRequest())
    const body = await res.json()
    expect(body[0].isPaid).toBe(true)
    expect(body[0].invoiceNumber).toBe("INV-001")
  })

  it("returns horseId null when no horse", async () => {
    mockFindBookings.mockResolvedValue([{
      ...mockBooking,
      horse: null,
    }] as never)
    const res = await GET(createRequest())
    const body = await res.json()
    expect(body[0].horseId).toBeNull()
    expect(body[0].horseBreed).toBeNull()
  })

  it("returns 500 on unexpected error", async () => {
    mockFindBookings.mockRejectedValue(new Error("DB error"))
    const res = await GET(createRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Internt serverfel")
  })
})
