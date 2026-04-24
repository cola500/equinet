import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, PATCH, PUT } from "./route"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    routeOrder: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    provider: {
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}))

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"

const mockedFindUnique = vi.mocked(prisma.routeOrder.findUnique)
const mockedUpdateMany = vi.mocked(prisma.routeOrder.updateMany)
const mockedUpdate = vi.mocked(prisma.routeOrder.update)
const mockedProviderFindUnique = vi.mocked(prisma.provider.findUnique)
const mockedBookingFindMany = vi.mocked(prisma.booking.findMany)
const mockedNotificationCreate = vi.mocked(prisma.notification.create)
const mockedAuth = vi.mocked(auth)
const mockedRateLimit = vi.mocked(rateLimiters.api)
const mockedIsFeatureEnabled = vi.mocked(isFeatureEnabled)

const ORDER_ID = "a0000000-0000-4000-a000-000000000001"
const PROVIDER_ID = "a0000000-0000-4000-a000-000000000002"
const USER_ID = "a0000000-0000-4000-a000-000000000003"
const OTHER_PROVIDER_ID = "a0000000-0000-4000-a000-000000000004"
const OTHER_USER_ID = "a0000000-0000-4000-a000-000000000005"

function makeRequest(method: string = "GET", body?: unknown) {
  const url = `http://localhost:3000/api/route-orders/${ORDER_ID}`
  if (method === "GET") {
    return new NextRequest(url)
  }
  return new NextRequest(url, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
  })
}

const params = Promise.resolve({ id: ORDER_ID })

function providerSession(userId = USER_ID) {
  return { user: { id: userId, userType: "provider" } } as never
}

function customerSession(userId = USER_ID) {
  return { user: { id: userId, userType: "customer" } } as never
}

describe("GET /api/route-orders/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedRateLimit.mockResolvedValue(true)
    mockedIsFeatureEnabled.mockResolvedValue(true)
  })

  it("returns 404 when route order not found", async () => {
    mockedFindUnique.mockResolvedValue(null)
    const res = await GET(makeRequest(), { params })
    expect(res.status).toBe(404)
  })

  it("uses select on routeStops to prevent data leakage", async () => {
    mockedFindUnique.mockResolvedValue({ id: "test" } as never)
    await GET(makeRequest(), { params })

    const call = mockedFindUnique.mock.calls[0][0]
    const select = (call as never).select
    expect(select.routeStops).toHaveProperty("select")
    const routeStopSelect = select.routeStops.select
    expect(routeStopSelect.problemNote).toBeFalsy()
    expect(routeStopSelect.actualArrival).toBeFalsy()
    expect(routeStopSelect.actualDeparture).toBeFalsy()
  })

  it("returns 429 when rate limited", async () => {
    mockedRateLimit.mockResolvedValue(false)
    const res = await GET(makeRequest(), { params })
    expect(res.status).toBe(429)
  })

  it("returns 404 when feature flag disabled", async () => {
    mockedIsFeatureEnabled.mockResolvedValue(false)
    const res = await GET(makeRequest(), { params })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Ej tillgänglig")
  })

  it("returns 200 with full route order data", async () => {
    const orderData = {
      id: ORDER_ID,
      serviceType: "hovslagare",
      address: "Testvägen 1",
      status: "open",
      provider: { id: PROVIDER_ID, businessName: "Test AB" },
      routeStops: [],
      bookings: [],
    }
    mockedFindUnique.mockResolvedValue(orderData as never)
    const res = await GET(makeRequest(), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(ORDER_ID)
    expect(body.serviceType).toBe("hovslagare")
  })

  it("returns 500 on database error", async () => {
    mockedFindUnique.mockRejectedValue(new Error("DB connection failed"))
    const res = await GET(makeRequest(), { params })
    expect(res.status).toBe(500)
  })
})

describe("PATCH /api/route-orders/[id] - Provider flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedRateLimit.mockResolvedValue(true)
    mockedIsFeatureEnabled.mockResolvedValue(true)
    mockedAuth.mockResolvedValue(providerSession())
    mockedProviderFindUnique.mockResolvedValue({ id: PROVIDER_ID } as never)
  })

  it("returns 200 when provider cancels own announcement", async () => {
    mockedUpdateMany.mockResolvedValue({ count: 1 } as never)
    const res = await PATCH(makeRequest("PATCH", { status: "cancelled" }), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.status).toBe("cancelled")
  })

  it("returns 403 when provider tries to cancel another providers announcement", async () => {
    mockedUpdateMany.mockResolvedValue({ count: 0 } as never)
    mockedFindUnique.mockResolvedValue({
      providerId: OTHER_PROVIDER_ID,
      status: "open",
    } as never)
    const res = await PATCH(makeRequest("PATCH", { status: "cancelled" }), { params })
    expect(res.status).toBe(403)
  })

  it("returns 400 when announcement is already cancelled", async () => {
    mockedUpdateMany.mockResolvedValue({ count: 0 } as never)
    mockedFindUnique.mockResolvedValue({
      providerId: PROVIDER_ID,
      status: "cancelled",
    } as never)
    const res = await PATCH(makeRequest("PATCH", { status: "cancelled" }), { params })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("redan avbruten")
  })

  it("returns 404 when announcement not found", async () => {
    mockedUpdateMany.mockResolvedValue({ count: 0 } as never)
    mockedFindUnique.mockResolvedValue(null)
    const res = await PATCH(makeRequest("PATCH", { status: "cancelled" }), { params })
    expect(res.status).toBe(404)
  })

  it("returns 429 when rate limited", async () => {
    mockedRateLimit.mockResolvedValue(false)
    const res = await PATCH(makeRequest("PATCH", { status: "cancelled" }), { params })
    expect(res.status).toBe(429)
  })

  it("returns 401 when not authenticated", async () => {
    mockedAuth.mockResolvedValue(null as never)
    const res = await PATCH(makeRequest("PATCH", { status: "cancelled" }), { params })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Ej inloggad")
  })
})

describe("PATCH /api/route-orders/[id] - Customer flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedRateLimit.mockResolvedValue(true)
    mockedIsFeatureEnabled.mockResolvedValue(true)
    mockedAuth.mockResolvedValue(customerSession())
  })

  it("returns 200 when customer cancels own order", async () => {
    mockedUpdateMany.mockResolvedValue({ count: 1 } as never)
    const res = await PATCH(makeRequest("PATCH", { status: "cancelled" }), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it("returns 403 when customer tries to cancel another customers order", async () => {
    mockedUpdateMany.mockResolvedValue({ count: 0 } as never)
    mockedFindUnique.mockResolvedValue({
      customerId: OTHER_USER_ID,
      status: "open",
    } as never)
    const res = await PATCH(makeRequest("PATCH", { status: "cancelled" }), { params })
    expect(res.status).toBe(403)
  })

  it("returns 400 when order is already cancelled", async () => {
    mockedUpdateMany.mockResolvedValue({ count: 0 } as never)
    mockedFindUnique.mockResolvedValue({
      customerId: USER_ID,
      status: "cancelled",
    } as never)
    const res = await PATCH(makeRequest("PATCH", { status: "cancelled" }), { params })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("redan avbokad")
  })

  it("returns 400 when completed order cannot be cancelled", async () => {
    mockedUpdateMany.mockResolvedValue({ count: 0 } as never)
    mockedFindUnique.mockResolvedValue({
      customerId: USER_ID,
      status: "completed",
    } as never)
    const res = await PATCH(makeRequest("PATCH", { status: "cancelled" }), { params })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("Kunde inte avboka")
  })

  it("returns 404 when order not found", async () => {
    mockedUpdateMany.mockResolvedValue({ count: 0 } as never)
    mockedFindUnique.mockResolvedValue(null)
    const res = await PATCH(makeRequest("PATCH", { status: "cancelled" }), { params })
    expect(res.status).toBe(404)
  })
})

describe("PATCH /api/route-orders/[id] - Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedRateLimit.mockResolvedValue(true)
    mockedIsFeatureEnabled.mockResolvedValue(true)
    mockedAuth.mockResolvedValue(providerSession())
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest(`http://localhost:3000/api/route-orders/${ORDER_ID}`, {
      method: "PATCH",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Ogiltig JSON")
  })

  it("returns 400 for invalid status value", async () => {
    const res = await PATCH(makeRequest("PATCH", { status: "open" }), { params })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Valideringsfel")
  })

  it("returns 404 when feature flag disabled", async () => {
    mockedIsFeatureEnabled.mockResolvedValue(false)
    const res = await PATCH(makeRequest("PATCH", { status: "cancelled" }), { params })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Ej tillgänglig")
  })
})

const CUSTOMER_ID = "a0000000-0000-4000-a000-000000000006"
const BOOKING_ID = "a0000000-0000-4000-a000-000000000007"

const existingRoute = {
  id: ORDER_ID,
  providerId: PROVIDER_ID,
  announcementType: "provider_announced",
  status: "open",
  dateFrom: new Date("2026-05-10"),
  dateTo: new Date("2026-05-11"),
  municipality: "Södermanland",
}

describe("PUT /api/route-orders/[id] - update route details", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedRateLimit.mockResolvedValue(true)
    mockedIsFeatureEnabled.mockResolvedValue(true)
    mockedAuth.mockResolvedValue(providerSession())
    mockedProviderFindUnique.mockResolvedValue({ id: PROVIDER_ID } as never)
    mockedFindUnique.mockResolvedValue(existingRoute as never)
    mockedUpdate.mockResolvedValue({ ...existingRoute, municipality: "Uppland" } as never)
    mockedBookingFindMany.mockResolvedValue([])
    mockedNotificationCreate.mockResolvedValue({} as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockedAuth.mockResolvedValue(null as never)
    const res = await PUT(makeRequest("PUT", { municipality: "Uppland" }), { params })
    expect(res.status).toBe(401)
  })

  it("returns 404 when feature flag disabled", async () => {
    mockedIsFeatureEnabled.mockResolvedValue(false)
    const res = await PUT(makeRequest("PUT", { municipality: "Uppland" }), { params })
    expect(res.status).toBe(404)
  })

  it("returns 404 when route order not found", async () => {
    mockedFindUnique.mockResolvedValue(null)
    const res = await PUT(makeRequest("PUT", { municipality: "Uppland" }), { params })
    expect(res.status).toBe(404)
  })

  it("returns 403 when provider does not own the route", async () => {
    mockedFindUnique.mockResolvedValue({ ...existingRoute, providerId: OTHER_PROVIDER_ID } as never)
    const res = await PUT(makeRequest("PUT", { municipality: "Uppland" }), { params })
    expect(res.status).toBe(403)
  })

  it("returns 200 when updating municipality", async () => {
    const res = await PUT(makeRequest("PUT", { municipality: "Uppland" }), { params })
    expect(res.status).toBe(200)
  })

  it("sends notifications to affected customers when municipality changes", async () => {
    mockedBookingFindMany.mockResolvedValue([
      { id: BOOKING_ID, customerId: CUSTOMER_ID, status: "confirmed" },
    ] as never)

    await PUT(makeRequest("PUT", { municipality: "Uppland" }), { params })

    // Allow fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 10))

    expect(mockedNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: CUSTOMER_ID,
          type: "route_announcement_updated",
        }),
      })
    )
  })

  it("sends notifications to affected customers when dates change", async () => {
    mockedBookingFindMany.mockResolvedValue([
      { id: BOOKING_ID, customerId: CUSTOMER_ID, status: "confirmed" },
    ] as never)

    await PUT(
      makeRequest("PUT", { dateFrom: "2026-05-15", dateTo: "2026-05-16" }),
      { params }
    )
    await new Promise((r) => setTimeout(r, 10))

    expect(mockedNotificationCreate).toHaveBeenCalled()
  })

  it("does not send notifications when nothing relevant changed", async () => {
    mockedFindUnique.mockResolvedValue(existingRoute as never)

    await PUT(
      makeRequest("PUT", { municipality: existingRoute.municipality }),
      { params }
    )
    await new Promise((r) => setTimeout(r, 10))

    expect(mockedNotificationCreate).not.toHaveBeenCalled()
  })

  it("notification errors do not block the route update (fire-and-forget)", async () => {
    mockedBookingFindMany.mockResolvedValue([
      { id: BOOKING_ID, customerId: CUSTOMER_ID, status: "confirmed" },
    ] as never)
    mockedNotificationCreate.mockRejectedValue(new Error("DB error"))

    const res = await PUT(makeRequest("PUT", { municipality: "Uppland" }), { params })
    expect(res.status).toBe(200)
  })
})
