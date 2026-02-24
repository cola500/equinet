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

// Mock distance
vi.mock("@/lib/distance", () => ({
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

import { isFeatureEnabled } from "@/lib/feature-flags"
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

// Import route handler AFTER mocks
import { POST } from "./route"

describe("POST /api/routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
  })

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
})
