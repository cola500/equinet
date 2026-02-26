import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
import { NextRequest } from "next/server"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { isFeatureEnabled } from "@/lib/feature-flags"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bookingSeries: {
      findUnique: vi.fn(),
    },
  },
}))

const CUSTOMER_SESSION = {
  user: {
    id: "customer-1",
    email: "customer@test.se",
    userType: "customer",
  },
} as never

const PROVIDER_SESSION = {
  user: {
    id: "provider-user-1",
    email: "provider@test.se",
    userType: "provider",
    providerId: "provider-1",
  },
} as never

function makeRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/booking-series/${id}`)
}

const mockSeries = {
  id: "series-1",
  customerId: "customer-1",
  providerId: "provider-1",
  serviceId: "service-1",
  horseId: null,
  intervalWeeks: 2,
  totalOccurrences: 4,
  createdCount: 4,
  startTime: "10:00",
  status: "active",
  cancelledAt: null,
  createdAt: new Date("2026-03-01"),
  service: { name: "Hovvård", price: 800, durationMinutes: 60 },
  bookings: [
    { id: "b1", bookingDate: new Date("2026-04-01"), startTime: "10:00", endTime: "11:00", status: "confirmed" },
    { id: "b2", bookingDate: new Date("2026-04-15"), startTime: "10:00", endTime: "11:00", status: "confirmed" },
  ],
}

describe("GET /api/booking-series/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    vi.mocked(auth).mockResolvedValue(CUSTOMER_SESSION)
    vi.mocked(prisma.bookingSeries.findUnique).mockResolvedValue(mockSeries as never)
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    const res = await GET(makeRequest("series-1"), { params: Promise.resolve({ id: "series-1" }) })
    expect(res.status).toBe(401)
  })

  it("returns 404 when recurring_bookings feature flag is disabled", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false)
    const res = await GET(makeRequest("series-1"), { params: Promise.resolve({ id: "series-1" }) })
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBe("Ej tillgänglig")
  })

  it("returns 429 when rate limited", async () => {
    const { rateLimiters } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)
    const res = await GET(makeRequest("series-1"), { params: Promise.resolve({ id: "series-1" }) })
    expect(res.status).toBe(429)
  })

  it("returns 404 when series not found", async () => {
    vi.mocked(prisma.bookingSeries.findUnique).mockResolvedValue(null)
    const res = await GET(makeRequest("nonexistent"), { params: Promise.resolve({ id: "nonexistent" }) })
    expect(res.status).toBe(404)
  })

  it("returns 403 when user is not owner", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "other-user", userType: "customer" },
    } as never)
    const res = await GET(makeRequest("series-1"), { params: Promise.resolve({ id: "series-1" }) })
    expect(res.status).toBe(403)
  })

  it("returns series for customer owner", async () => {
    const res = await GET(makeRequest("series-1"), { params: Promise.resolve({ id: "series-1" }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.id).toBe("series-1")
    expect(data.bookings).toHaveLength(2)
  })

  it("returns series for provider owner", async () => {
    vi.mocked(auth).mockResolvedValue(PROVIDER_SESSION)
    const res = await GET(makeRequest("series-1"), { params: Promise.resolve({ id: "series-1" }) })
    expect(res.status).toBe(200)
  })
})
