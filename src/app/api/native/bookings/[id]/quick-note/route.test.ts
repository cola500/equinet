/**
 * POST /api/native/bookings/[id]/quick-note tests
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
    booking: { findUnique: vi.fn(), update: vi.fn() },
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
import { authFromMobileToken } from "@/lib/mobile-auth"
import { prisma } from "@/lib/prisma"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"

const mockAuth = vi.mocked(authFromMobileToken)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockFindBooking = vi.mocked(prisma.booking.findUnique)
const mockUpdateBooking = vi.mocked(prisma.booking.update)
const mockRateLimit = vi.mocked(rateLimiters.api)

function createRequest(body: Record<string, unknown> | string = { providerNotes: "Bra häst" }) {
  return new NextRequest("http://localhost:3000/api/native/bookings/booking-1/quick-note", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-jwt-token",
      "Content-Type": "application/json",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const mockProvider = { id: "provider-1" }

const mockBookingData = {
  id: "booking-1",
  providerId: "provider-1",
  status: "confirmed",
}

const params = Promise.resolve({ id: "booking-1" })

describe("POST /api/native/bookings/[id]/quick-note", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: "user-1", tokenId: "token-1" })
    mockFindProvider.mockResolvedValue(mockProvider as never)
    mockFindBooking.mockResolvedValue(mockBookingData as never)
    mockRateLimit.mockResolvedValue(true)
    mockUpdateBooking.mockResolvedValue({ providerNotes: "Bra häst" } as never)
  })

  it("returns 401 when Bearer token is missing", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(createRequest(), { params })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Ej inloggad")
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await POST(createRequest(), { params })
    expect(res.status).toBe(429)
  })

  it("returns 503 when rate limiter fails", async () => {
    mockRateLimit.mockRejectedValue(new RateLimitServiceError("Redis error"))
    const res = await POST(createRequest(), { params })
    expect(res.status).toBe(503)
  })

  it("returns 404 when provider not found", async () => {
    mockFindProvider.mockResolvedValue(null)
    const res = await POST(createRequest(), { params })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Leverantör hittades inte")
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/native/bookings/booking-1/quick-note", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-jwt-token",
        "Content-Type": "application/json",
      },
      body: "not json",
    })
    const res = await POST(req, { params })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Ogiltig JSON")
  })

  it("returns 400 for empty providerNotes", async () => {
    const res = await POST(createRequest({ providerNotes: "   " }), { params })
    expect(res.status).toBe(400)
  })

  it("returns 400 for providerNotes exceeding 2000 chars", async () => {
    const res = await POST(createRequest({ providerNotes: "x".repeat(2001) }), { params })
    expect(res.status).toBe(400)
  })

  it("returns 400 for unknown fields (strict)", async () => {
    const res = await POST(createRequest({ providerNotes: "OK", extra: true }), { params })
    expect(res.status).toBe(400)
  })

  it("returns 404 when booking not found", async () => {
    mockFindBooking.mockResolvedValue(null)
    const res = await POST(createRequest(), { params })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Bokning hittades inte")
  })

  it("returns 403 when booking belongs to another provider", async () => {
    mockFindBooking.mockResolvedValue({
      ...mockBookingData,
      providerId: "other-provider",
    } as never)
    const res = await POST(createRequest(), { params })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("Åtkomst nekad")
  })

  it("returns 400 when booking status is pending", async () => {
    mockFindBooking.mockResolvedValue({
      ...mockBookingData,
      status: "pending",
    } as never)
    const res = await POST(createRequest(), { params })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Anteckningar kan bara läggas till på bekräftade eller genomförda bokningar")
  })

  it("returns 400 when booking status is cancelled", async () => {
    mockFindBooking.mockResolvedValue({
      ...mockBookingData,
      status: "cancelled",
    } as never)
    const res = await POST(createRequest(), { params })
    expect(res.status).toBe(400)
  })

  it("saves quick note on confirmed booking", async () => {
    const res = await POST(createRequest({ providerNotes: "Bra häst" }), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.providerNotes).toBe("Bra häst")
    expect(mockUpdateBooking).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: { providerNotes: "Bra häst" },
      select: { providerNotes: true },
    })
  })

  it("saves quick note on completed booking", async () => {
    mockFindBooking.mockResolvedValue({
      ...mockBookingData,
      status: "completed",
    } as never)
    const res = await POST(createRequest({ providerNotes: "Genomförd utan problem" }), { params })
    expect(res.status).toBe(200)
  })

  it("returns 500 on unexpected error", async () => {
    mockUpdateBooking.mockRejectedValue(new Error("DB error"))
    const res = await POST(createRequest(), { params })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Kunde inte spara anteckning")
  })
})
