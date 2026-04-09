/**
 * GET /api/native/announcements/[id]/detail
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-dual", () => ({ getAuthUser: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    routeOrder: { findFirst: vi.fn() },
    booking: { findMany: vi.fn() },
  },
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class extends Error {},
}))
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

import { GET } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"

const mockAuth = vi.mocked(getAuthUser)
const PROVIDER_ID = "b0000000-0000-4000-a000-000000000001"

function createRequest() {
  return new NextRequest("http://localhost/api/native/announcements/ann-1/detail", {
    headers: { Authorization: "Bearer token" },
  })
}

const params = Promise.resolve({ id: "ann-1" })

describe("GET /api/native/announcements/[id]/detail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      id: "user-1", email: "t@t.com", providerId: PROVIDER_ID,
      customerId: null, stableId: null, isAdmin: false, authMethod: "supabase",
    })
    vi.mocked(prisma.routeOrder.findFirst).mockResolvedValue({
      id: "ann-1", serviceType: "Hovbeläggning", municipality: "Stockholm",
      dateFrom: new Date(), dateTo: new Date(), status: "open",
      specialInstructions: null, createdAt: new Date(),
      services: [{ id: "s1", name: "Hovbeläggning" }],
    } as never)
    vi.mocked(prisma.booking.findMany).mockResolvedValue([] as never)
  })

  it("returns 200 with announcement and bookings", async () => {
    const res = await GET(createRequest(), { params })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.announcement.id).toBe("ann-1")
    expect(data.bookings).toEqual([])
    expect(data.summary.total).toBe(0)
  })

  it("returns 401 without auth", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(createRequest(), { params })
    expect(res.status).toBe(401)
  })

  it("returns 403 for non-provider", async () => {
    mockAuth.mockResolvedValue({
      id: "user-1", email: "t@t.com", providerId: null,
      customerId: "c1", stableId: null, isAdmin: false, authMethod: "supabase",
    })
    const res = await GET(createRequest(), { params })
    expect(res.status).toBe(403)
  })

  it("returns 404 for non-owned announcement", async () => {
    vi.mocked(prisma.routeOrder.findFirst).mockResolvedValue(null as never)
    const res = await GET(createRequest(), { params })
    expect(res.status).toBe(404)
  })
})
