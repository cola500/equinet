/**
 * GET /api/native/announcements - Provider's route announcements for native iOS
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: { findUnique: vi.fn() },
    routeOrder: { findMany: vi.fn() },
  },
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class RateLimitServiceError extends Error {},
}))
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

import { GET } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"

const mockAuth = vi.mocked(getAuthUser)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockFindManyRouteOrders = vi.mocked(prisma.routeOrder.findMany)
const mockRateLimit = vi.mocked(rateLimiters.api)
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

function createRequest() {
  return new NextRequest("http://localhost:3000/api/native/announcements", {
    method: "GET",
    headers: { Authorization: "Bearer valid-jwt-token" },
  })
}

const mockAnnouncement = {
  id: "ann-1",
  serviceType: "Hovslagning",
  municipality: "Alingsås",
  dateFrom: new Date("2026-04-10"),
  dateTo: new Date("2026-04-12"),
  status: "open",
  specialInstructions: "Ring innan",
  createdAt: new Date("2026-04-01"),
  routeStops: [
    { id: "stop-1", stopOrder: 1, locationName: "Centrum", address: "Storgatan 1" },
  ],
  services: [
    { id: "svc-1", name: "Hovverkning" },
  ],
  _count: { bookings: 3 },
}

describe("GET /api/native/announcements", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "supabase" as const })
    mockFindProvider.mockResolvedValue({ id: "provider-1" } as never)
    mockRateLimit.mockResolvedValue(true)
    mockIsFeatureEnabled.mockResolvedValue(true)
    mockFindManyRouteOrders.mockResolvedValue([] as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(createRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Ej inloggad")
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await GET(createRequest())
    expect(res.status).toBe(429)
  })

  it("returns 503 when rate limiter fails", async () => {
    mockRateLimit.mockRejectedValue(new RateLimitServiceError("Redis error"))
    const res = await GET(createRequest())
    expect(res.status).toBe(503)
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValue(false)
    const res = await GET(createRequest())
    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("route_announcements")
  })

  it("returns 404 when provider not found", async () => {
    mockFindProvider.mockResolvedValue(null)
    const res = await GET(createRequest())
    expect(res.status).toBe(404)
  })

  it("returns empty array when no announcements", async () => {
    const res = await GET(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.announcements).toEqual([])
  })

  it("returns announcements with bookingCount flattened", async () => {
    mockFindManyRouteOrders.mockResolvedValue([mockAnnouncement] as never)
    const res = await GET(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.announcements).toHaveLength(1)
    const ann = body.announcements[0]
    expect(ann.id).toBe("ann-1")
    expect(ann.bookingCount).toBe(3)
    expect(ann.serviceType).toBe("Hovslagning")
    expect(ann.municipality).toBe("Alingsås")
    expect(ann.status).toBe("open")
    expect(ann.specialInstructions).toBe("Ring innan")
    expect(ann.routeStops).toHaveLength(1)
    expect(ann.services).toHaveLength(1)
    // _count should NOT be in response
    expect(ann._count).toBeUndefined()
  })

  it("returns 500 on unexpected error", async () => {
    mockFindManyRouteOrders.mockRejectedValue(new Error("DB error"))
    const res = await GET(createRequest())
    expect(res.status).toBe(500)
  })
})
