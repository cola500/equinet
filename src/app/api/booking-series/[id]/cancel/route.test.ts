import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST } from "./route"
import { NextRequest } from "next/server"
import { auth } from "@/lib/auth-server"

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
  },
}))

const mockCancelSeries = vi.fn()
vi.mock("@/domain/booking/BookingSeriesService", () => ({
  BookingSeriesService: class MockBookingSeriesService {
    cancelSeries = mockCancelSeries
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bookingSeries: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    provider: {
      findUnique: vi.fn(),
    },
    service: {
      findUnique: vi.fn(),
    },
    availabilityException: {
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

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

const CUSTOMER_SESSION = {
  user: {
    id: "customer-1",
    email: "customer@test.se",
    userType: "customer",
  },
} as any

const PROVIDER_SESSION = {
  user: {
    id: "provider-user-1",
    email: "provider@test.se",
    userType: "provider",
    providerId: "provider-1",
  },
} as any

function makeRequest(id: string, body?: object): NextRequest {
  return new NextRequest(`http://localhost:3000/api/booking-series/${id}/cancel`, {
    method: "POST",
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe("POST /api/booking-series/[id]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(CUSTOMER_SESSION)
    mockCancelSeries.mockResolvedValue({
      isSuccess: true,
      value: { cancelledCount: 3 },
    })
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as any)
    const res = await POST(makeRequest("series-1"), { params: Promise.resolve({ id: "series-1" }) })
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    const { rateLimiters } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.booking).mockResolvedValueOnce(false)
    const res = await POST(makeRequest("series-1"), { params: Promise.resolve({ id: "series-1" }) })
    expect(res.status).toBe(429)
  })

  it("returns 200 with cancelled count on success", async () => {
    const res = await POST(makeRequest("series-1"), { params: Promise.resolve({ id: "series-1" }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.cancelledCount).toBe(3)
  })

  it("passes customerId for customer actor", async () => {
    await POST(makeRequest("series-1"), { params: Promise.resolve({ id: "series-1" }) })
    expect(mockCancelSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        seriesId: "series-1",
        actorCustomerId: "customer-1",
      })
    )
  })

  it("passes providerId for provider actor", async () => {
    vi.mocked(auth).mockResolvedValue(PROVIDER_SESSION)
    await POST(makeRequest("series-1"), { params: Promise.resolve({ id: "series-1" }) })
    expect(mockCancelSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        seriesId: "series-1",
        actorProviderId: "provider-1",
      })
    )
  })

  it("returns 404 when series not found", async () => {
    mockCancelSeries.mockResolvedValue({
      isSuccess: false,
      isFailure: true,
      error: { type: "SERIES_NOT_FOUND" },
    })
    const res = await POST(makeRequest("series-1"), { params: Promise.resolve({ id: "series-1" }) })
    expect(res.status).toBe(404)
  })

  it("returns 403 when not owner", async () => {
    mockCancelSeries.mockResolvedValue({
      isSuccess: false,
      isFailure: true,
      error: { type: "NOT_OWNER" },
    })
    const res = await POST(makeRequest("series-1"), { params: Promise.resolve({ id: "series-1" }) })
    expect(res.status).toBe(403)
  })

  it("passes cancellationMessage from body", async () => {
    const res = await POST(
      makeRequest("series-1", { cancellationMessage: "Ändrade planer" }),
      { params: Promise.resolve({ id: "series-1" }) }
    )
    expect(res.status).toBe(200)
    expect(mockCancelSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        cancellationMessage: "Ändrade planer",
      })
    )
  })
})
