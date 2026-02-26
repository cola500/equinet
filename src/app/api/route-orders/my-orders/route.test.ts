import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/lib/auth-server", () => ({ auth: vi.fn() }))
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: { routeOrder: { findMany: vi.fn() } },
}))
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn() },
}))

import { GET } from "./route"
import { auth } from "@/lib/auth-server"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { prisma } from "@/lib/prisma"

const mockAuth = vi.mocked(auth)
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)
const mockFindMany = vi.mocked(prisma.routeOrder.findMany)

const mockCustomerSession = {
  user: { id: "customer-1", email: "anna@test.se", userType: "customer" },
} as never

const mockProviderSession = {
  user: { id: "provider-1", email: "magnus@test.se", userType: "provider" },
} as never

describe("GET /api/route-orders/my-orders", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(mockCustomerSession)
    mockIsFeatureEnabled.mockResolvedValue(true)
    mockFindMany.mockResolvedValue([])
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns 404 when route_planning flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe("Ej tillgänglig")
  })

  it("verifies isFeatureEnabled called with 'route_planning'", async () => {
    await GET()

    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("route_planning")
  })

  it("returns 403 when user is a provider", async () => {
    mockAuth.mockResolvedValue(mockProviderSession)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe("Endast kunder kan se sina rutt-beställningar")
  })

  it("returns 200 with route orders for customer", async () => {
    const mockOrders = [
      {
        id: "order-1",
        customerId: "customer-1",
        createdAt: new Date().toISOString(),
        routeStops: [
          {
            route: {
              provider: {
                businessName: "Hästklinik AB",
                user: { firstName: "Erik", lastName: "Svensson" },
              },
            },
          },
        ],
      },
    ]
    mockFindMany.mockResolvedValue(mockOrders as never)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual(mockOrders)
  })

  it("returns 200 with empty array when no orders", async () => {
    mockFindMany.mockResolvedValue([])

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual([])
  })

  it("verifies prisma.routeOrder.findMany called with correct customerId", async () => {
    await GET()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerId: "customer-1" },
        orderBy: { createdAt: "desc" },
      })
    )
  })

  it("returns 500 on unexpected error", async () => {
    mockFindMany.mockRejectedValue(new Error("DB connection lost"))

    const res = await GET()
    const text = await res.text()

    expect(res.status).toBe(500)
    expect(text).toBe("Internt serverfel")
  })
})
