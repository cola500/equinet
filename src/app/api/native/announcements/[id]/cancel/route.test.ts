/**
 * POST /api/native/announcements/[id]/cancel - Cancel a provider announcement
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
    routeOrder: { findUnique: vi.fn(), update: vi.fn() },
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

import { POST } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"
import { rateLimiters, RateLimitServiceError } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"

const mockAuth = vi.mocked(getAuthUser)
const mockFindProvider = vi.mocked(prisma.provider.findUnique)
const mockFindUniqueRouteOrder = vi.mocked(prisma.routeOrder.findUnique)
const mockUpdateRouteOrder = vi.mocked(prisma.routeOrder.update)
const mockRateLimit = vi.mocked(rateLimiters.api)
const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

function createRequest(id: string) {
  return new NextRequest(
    `http://localhost:3000/api/native/announcements/${id}/cancel`,
    {
      method: "POST",
      headers: { Authorization: "Bearer valid-jwt-token" },
    }
  )
}

const mockAnnouncement = {
  id: "ann-1",
  providerId: "provider-1",
  announcementType: "provider_announced",
  status: "open",
}

describe("POST /api/native/announcements/[id]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ id: "user-1", email: "test@example.com", userType: "provider", isAdmin: false, providerId: "provider-1", stableId: null, authMethod: "supabase" as const })
    mockFindProvider.mockResolvedValue({ id: "provider-1" } as never)
    mockRateLimit.mockResolvedValue(true)
    mockIsFeatureEnabled.mockResolvedValue(true)
    mockFindUniqueRouteOrder.mockResolvedValue(mockAnnouncement as never)
    mockUpdateRouteOrder.mockResolvedValue({ ...mockAnnouncement, status: "cancelled" } as never)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await POST(createRequest("ann-1"), { params: Promise.resolve({ id: "ann-1" }) })
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValue(false)
    const res = await POST(createRequest("ann-1"), { params: Promise.resolve({ id: "ann-1" }) })
    expect(res.status).toBe(429)
  })

  it("returns 503 when rate limiter fails", async () => {
    mockRateLimit.mockRejectedValue(new RateLimitServiceError("Redis error"))
    const res = await POST(createRequest("ann-1"), { params: Promise.resolve({ id: "ann-1" }) })
    expect(res.status).toBe(503)
  })

  it("returns 404 when feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValue(false)
    const res = await POST(createRequest("ann-1"), { params: Promise.resolve({ id: "ann-1" }) })
    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("route_planning")
  })

  it("returns 404 when provider not found", async () => {
    mockFindProvider.mockResolvedValue(null)
    const res = await POST(createRequest("ann-1"), { params: Promise.resolve({ id: "ann-1" }) })
    expect(res.status).toBe(404)
  })

  it("returns 404 when announcement not found", async () => {
    mockFindUniqueRouteOrder.mockResolvedValue(null)
    const res = await POST(createRequest("ann-1"), { params: Promise.resolve({ id: "ann-1" }) })
    expect(res.status).toBe(404)
  })

  it("returns 403 when announcement belongs to different provider", async () => {
    mockFindUniqueRouteOrder.mockResolvedValue({
      ...mockAnnouncement,
      providerId: "other-provider",
    } as never)
    const res = await POST(createRequest("ann-1"), { params: Promise.resolve({ id: "ann-1" }) })
    expect(res.status).toBe(403)
  })

  it("returns 400 when announcement is not open", async () => {
    mockFindUniqueRouteOrder.mockResolvedValue({
      ...mockAnnouncement,
      status: "completed",
    } as never)
    const res = await POST(createRequest("ann-1"), { params: Promise.resolve({ id: "ann-1" }) })
    expect(res.status).toBe(400)
  })

  it("cancels announcement and returns success", async () => {
    const res = await POST(createRequest("ann-1"), { params: Promise.resolve({ id: "ann-1" }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockUpdateRouteOrder).toHaveBeenCalledWith({
      where: { id: "ann-1" },
      data: { status: "cancelled" },
    })
  })

  it("returns 500 on unexpected error", async () => {
    mockUpdateRouteOrder.mockRejectedValue(new Error("DB error"))
    const res = await POST(createRequest("ann-1"), { params: Promise.resolve({ id: "ann-1" }) })
    expect(res.status).toBe(500)
  })
})
