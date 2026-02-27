import { describe, it, expect, beforeEach, vi } from "vitest"
import { DELETE } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    review: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    customerReview: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    security: vi.fn(),
  },
}))

const ADMIN_UUID = "a0000000-0000-4000-a000-000000000001"
const REVIEW_UUID = "a0000000-0000-4000-a000-000000000010"

const mockAdminSession = {
  user: { id: ADMIN_UUID, email: "admin@test.se" },
} as never

const routeContext = {
  params: Promise.resolve({ id: REVIEW_UUID }),
}

describe("DELETE /api/admin/reviews/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockAdminSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: ADMIN_UUID,
      isAdmin: true,
    } as never)
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

  it("should return 403 for non-admin", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: ADMIN_UUID,
      isAdmin: false,
    } as never)

    const response = await DELETE(makeDeleteRequest({ type: "review" }), routeContext)

    expect(response.status).toBe(403)
  })
})
