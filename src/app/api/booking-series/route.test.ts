import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST } from "./route"
import { NextRequest } from "next/server"
import { auth } from "@/lib/auth-server"
import { isFeatureEnabled } from "@/lib/feature-flags"

// Mock dependencies
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

const mockCreateSeries = vi.fn()
vi.mock("@/domain/booking/BookingSeriesService", () => ({
  BookingSeriesService: class MockBookingSeriesService {
    createSeries = mockCreateSeries
  },
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: {
      findUnique: vi.fn().mockResolvedValue({
        id: "a0000000-0000-4000-a000-000000000001",
        userId: "provider-user-1",
        isActive: true,
        recurringEnabled: true,
        maxSeriesOccurrences: 12,
      }),
    },
    service: {
      findUnique: vi.fn().mockResolvedValue({
        id: "a0000000-0000-4000-a000-000000000003",
        providerId: "a0000000-0000-4000-a000-000000000001",
        durationMinutes: 60,
        isActive: true,
      }),
    },
    bookingSeries: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    availabilityException: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/infrastructure/persistence/booking/PrismaBookingRepository", () => ({
  PrismaBookingRepository: class MockPrismaBookingRepository {},
}))

vi.mock("@/domain/booking/BookingService", () => ({
  BookingService: class MockBookingService {},
}))

vi.mock("@/domain/booking/TravelTimeService", () => ({
  TravelTimeService: class MockTravelTimeService {},
}))

const CUSTOMER_SESSION = {
  user: {
    id: "a0000000-0000-4000-a000-000000000002",
    email: "customer@test.se",
    userType: "customer",
  },
} as any

const PROVIDER_SESSION = {
  user: {
    id: "provider-user-1",
    email: "provider@test.se",
    userType: "provider",
    providerId: "a0000000-0000-4000-a000-000000000001",
  },
} as any

function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost:3000/api/booking-series", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

const validBody = {
  providerId: "a0000000-0000-4000-a000-000000000001",
  serviceId: "a0000000-0000-4000-a000-000000000003",
  firstBookingDate: "2026-05-01",
  startTime: "10:00",
  intervalWeeks: 2,
  totalOccurrences: 4,
}

describe("POST /api/booking-series", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    vi.mocked(auth).mockResolvedValue(CUSTOMER_SESSION)
    mockCreateSeries.mockResolvedValue({
      isSuccess: true,
      value: {
        series: {
          id: "series-1",
          intervalWeeks: 2,
          totalOccurrences: 4,
          createdCount: 4,
          status: "active",
        },
        createdBookings: [{ id: "b1" }, { id: "b2" }, { id: "b3" }, { id: "b4" }],
        skippedDates: [],
      },
    })
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it("returns 404 when recurring_bookings feature flag is disabled", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBe("Ej tillgänglig")
  })

  it("returns 429 when rate limited", async () => {
    const { rateLimiters } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.booking).mockResolvedValueOnce(false)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(429)
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/booking-series", {
      method: "POST",
      body: "not-json",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("Ogiltig JSON")
  })

  it("returns 400 for invalid fields", async () => {
    const res = await POST(makeRequest({ ...validBody, intervalWeeks: "not-a-number" }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe("Valideringsfel")
  })

  it("returns 400 for unknown fields (.strict)", async () => {
    const res = await POST(makeRequest({ ...validBody, unknownField: true }))
    expect(res.status).toBe(400)
  })

  it("returns 400 for missing required fields", async () => {
    const { providerId: _providerId, ...incomplete } = validBody
    const res = await POST(makeRequest(incomplete))
    expect(res.status).toBe(400)
  })

  it("returns 201 on happy path as customer", async () => {
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.series.id).toBe("series-1")
    expect(data.createdBookings).toHaveLength(4)
    expect(data.skippedDates).toHaveLength(0)
  })

  it("passes customerId from session, not from body", async () => {
    await POST(makeRequest(validBody))
    expect(mockCreateSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "a0000000-0000-4000-a000-000000000002",
      })
    )
  })

  it("returns 201 on happy path as provider (manual)", async () => {
    vi.mocked(auth).mockResolvedValue(PROVIDER_SESSION)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(201)
    expect(mockCreateSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        isManualBooking: true,
        createdByProviderId: "a0000000-0000-4000-a000-000000000001",
      })
    )
  })

  it("returns mapped error from service", async () => {
    mockCreateSeries.mockResolvedValue({
      isSuccess: false,
      isFailure: true,
      error: { type: "RECURRING_FEATURE_OFF" },
    })
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  it("includes skipped dates in response", async () => {
    mockCreateSeries.mockResolvedValue({
      isSuccess: true,
      value: {
        series: { id: "s1", intervalWeeks: 2, totalOccurrences: 4, createdCount: 3, status: "active" },
        createdBookings: [{ id: "b1" }, { id: "b2" }, { id: "b3" }],
        skippedDates: [{ date: "2026-06-01", reason: "Overlap" }],
      },
    })
    const res = await POST(makeRequest(validBody))
    const data = await res.json()
    expect(data.skippedDates).toHaveLength(1)
    expect(data.skippedDates[0].date).toBe("2026-06-01")
  })

  it("accepts optional horse fields", async () => {
    const bodyWithHorse = {
      ...validBody,
      horseId: "a0000000-0000-4000-a000-000000000004",
      horseName: "Blansen",
      horseInfo: "Känsliga hovar",
    }
    const res = await POST(makeRequest(bodyWithHorse))
    expect(res.status).toBe(201)
    expect(mockCreateSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        horseId: "a0000000-0000-4000-a000-000000000004",
        horseName: "Blansen",
      })
    )
  })
})
