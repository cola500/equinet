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
    route: { findUnique: vi.fn().mockResolvedValue(null) },
    routeStop: { update: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    routeOrder: { update: vi.fn() },
    $transaction: vi.fn().mockResolvedValue({}),
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

// Import route handler AFTER mocks
import { PATCH } from "./route"

describe("PATCH /api/routes/[id]/stops/[stopId]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
  })

  it("returns 404 when route_planning feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)

    const req = new NextRequest("http://localhost/api/routes/route-1/stops/stop-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" }),
    })

    const res = await PATCH(req, {
      params: Promise.resolve({ id: "route-1", stopId: "stop-1" }),
    })
    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("route_planning")
  })
})
