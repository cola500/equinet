import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockAuth, mockTx, mockPrisma } = vi.hoisted(() => {
  const tx = {
    route: { create: vi.fn(), update: vi.fn() },
    routeStop: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    routeOrder: { update: vi.fn() },
  }
  const prisma = {
    route: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    routeOrder: { findMany: vi.fn(), update: vi.fn() },
    routeStop: { update: vi.fn(), findMany: vi.fn() },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: vi.fn().mockImplementation(async (callback: (tx: typeof tx) => any) =>
      callback(tx)
    ),
  }
  return { mockAuth: vi.fn(), mockTx: tx, mockPrisma: prisma }
})

vi.mock("@/lib/auth-server", () => ({ auth: mockAuth }))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), security: vi.fn() },
}))

import { POST } from "./route"
import { GET } from "./my-routes/route"
import { PATCH } from "./[id]/stops/[stopId]/route"
import { isFeatureEnabled } from "@/lib/feature-flags"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROVIDER_USER_ID = "a0000000-0000-4000-a000-000000000001"
const PROVIDER_ID = "a0000000-0000-4000-a000-000000000002"
const ROUTE_ID = "a0000000-0000-4000-a000-000000000003"
const STOP_ID = "a0000000-0000-4000-a000-000000000004"
const ORDER_ID = "a0000000-0000-4000-a000-000000000005"

function makeProviderSession() {
  return {
    user: {
      id: PROVIDER_USER_ID,
      userType: "provider" as const,
      isAdmin: false,
      providerId: PROVIDER_ID,
      email: "provider@example.com",
    },
  }
}

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

function makeGetRequest(url = "http://localhost/api/routes/my-routes"): NextRequest {
  return new NextRequest(url, { method: "GET" })
}

function makePatchRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/routes/${ROUTE_ID}/stops/${STOP_ID}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  })
}

const mockOrder = {
  id: ORDER_ID,
  serviceType: "Hovslagning",
  address: "Stallvägen 1, 123 45 Sjöbo",
  numberOfHorses: 2,
  status: "open",
  latitude: 55.64,
  longitude: 13.22,
  priority: null,
  specialInstructions: null,
  contactPhone: null,
}

const mockCreatedRoute = {
  id: ROUTE_ID,
  providerId: PROVIDER_ID,
  routeName: "Måndag-rutt",
  routeDate: new Date("2026-06-01"),
  startTime: "08:00",
  status: "planned",
  totalDistanceKm: 0,
  totalDurationMinutes: 120,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockCompleteRoute = {
  ...mockCreatedRoute,
  provider: { id: PROVIDER_ID, businessName: "Hovslagare AB", user: { firstName: "Johan", lastName: "L" } },
  stops: [],
}

const mockStop = {
  id: STOP_ID,
  status: "in_progress",
  routeOrderId: ORDER_ID,
  stopOrder: 1,
  locationName: null,
  address: "Stallvägen 1",
  latitude: 55.64,
  longitude: 13.22,
  estimatedArrival: new Date(),
  actualArrival: new Date(),
  actualDeparture: null,
  problemNote: null,
  estimatedDurationMin: 120,
}

// ---------------------------------------------------------------------------
// POST /api/routes
// ---------------------------------------------------------------------------

describe("POST /api/routes", () => {
  const validBody = {
    routeName: "Måndag-rutt",
    routeDate: new Date("2026-06-01T08:00:00.000Z").toISOString(),
    startTime: "08:00",
    orderIds: [ORDER_ID],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockAuth.mockResolvedValue(makeProviderSession())
    mockPrisma.routeOrder.findMany.mockResolvedValue([mockOrder])
    mockTx.route.create.mockResolvedValue(mockCreatedRoute)
    mockTx.routeStop.create.mockResolvedValue({})
    mockTx.routeOrder.update.mockResolvedValue({})
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx))
    mockPrisma.route.findUnique.mockResolvedValue(mockCompleteRoute)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(makePostRequest(validBody))
    expect(res.status).toBe(401)
  })

  it("returns 404 when feature flag is disabled", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false)
    const res = await POST(makePostRequest(validBody))
    expect(res.status).toBe(404)
  })

  it("returns 400 when orderIds is empty", async () => {
    const res = await POST(makePostRequest({ ...validBody, orderIds: [] }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/valideringsfel/i)
  })

  it("returns 400 when routeName is missing", async () => {
    const res = await POST(makePostRequest({ ...validBody, routeName: "" }))
    expect(res.status).toBe(400)
  })

  it("returns 201 with created route on happy path", async () => {
    const res = await POST(makePostRequest(validBody))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({ id: ROUTE_ID, routeName: "Måndag-rutt" })
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// GET /api/routes/my-routes
// ---------------------------------------------------------------------------

describe("GET /api/routes/my-routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockAuth.mockResolvedValue(makeProviderSession())
    mockPrisma.route.findMany.mockResolvedValue([mockCompleteRoute])
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(401)
  })

  it("returns 404 when feature flag is disabled", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValueOnce(false)
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(404)
  })

  it("returns 200 with route list", async () => {
    const res = await GET(makeGetRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body[0]).toMatchObject({ id: ROUTE_ID, routeName: "Måndag-rutt" })
    expect(mockPrisma.route.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { providerId: PROVIDER_ID } })
    )
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/routes/[id]/stops/[stopId]
// ---------------------------------------------------------------------------

describe("PATCH /api/routes/[id]/stops/[stopId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isFeatureEnabled).mockResolvedValue(true)
    mockAuth.mockResolvedValue(makeProviderSession())
    mockPrisma.route.findUnique.mockResolvedValue(mockCreatedRoute)
    mockTx.routeStop.update.mockResolvedValue(mockStop)
    mockTx.routeStop.findMany.mockResolvedValue([{ status: "in_progress" }])
    mockTx.routeOrder.update.mockResolvedValue({})
    mockTx.route.update.mockResolvedValue({})
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx))
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await PATCH(makePatchRequest({ status: "in_progress" }), {
      params: Promise.resolve({ id: ROUTE_ID, stopId: STOP_ID }),
    })
    expect(res.status).toBe(401)
  })

  it("returns 404 when route not found", async () => {
    mockPrisma.route.findUnique.mockResolvedValue(null)
    const res = await PATCH(makePatchRequest({ status: "in_progress" }), {
      params: Promise.resolve({ id: ROUTE_ID, stopId: STOP_ID }),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/rutt/i)
  })

  it("returns 200 when stop updated to in_progress", async () => {
    const res = await PATCH(makePatchRequest({ status: "in_progress" }), {
      params: Promise.resolve({ id: ROUTE_ID, stopId: STOP_ID }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ id: STOP_ID, status: "in_progress" })
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce()
  })

  it("returns 200 and marks route completed when all stops done", async () => {
    const completedStop = { ...mockStop, status: "completed" }
    mockTx.routeStop.update.mockResolvedValue(completedStop)
    mockTx.routeStop.findMany.mockResolvedValue([{ status: "completed" }])

    const res = await PATCH(makePatchRequest({ status: "completed" }), {
      params: Promise.resolve({ id: ROUTE_ID, stopId: STOP_ID }),
    })
    expect(res.status).toBe(200)
    expect(mockTx.routeOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "completed" } })
    )
    expect(mockTx.route.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "completed" } })
    )
  })
})
