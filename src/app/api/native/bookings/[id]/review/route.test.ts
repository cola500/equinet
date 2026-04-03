/**
 * POST /api/native/bookings/[id]/review tests
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
    booking: { findUnique: vi.fn() },
    customerReview: { create: vi.fn() },
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

import { POST } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"

const mockAuth = vi.mocked(getAuthUser)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockFindBooking = vi.mocked(prisma.booking.findUnique)
const mockCreateReview = vi.mocked(prisma.customerReview.create)
const mockRateLimit = vi.mocked(rateLimiters.api)

function createRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/native/bookings/booking-1/review", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-jwt-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

const mockProvider = { id: "provider-1" }

const mockBookingData = {
  id: "booking-1",
  customerId: "customer-1",
  providerId: "provider-1",
  status: "completed",
  customerReview: null,
}

const params = Promise.resolve({ id: "booking-1" })

describe("POST /api/native/bookings/[id]/review", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "bearer" as const })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockFindBooking.mockResolvedValue(mockBookingData as never)
    mockRateLimit.mockResolvedValue(true)
    mockCreateReview.mockResolvedValue({
      id: "review-1",
      rating: 4,
      comment: "Bra kund",
    } as never)
  })

  it("returns 401 when Bearer token is missing", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(createRequest({ rating: 4 }), { params })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Ej inloggad")
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await POST(createRequest({ rating: 4 }), { params })
    expect(res.status).toBe(429)
  })

  it("returns 503 when rate limiter fails", async () => {
    mockRateLimit.mockRejectedValue(new RateLimitServiceError("Redis error"))
    const res = await POST(createRequest({ rating: 4 }), { params })
    expect(res.status).toBe(503)
  })

  it("returns 404 when provider not found", async () => {
    mockFindProvider.mockResolvedValue(null)
    const res = await POST(createRequest({ rating: 4 }), { params })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Leverantör hittades inte")
  })

  it("returns 400 for invalid rating (0)", async () => {
    const res = await POST(createRequest({ rating: 0 }), { params })
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid rating (6)", async () => {
    const res = await POST(createRequest({ rating: 6 }), { params })
    expect(res.status).toBe(400)
  })

  it("returns 400 for float rating", async () => {
    const res = await POST(createRequest({ rating: 3.5 }), { params })
    expect(res.status).toBe(400)
  })

  it("returns 404 when booking not found", async () => {
    mockFindBooking.mockResolvedValue(null)
    const res = await POST(createRequest({ rating: 4 }), { params })
    expect(res.status).toBe(404)
  })

  it("returns 403 when booking belongs to another provider", async () => {
    mockFindBooking.mockResolvedValue({
      ...mockBookingData,
      providerId: "other-provider",
    } as never)
    const res = await POST(createRequest({ rating: 4 }), { params })
    expect(res.status).toBe(403)
  })

  it("returns 400 when booking is not completed", async () => {
    mockFindBooking.mockResolvedValue({
      ...mockBookingData,
      status: "confirmed",
    } as never)
    const res = await POST(createRequest({ rating: 4 }), { params })
    expect(res.status).toBe(400)
  })

  it("returns 409 when review already exists", async () => {
    mockFindBooking.mockResolvedValue({
      ...mockBookingData,
      customerReview: { id: "existing-review" },
    } as never)
    const res = await POST(createRequest({ rating: 4 }), { params })
    expect(res.status).toBe(409)
  })

  it("creates review successfully with comment", async () => {
    const res = await POST(createRequest({ rating: 4, comment: "Bra kund" }), { params })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe("review-1")
    expect(body.rating).toBe(4)
    expect(body.comment).toBe("Bra kund")
  })

  it("creates review successfully without comment", async () => {
    mockCreateReview.mockResolvedValue({
      id: "review-2",
      rating: 5,
      comment: null,
    } as never)
    const res = await POST(createRequest({ rating: 5 }), { params })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.rating).toBe(5)
    expect(body.comment).toBeNull()
  })

  it("returns 500 on unexpected error", async () => {
    mockCreateReview.mockRejectedValue(new Error("DB error"))
    const res = await POST(createRequest({ rating: 4 }), { params })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Kunde inte skapa kundrecension")
  })
})
