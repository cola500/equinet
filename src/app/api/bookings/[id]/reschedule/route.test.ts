import { describe, it, expect, beforeEach, vi } from "vitest"
import { PATCH } from "./route"
import { NextRequest } from "next/server"

// Top-level imports for mocked modules
import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { mapBookingErrorToStatus, mapBookingErrorToMessage } from "@/domain/booking"

const mockSession = {
  user: {
    id: "customer-1",
    email: "customer@test.se",
    userType: "customer",
  },
}

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    booking: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    security: vi.fn(),
  },
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findUnique: vi.fn().mockResolvedValue({
        bookingDate: new Date("2026-03-10"),
        startTime: "10:00",
        provider: { rescheduleRequiresApproval: false },
      }),
    },
  },
}))

vi.mock("@/lib/email", () => ({
  sendBookingRescheduleNotification: vi.fn().mockResolvedValue({ success: true }),
}))

const mockRescheduleBooking = vi.fn()

vi.mock("@/domain/booking", () => ({
  createBookingService: vi.fn().mockReturnValue({
    rescheduleBooking: (...args: unknown[]) => mockRescheduleBooking(...args),
  }),
  mapBookingErrorToStatus: vi.fn().mockReturnValue(400),
  mapBookingErrorToMessage: vi.fn().mockReturnValue("Felmeddelande"),
}))

function makeRequest(body?: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/bookings/booking-1/reschedule", {
    method: "PATCH",
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

const validBody = {
  bookingDate: "2026-03-15",
  startTime: "14:00",
}

describe("PATCH /api/bookings/[id]/reschedule", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession as any)
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    vi.mocked(rateLimiters.booking).mockResolvedValue(true)

    mockRescheduleBooking.mockResolvedValue({
      isSuccess: true,
      isFailure: false,
      value: {
        id: "booking-1",
        customerId: "customer-1",
        providerId: "provider-1",
        serviceId: "service-1",
        bookingDate: "2026-03-15",
        startTime: "14:00",
        endTime: "15:00",
        status: "confirmed",
        rescheduleCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
  })

  it("should reschedule booking successfully", async () => {
    const request = makeRequest(validBody)
    const response = await PATCH(request, { params: Promise.resolve({ id: "booking-1" }) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.id).toBe("booking-1")
    expect(data.rescheduleCount).toBe(1)
  })

  it("should call rescheduleBooking with correct params", async () => {
    const request = makeRequest(validBody)
    await PATCH(request, { params: Promise.resolve({ id: "booking-1" }) })

    expect(mockRescheduleBooking).toHaveBeenCalledWith({
      bookingId: "booking-1",
      customerId: "customer-1",
      newBookingDate: "2026-03-15",
      newStartTime: "14:00",
    })
  })

  it("should return 403 for provider users", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "provider-1", email: "provider@test.se", userType: "provider" },
    } as any)

    const request = makeRequest(validBody)
    const response = await PATCH(request, { params: Promise.resolve({ id: "booking-1" }) })

    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBe("Åtkomst nekad")
  })

  it("returns 404 when self_reschedule feature flag is disabled", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false)

    const request = makeRequest(validBody)
    const response = await PATCH(request, { params: Promise.resolve({ id: "booking-1" }) })

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe("Ej tillgänglig")
  })

  it("should return 429 when rate limited", async () => {
    vi.mocked(rateLimiters.booking).mockResolvedValue(false)

    const request = makeRequest(validBody)
    const response = await PATCH(request, { params: Promise.resolve({ id: "booking-1" }) })

    expect(response.status).toBe(429)
  })

  it("should return 400 for invalid JSON", async () => {
    const request = new NextRequest("http://localhost:3000/api/bookings/booking-1/reschedule", {
      method: "PATCH",
      body: "not json",
    })
    const response = await PATCH(request, { params: Promise.resolve({ id: "booking-1" }) })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Ogiltig JSON")
  })

  it("should return 400 for invalid date format", async () => {
    const request = makeRequest({ bookingDate: "15-03-2026", startTime: "14:00" })
    const response = await PATCH(request, { params: Promise.resolve({ id: "booking-1" }) })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Valideringsfel")
  })

  it("should return 400 for invalid time format", async () => {
    const request = makeRequest({ bookingDate: "2026-03-15", startTime: "2pm" })
    const response = await PATCH(request, { params: Promise.resolve({ id: "booking-1" }) })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe("Valideringsfel")
  })

  it("should reject extra fields (.strict())", async () => {
    const request = makeRequest({ ...validBody, extraField: "hack" })
    const response = await PATCH(request, { params: Promise.resolve({ id: "booking-1" }) })

    expect(response.status).toBe(400)
  })

  it("should return domain error when reschedule fails", async () => {
    mockRescheduleBooking.mockResolvedValue({
      isSuccess: false,
      isFailure: true,
      error: { type: "RESCHEDULE_DISABLED" },
    })

    vi.mocked(mapBookingErrorToStatus).mockReturnValue(403)
    vi.mocked(mapBookingErrorToMessage).mockReturnValue("Ombokning är inte tillåten för denna leverantör")

    const request = makeRequest(validBody)
    const response = await PATCH(request, { params: Promise.resolve({ id: "booking-1" }) })

    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBe("Ombokning är inte tillåten för denna leverantör")
  })
})
