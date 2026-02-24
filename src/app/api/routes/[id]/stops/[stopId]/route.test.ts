import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// Mock auth
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "user-1", userType: "provider", providerId: "provider-1" },
  }),
}))

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    route: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
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
import { isFeatureEnabled } from "@/lib/feature-flags"

const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)
const mockAuth = vi.mocked(auth)
const mockFindUnique = vi.mocked(prisma.route.findUnique)

// Import route handler AFTER mocks
import { PATCH } from "./route"

// Helper: create PATCH request with JSON body
function createRequest(body: unknown) {
  return new NextRequest(
    "http://localhost/api/routes/route-1/stops/stop-1",
    {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }
  )
}

// Helper: create PATCH request with invalid JSON
function createInvalidJsonRequest() {
  return new NextRequest(
    "http://localhost/api/routes/route-1/stops/stop-1",
    {
      method: "PATCH",
      body: "not valid json{",
      headers: { "Content-Type": "application/json" },
    }
  )
}

// Default params
const defaultParams = {
  params: Promise.resolve({ id: "route-1", stopId: "stop-1" }),
}

// Reusable mock functions for $transaction callback
let mockStopUpdate: ReturnType<typeof vi.fn>
let mockStopFindMany: ReturnType<typeof vi.fn>
let mockOrderUpdate: ReturnType<typeof vi.fn>
let mockRouteUpdate: ReturnType<typeof vi.fn>

describe("PATCH /api/routes/[id]/stops/[stopId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)

    // Default auth: authenticated provider
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: "provider-1" },
    } as any)

    // Default route: exists and owned by provider-1
    mockFindUnique.mockResolvedValue({
      id: "route-1",
      providerId: "provider-1",
    } as any)

    // Setup transaction mock helpers
    mockStopUpdate = vi.fn()
    mockStopFindMany = vi.fn()
    mockOrderUpdate = vi.fn()
    mockRouteUpdate = vi.fn()

    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      return cb({
        routeStop: { update: mockStopUpdate, findMany: mockStopFindMany },
        routeOrder: { update: mockOrderUpdate },
        route: { update: mockRouteUpdate },
      })
    })
  })

  // ---- Feature flag ----

  it("returns 404 when route_planning feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)

    const req = createRequest({ status: "completed" })
    const res = await PATCH(req, defaultParams)

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe("Ej tillgänglig")
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("route_planning")
  })

  // ---- Auth ----

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )

    const req = createRequest({ status: "completed" })
    const res = await PATCH(req, defaultParams)

    expect(res.status).toBe(401)
  })

  it("returns 403 when user is not a provider", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "customer", customerId: "cust-1" },
    } as any)

    const req = createRequest({ status: "completed" })
    const res = await PATCH(req, defaultParams)

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe("Endast leverantörer kan uppdatera stopp")
  })

  it("returns 403 when provider has no providerId", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: null },
    } as any)

    const req = createRequest({ status: "completed" })
    const res = await PATCH(req, defaultParams)

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe("Endast leverantörer kan uppdatera stopp")
  })

  // ---- Route lookup ----

  it("returns 404 when route not found", async () => {
    mockFindUnique.mockResolvedValue(null)

    const req = createRequest({ status: "completed" })
    const res = await PATCH(req, defaultParams)

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe("Rutt hittades inte")
  })

  // ---- Ownership ----

  it("returns 403 when provider does not own the route", async () => {
    mockFindUnique.mockResolvedValue({
      id: "route-1",
      providerId: "other-provider",
    } as any)

    const req = createRequest({ status: "completed" })
    const res = await PATCH(req, defaultParams)

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe("Du har inte tillgång till denna rutt")
  })

  // ---- JSON parsing ----

  it("returns 400 for invalid JSON", async () => {
    const req = createInvalidJsonRequest()
    const res = await PATCH(req, defaultParams)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Ogiltig JSON")
  })

  // ---- Zod validation ----

  it("returns 400 for invalid status value", async () => {
    const req = createRequest({ status: "invalid_status" })
    const res = await PATCH(req, defaultParams)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Valideringsfel")
    expect(json.details).toBeDefined()
  })

  it("returns 400 when status is missing", async () => {
    const req = createRequest({ problemNote: "something" })
    const res = await PATCH(req, defaultParams)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("Valideringsfel")
  })

  // ---- Happy paths ----

  it("sets actualArrival when status is in_progress", async () => {
    const updatedStop = {
      id: "stop-1",
      status: "in_progress",
      actualArrival: new Date(),
      routeOrder: { id: "order-1" },
    }
    mockStopUpdate.mockResolvedValue(updatedStop)
    mockStopFindMany.mockResolvedValue([
      { status: "in_progress" },
      { status: "pending" },
    ])

    const req = createRequest({ status: "in_progress" })
    const res = await PATCH(req, defaultParams)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe("stop-1")
    expect(json.status).toBe("in_progress")

    // Verify the update was called with actualArrival
    expect(mockStopUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stop-1" },
        data: expect.objectContaining({
          status: "in_progress",
          actualArrival: expect.any(Date),
        }),
      })
    )

    // routeOrder should NOT be updated for in_progress
    expect(mockOrderUpdate).not.toHaveBeenCalled()
  })

  it("sets actualDeparture and updates routeOrder when status is completed", async () => {
    const updatedStop = {
      id: "stop-1",
      status: "completed",
      actualDeparture: new Date(),
      routeOrderId: "order-1",
      routeOrder: { id: "order-1" },
    }
    mockStopUpdate.mockResolvedValue(updatedStop)
    // Not all stops completed yet
    mockStopFindMany.mockResolvedValue([
      { status: "completed" },
      { status: "pending" },
    ])

    const req = createRequest({ status: "completed" })
    const res = await PATCH(req, defaultParams)

    expect(res.status).toBe(200)

    // Verify stop update includes actualDeparture
    expect(mockStopUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stop-1" },
        data: expect.objectContaining({
          status: "completed",
          actualDeparture: expect.any(Date),
        }),
      })
    )

    // routeOrder should be updated to completed
    expect(mockOrderUpdate).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "completed" },
    })

    // Route should NOT be updated (not all stops completed)
    expect(mockRouteUpdate).not.toHaveBeenCalled()
  })

  it("updates route status to completed when all stops are completed", async () => {
    const updatedStop = {
      id: "stop-1",
      status: "completed",
      routeOrderId: "order-1",
      routeOrder: { id: "order-1" },
    }
    mockStopUpdate.mockResolvedValue(updatedStop)
    // All stops completed
    mockStopFindMany.mockResolvedValue([
      { status: "completed" },
      { status: "completed" },
      { status: "completed" },
    ])

    const req = createRequest({ status: "completed" })
    const res = await PATCH(req, defaultParams)

    expect(res.status).toBe(200)

    // Route should be updated to completed
    expect(mockRouteUpdate).toHaveBeenCalledWith({
      where: { id: "route-1" },
      data: { status: "completed" },
    })
  })

  it("handles problem status with problemNote", async () => {
    const updatedStop = {
      id: "stop-1",
      status: "problem",
      problemNote: "Hästen var inte tillgänglig",
      routeOrder: { id: "order-1" },
    }
    mockStopUpdate.mockResolvedValue(updatedStop)
    mockStopFindMany.mockResolvedValue([
      { status: "problem" },
      { status: "pending" },
    ])

    const req = createRequest({
      status: "problem",
      problemNote: "Hästen var inte tillgänglig",
    })
    const res = await PATCH(req, defaultParams)

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe("problem")
    expect(json.problemNote).toBe("Hästen var inte tillgänglig")

    // Verify update data includes problemNote
    expect(mockStopUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "problem",
          problemNote: "Hästen var inte tillgänglig",
        }),
      })
    )

    // routeOrder and route should NOT be updated for problem status
    expect(mockOrderUpdate).not.toHaveBeenCalled()
    expect(mockRouteUpdate).not.toHaveBeenCalled()
  })

  it("handles pending status without setting timestamps", async () => {
    const updatedStop = {
      id: "stop-1",
      status: "pending",
      routeOrder: { id: "order-1" },
    }
    mockStopUpdate.mockResolvedValue(updatedStop)
    mockStopFindMany.mockResolvedValue([
      { status: "pending" },
      { status: "completed" },
    ])

    const req = createRequest({ status: "pending" })
    const res = await PATCH(req, defaultParams)

    expect(res.status).toBe(200)

    // Verify no timestamp fields in update data
    const updateCall = mockStopUpdate.mock.calls[0][0]
    expect(updateCall.data.actualArrival).toBeUndefined()
    expect(updateCall.data.actualDeparture).toBeUndefined()
  })

  // ---- Error handling ----

  it("returns 500 on unexpected error", async () => {
    mockFindUnique.mockRejectedValue(new Error("Database connection failed"))

    const req = createRequest({ status: "completed" })
    const res = await PATCH(req, defaultParams)

    expect(res.status).toBe(500)
    const text = await res.text()
    expect(text).toBe("Internt serverfel")
  })

  it("returns 500 when transaction fails", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Error("Transaction deadlock")
    )

    const req = createRequest({ status: "completed" })
    const res = await PATCH(req, defaultParams)

    expect(res.status).toBe(500)
    const text = await res.text()
    expect(text).toBe("Internt serverfel")
  })
})
