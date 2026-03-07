import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock auth
vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "user-1", userType: "provider", providerId: "provider-1" },
  }),
}))

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    route: { findMany: vi.fn().mockResolvedValue([]) },
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

import { isFeatureEnabled } from "@/lib/feature-flags"
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

// Mock rate limiting
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

// Import route handler AFTER mocks
import { GET } from "./route"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth-server"

describe("GET /api/routes/my-routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
  })

  it("returns 404 when route_planning feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)

    const request = new Request("http://localhost:3000/api/routes/my-routes")
    const res = await GET(request)
    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("route_planning")
  })

  it("uses select (not include) and returns only needed fields", async () => {
    const mockRoute = {
      id: "route-1",
      routeName: "Morgonrutt",
      routeDate: new Date("2026-03-07"),
      startTime: "08:00",
      status: "planned",
      totalDistanceKm: 45.2,
      totalDurationMinutes: 120,
      stops: [
        {
          id: "stop-1",
          stopOrder: 1,
          status: "pending",
          routeOrder: {
            serviceType: "Hovslagning",
            address: "Storgatan 1",
            customer: {
              firstName: "Anna",
              lastName: "Svensson",
              phone: "070-1234567",
            },
          },
        },
      ],
    }

    vi.mocked(prisma.route.findMany).mockResolvedValue([mockRoute] as never)

    const request = new Request("http://localhost:3000/api/routes/my-routes")
    const res = await GET(request)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toHaveLength(1)

    const route = data[0]
    // Should have these fields
    expect(route.id).toBe("route-1")
    expect(route.routeName).toBe("Morgonrutt")
    expect(route.stops[0].routeOrder.customer.firstName).toBe("Anna")

    // Verify select is used (not include)
    const call = vi.mocked(prisma.route.findMany).mock.calls[0][0]
    expect(call).toHaveProperty("select")
    expect(call).not.toHaveProperty("include")

    // Should NOT have these fields (trimmed by select)
    const selectBlock = (call as Record<string, unknown>).select as Record<string, unknown>
    expect(selectBlock.createdAt).toBeFalsy()
    expect(selectBlock.updatedAt).toBeFalsy()
    expect(selectBlock.providerId).toBeFalsy()
  })
})
