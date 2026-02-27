import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// Mock auth
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "user-1", userType: "PROVIDER", providerId: "provider-1" },
  }),
}))

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    routeOrder: { findMany: vi.fn().mockResolvedValue([]) },
    route: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn().mockResolvedValue({}),
  },
}))

// Mock distance (canonical module: @/lib/geo/distance)
vi.mock("@/lib/geo/distance", () => ({
  calculateDistance: vi.fn().mockReturnValue(0),
}))

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock feature flags
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { calculateDistance } from "@/lib/geo/distance"
import { isFeatureEnabled } from "@/lib/feature-flags"

const mockAuth = vi.mocked(auth)
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)
const mockFindMany = vi.mocked(prisma.routeOrder.findMany)
const mockFindUnique = vi.mocked(prisma.route.findUnique)
const mockTransaction = vi.mocked(prisma.$transaction)
const mockCalculateDistance = vi.mocked(calculateDistance)

// Import route handler AFTER mocks
import { POST } from "./route"

// --- Helpers ---

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    routeName: "Morgonrutt",
    routeDate: "2026-03-01T00:00:00.000Z",
    startTime: "08:00",
    orderIds: ["order-1", "order-2"],
    ...overrides,
  }
}

function makeOrder(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    numberOfHorses: 2,
    latitude: 59.0,
    longitude: 18.0,
    address: "Testvägen 1",
    status: "open",
    ...overrides,
  }
}

const completeRouteResponse = {
  id: "route-1",
  routeName: "Morgonrutt",
  routeDate: new Date("2026-03-01"),
  startTime: "08:00",
  status: "planned",
  totalDistanceKm: 10.5,
  totalDurationMinutes: 150,
  createdAt: new Date(),
  updatedAt: new Date(),
  provider: {
    id: "provider-1",
    businessName: "Test Hovslagare",
    user: { firstName: "Anna", lastName: "Svensson" },
  },
  stops: [
    {
      id: "stop-1",
      stopOrder: 1,
      estimatedArrival: new Date(),
      estimatedDurationMin: 120,
      actualArrival: null,
      actualDeparture: null,
      status: "pending",
      problemNote: null,
      routeOrder: {
        id: "order-1",
        serviceType: "TRIMMING",
        address: "Testvägen 1",
        numberOfHorses: 2,
        priority: "normal",
        specialInstructions: null,
        contactPhone: "0701234567",
        customer: { firstName: "Erik", lastName: "Johansson", phone: "0701234567" },
      },
    },
  ],
}

describe("POST /api/routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "PROVIDER", providerId: "provider-1" },
    } as never)
  })

  // --- Feature flag ---

  it("returns 404 when route_planning feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)

    const req = new NextRequest("http://localhost/api/routes", {
      method: "POST",
      body: JSON.stringify({}),
    })

    const res = await POST(req)
    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("route_planning")
  })

  // --- Auth ---

  it("returns 500 when not authenticated (auth throws Response)", async () => {
    // auth() throws a Response with 401 -- but route.ts catch block does NOT
    // propagate thrown Responses (missing `if (error instanceof Response)` check),
    // so it falls through to the generic 500 handler.
    mockAuth.mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )

    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(text).toBe("Internt serverfel")
  })

  // --- JSON parsing ---

  it("returns 500 for invalid JSON body", async () => {
    // request.json() is called without its own try-catch, so a SyntaxError
    // from malformed JSON falls through to the generic catch -> 500.
    const req = new NextRequest("http://localhost/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json {{{",
    })

    const res = await POST(req)
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(text).toBe("Internt serverfel")
  })

  // --- Zod validation ---

  it("returns 400 for Zod validation error (missing routeName)", async () => {
    const res = await POST(
      makeRequest({ routeDate: "2026-03-01T00:00:00.000Z", startTime: "08:00", orderIds: ["o1"] })
    )

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Valideringsfel")
    expect(json.details).toBeDefined()
  })

  it("returns 400 for invalid startTime format", async () => {
    const res = await POST(makeRequest(validBody({ startTime: "8am" })))

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Valideringsfel")
  })

  it("returns 400 for empty orderIds array", async () => {
    const res = await POST(makeRequest(validBody({ orderIds: [] })))

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Valideringsfel")
  })

  // --- Order validation ---

  it("returns 400 when orders not found or not available", async () => {
    // Request has 2 orderIds but DB only returns 1 matching order
    mockFindMany.mockResolvedValueOnce([makeOrder("order-1")] as never)

    const res = await POST(makeRequest(validBody()))

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Alla beställningar måste vara tillgängliga")
  })

  // --- Happy path ---

  it("creates route and returns 201 with complete route", async () => {
    const orders = [
      makeOrder("order-1", { latitude: 59.0, longitude: 18.0 }),
      makeOrder("order-2", { latitude: 59.5, longitude: 18.5 }),
    ]
    mockFindMany.mockResolvedValueOnce(orders as never)
    mockTransaction.mockResolvedValueOnce({ id: "route-1" })
    mockFindUnique.mockResolvedValueOnce(completeRouteResponse as never)

    const res = await POST(makeRequest(validBody()))

    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe("route-1")
    expect(json.routeName).toBe("Morgonrutt")
    expect(json.provider.businessName).toBe("Test Hovslagare")
    expect(json.stops).toHaveLength(1)
  })

  // --- Distance calculation ---

  it("calculates distance between consecutive orders", async () => {
    const orders = [
      makeOrder("order-1", { latitude: 59.0, longitude: 18.0 }),
      makeOrder("order-2", { latitude: 59.5, longitude: 18.5 }),
    ]
    mockFindMany.mockResolvedValueOnce(orders as never)
    mockCalculateDistance.mockReturnValue(15.3)
    mockTransaction.mockResolvedValueOnce({ id: "route-1" })
    mockFindUnique.mockResolvedValueOnce(completeRouteResponse as never)

    await POST(makeRequest(validBody()))

    // calculateDistance is called twice: once for totalDistance calc, once inside $transaction
    // The first call (distance summary loop) uses consecutive order pairs
    expect(mockCalculateDistance).toHaveBeenCalledWith(59.0, 18.0, 59.5, 18.5)
  })

  it("skips distance calculation when orders lack coordinates", async () => {
    const orders = [
      makeOrder("order-1", { latitude: null, longitude: null }),
      makeOrder("order-2", { latitude: 59.5, longitude: 18.5 }),
    ]
    mockFindMany.mockResolvedValueOnce(orders as never)
    mockTransaction.mockResolvedValueOnce({ id: "route-1" })
    mockFindUnique.mockResolvedValueOnce(completeRouteResponse as never)

    await POST(makeRequest(validBody()))

    // Should NOT call calculateDistance when prev order has null coords
    expect(mockCalculateDistance).not.toHaveBeenCalled()
  })

  // --- Transaction: stops created in order ---

  it("creates stops with correct stopOrder via transaction", async () => {
    const orders = [
      makeOrder("order-1"),
      makeOrder("order-2"),
    ]
    mockFindMany.mockResolvedValueOnce(orders as never)
    mockTransaction.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => {
      const txMock = {
        route: {
          create: vi.fn().mockResolvedValue({ id: "route-1" }),
        },
        routeStop: {
          create: vi.fn().mockResolvedValue({}),
        },
        routeOrder: {
          update: vi.fn().mockResolvedValue({}),
        },
      }
      await cb(txMock)

      // Verify stops created with correct stopOrder
      const stopCalls = txMock.routeStop.create.mock.calls
      expect(stopCalls).toHaveLength(2)
      expect(stopCalls[0][0].data.stopOrder).toBe(1)
      expect(stopCalls[0][0].data.routeOrderId).toBe("order-1")
      expect(stopCalls[1][0].data.stopOrder).toBe(2)
      expect(stopCalls[1][0].data.routeOrderId).toBe("order-2")

      // Verify order status updated to in_route
      const updateCalls = txMock.routeOrder.update.mock.calls
      expect(updateCalls).toHaveLength(2)
      expect(updateCalls[0][0].data.status).toBe("in_route")
      expect(updateCalls[1][0].data.status).toBe("in_route")

      return { id: "route-1" }
    })
    mockFindUnique.mockResolvedValueOnce(completeRouteResponse as never)

    const res = await POST(makeRequest(validBody()))
    expect(res.status).toBe(201)
  })

  // --- Unexpected error ---

  it("returns 500 on unexpected error", async () => {
    mockFindMany.mockRejectedValueOnce(new Error("DB connection lost"))

    // findMany will throw before we get to use orders, but we need valid input
    const res = await POST(makeRequest(validBody()))

    expect(res.status).toBe(500)
    const text = await res.text()
    expect(text).toBe("Internt serverfel")
  })
})
