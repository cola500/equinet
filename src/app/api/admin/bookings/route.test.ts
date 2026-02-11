import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET, PATCH } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
  },
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
    security: vi.fn(),
  },
}))

const mockAdminSession = {
  user: { id: "admin-1", email: "admin@test.se" },
} as any

describe("GET /api/admin/bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockAdminSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      isAdmin: true,
    } as any)
  })

  it("should return paginated booking list", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        id: "booking-1",
        bookingDate: new Date("2026-02-15"),
        startTime: "10:00",
        endTime: "11:00",
        status: "confirmed",
        isManualBooking: false,
        customer: { firstName: "Anna", lastName: "Svensson" },
        provider: { businessName: "Hästkliniken" },
        service: { name: "Hovvård" },
      },
    ] as any)
    vi.mocked(prisma.booking.count).mockResolvedValue(1)

    const request = new NextRequest("http://localhost:3000/api/admin/bookings")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.bookings).toHaveLength(1)
    expect(data.bookings[0]).toMatchObject({
      id: "booking-1",
      status: "confirmed",
      customerName: "Anna Svensson",
      providerBusinessName: "Hästkliniken",
      serviceName: "Hovvård",
    })
    expect(data.total).toBe(1)
    expect(data.page).toBe(1)
  })

  it("should filter by status", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])
    vi.mocked(prisma.booking.count).mockResolvedValue(0)

    const request = new NextRequest("http://localhost:3000/api/admin/bookings?status=pending")
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "pending",
        }),
      })
    )
  })

  it("should filter by date range", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])
    vi.mocked(prisma.booking.count).mockResolvedValue(0)

    const request = new NextRequest(
      "http://localhost:3000/api/admin/bookings?from=2026-02-01&to=2026-02-28"
    )
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bookingDate: {
            gte: new Date("2026-02-01"),
            lte: new Date("2026-02-28"),
          },
        }),
      })
    )
  })

  it("should paginate correctly", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])
    vi.mocked(prisma.booking.count).mockResolvedValue(100)

    const request = new NextRequest("http://localhost:3000/api/admin/bookings?page=3&limit=10")
    const response = await GET(request)
    const data = await response.json()

    expect(data.page).toBe(3)
    expect(data.totalPages).toBe(10)
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    )
  })

  it("should return 403 for non-admin users", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      isAdmin: false,
    } as any)

    const request = new NextRequest("http://localhost:3000/api/admin/bookings")
    const response = await GET(request)

    expect(response.status).toBe(403)
  })

  it("should return 429 when rate limited", async () => {
    const { rateLimiters } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

    const request = new NextRequest("http://localhost:3000/api/admin/bookings")
    const response = await GET(request)

    expect(response.status).toBe(429)
  })
})

// ============================================================
// PATCH /api/admin/bookings -- Cancel booking as admin
// ============================================================

const ADMIN_UUID = "a0000000-0000-4000-a000-000000000001"
const BOOKING_UUID = "a0000000-0000-4000-a000-000000000010"
const CUSTOMER_UUID = "a0000000-0000-4000-a000-000000000020"
const PROVIDER_USER_UUID = "a0000000-0000-4000-a000-000000000030"

const mockAdminSessionPatch = {
  user: { id: ADMIN_UUID, email: "admin@test.se" },
} as any

describe("PATCH /api/admin/bookings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockAdminSessionPatch)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: ADMIN_UUID,
      isAdmin: true,
    } as any)
  })

  function makePatchRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost:3000/api/admin/bookings", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("should cancel a pending booking", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      id: BOOKING_UUID,
      status: "pending",
      customerId: CUSTOMER_UUID,
      provider: { userId: PROVIDER_USER_UUID },
    } as any)
    vi.mocked(prisma.booking.update).mockResolvedValue({
      id: BOOKING_UUID,
      status: "cancelled",
      cancellationMessage: "[Admin] Test-anledning",
    } as any)
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 2 })

    const response = await PATCH(makePatchRequest({
      bookingId: BOOKING_UUID,
      action: "cancel",
      reason: "Test-anledning",
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe("cancelled")
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BOOKING_UUID },
        data: expect.objectContaining({
          status: "cancelled",
          cancellationMessage: "[Admin] Test-anledning",
        }),
      })
    )
  })

  it("should cancel a confirmed booking", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      id: BOOKING_UUID,
      status: "confirmed",
      customerId: CUSTOMER_UUID,
      provider: { userId: PROVIDER_USER_UUID },
    } as any)
    vi.mocked(prisma.booking.update).mockResolvedValue({
      id: BOOKING_UUID,
      status: "cancelled",
    } as any)
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 2 })

    const response = await PATCH(makePatchRequest({
      bookingId: BOOKING_UUID,
      action: "cancel",
      reason: "Tvist mellan parter",
    }))

    expect(response.status).toBe(200)
  })

  it("should create notifications for both customer and provider", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      id: BOOKING_UUID,
      status: "pending",
      customerId: CUSTOMER_UUID,
      provider: { userId: PROVIDER_USER_UUID },
    } as any)
    vi.mocked(prisma.booking.update).mockResolvedValue({
      id: BOOKING_UUID,
      status: "cancelled",
    } as any)
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 2 })

    await PATCH(makePatchRequest({
      bookingId: BOOKING_UUID,
      action: "cancel",
      reason: "Admin-avbokning",
    }))

    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: CUSTOMER_UUID }),
        expect.objectContaining({ userId: PROVIDER_USER_UUID }),
      ]),
    })
  })

  it("should not cancel an already cancelled booking", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      id: BOOKING_UUID,
      status: "cancelled",
      customerId: CUSTOMER_UUID,
      provider: { userId: PROVIDER_USER_UUID },
    } as any)

    const response = await PATCH(makePatchRequest({
      bookingId: BOOKING_UUID,
      action: "cancel",
      reason: "Ska inte gå",
    }))

    expect(response.status).toBe(400)
  })

  it("should not cancel a completed booking", async () => {
    vi.mocked(prisma.booking.findUnique).mockResolvedValue({
      id: BOOKING_UUID,
      status: "completed",
      customerId: CUSTOMER_UUID,
      provider: { userId: PROVIDER_USER_UUID },
    } as any)

    const response = await PATCH(makePatchRequest({
      bookingId: BOOKING_UUID,
      action: "cancel",
      reason: "Ska inte gå",
    }))

    expect(response.status).toBe(400)
  })

  it("should require reason", async () => {
    const response = await PATCH(makePatchRequest({
      bookingId: BOOKING_UUID,
      action: "cancel",
    }))

    expect(response.status).toBe(400)
  })

  it("should return 403 for non-admin", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: ADMIN_UUID,
      isAdmin: false,
    } as any)

    const response = await PATCH(makePatchRequest({
      bookingId: BOOKING_UUID,
      action: "cancel",
      reason: "Test",
    }))

    expect(response.status).toBe(403)
  })

  it("should return 429 when rate limited", async () => {
    const { rateLimiters } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

    const response = await PATCH(makePatchRequest({
      bookingId: BOOKING_UUID,
      action: "cancel",
      reason: "Test",
    }))

    expect(response.status).toBe(429)
  })
})
