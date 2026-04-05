import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Mock auth-dual
const mockGetAuthUser = vi.fn()
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    review: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    customerReview: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class extends Error {},
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    security: vi.fn(),
  },
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  }),
}))

import { DELETE } from "./route"
import { prisma } from "@/lib/prisma"

const ADMIN_UUID = "a0000000-0000-4000-a000-000000000001"
const REVIEW_UUID = "a0000000-0000-4000-a000-000000000010"

const adminUser = {
  id: ADMIN_UUID,
  email: "admin@test.se",
  userType: "customer",
  isAdmin: true,
  providerId: null,
  stableId: null,
  authMethod: "supabase" as const,
}

const routeContext = {
  params: Promise.resolve({ id: REVIEW_UUID }),
}

describe("DELETE /api/admin/reviews/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(adminUser)
  })

  function makeDeleteRequest(body: Record<string, unknown>) {
    return new NextRequest(`http://localhost:3000/api/admin/reviews/${REVIEW_UUID}`, {
      method: "DELETE",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("should delete a Review", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue({ id: REVIEW_UUID } as never)
    vi.mocked(prisma.review.delete).mockResolvedValue({ id: REVIEW_UUID } as never)

    const response = await DELETE(makeDeleteRequest({ type: "review" }), routeContext)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.deleted).toBe(true)
    expect(prisma.review.delete).toHaveBeenCalledWith({ where: { id: REVIEW_UUID } })
  })

  it("should delete a CustomerReview", async () => {
    vi.mocked(prisma.customerReview.findUnique).mockResolvedValue({ id: REVIEW_UUID } as never)
    vi.mocked(prisma.customerReview.delete).mockResolvedValue({ id: REVIEW_UUID } as never)

    const response = await DELETE(makeDeleteRequest({ type: "customerReview" }), routeContext)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.deleted).toBe(true)
    expect(prisma.customerReview.delete).toHaveBeenCalledWith({ where: { id: REVIEW_UUID } })
  })

  it("should return 404 for non-existent review", async () => {
    vi.mocked(prisma.review.findUnique).mockResolvedValue(null)

    const response = await DELETE(makeDeleteRequest({ type: "review" }), routeContext)

    expect(response.status).toBe(404)
  })

  it("should return 401 for unauthenticated request", async () => {
    mockGetAuthUser.mockResolvedValue(null)

    const response = await DELETE(makeDeleteRequest({ type: "review" }), routeContext)

    expect(response.status).toBe(401)
  })

  it("should return 403 for non-admin", async () => {
    mockGetAuthUser.mockResolvedValue({ ...adminUser, isAdmin: false })

    const response = await DELETE(makeDeleteRequest({ type: "review" }), routeContext)

    expect(response.status).toBe(403)
  })
})
