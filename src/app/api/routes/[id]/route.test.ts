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
import { GET } from "./route"

import { auth } from "@/lib/auth-server"

describe("GET /api/routes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsFeatureEnabled.mockResolvedValue(true)
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: "provider-1" },
    } as never)
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)

    const req = new NextRequest("http://localhost/api/routes/route-1", {
      method: "GET",
    })

    const res = await GET(req, { params: Promise.resolve({ id: "route-1" }) })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe("Ej inloggad")
  })

  it("returns 403 when user is not a provider", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", userType: "customer" },
    } as never)

    const req = new NextRequest("http://localhost/api/routes/route-1", {
      method: "GET",
    })

    const res = await GET(req, { params: Promise.resolve({ id: "route-1" }) })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe("Åtkomst nekad")
  })

  it("returns 403 when provider has no providerId", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "user-1", userType: "provider", providerId: null },
    } as never)

    const req = new NextRequest("http://localhost/api/routes/route-1", {
      method: "GET",
    })

    const res = await GET(req, { params: Promise.resolve({ id: "route-1" }) })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe("Leverantörsprofil saknas")
  })

  it("returns 404 when route_planning feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)

    const req = new NextRequest("http://localhost/api/routes/route-1", {
      method: "GET",
    })

    const res = await GET(req, { params: Promise.resolve({ id: "route-1" }) })
    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("route_planning")
  })
})
