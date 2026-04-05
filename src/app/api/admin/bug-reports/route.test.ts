import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Mock auth-dual
const mockGetAuthUser = vi.fn()
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bugReport: { findMany: vi.fn(), count: vi.fn() },
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
  logger: { error: vi.fn(), security: vi.fn(), info: vi.fn(), warn: vi.fn() },
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

import { GET } from "./route"
import { prisma } from "@/lib/prisma"

const mockFindMany = vi.mocked(prisma.bugReport.findMany)
const mockCount = vi.mocked(prisma.bugReport.count)

const adminUser = {
  id: "admin-1",
  email: "admin@test.se",
  userType: "customer",
  isAdmin: true,
  providerId: null,
  stableId: null,
  authMethod: "supabase" as const,
}

function createRequest(params = "") {
  return new NextRequest(
    `http://localhost:3000/api/admin/bug-reports${params ? `?${params}` : ""}`,
    { method: "GET" }
  )
}

describe("GET /api/admin/bug-reports", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(adminUser)
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)
  })

  it("returns 401 when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const res = await GET(createRequest())
    expect(res.status).toBe(401)
  })

  it("returns 403 when user is not admin", async () => {
    mockGetAuthUser.mockResolvedValue({ ...adminUser, isAdmin: false })
    const res = await GET(createRequest())
    expect(res.status).toBe(403)
  })

  it("returns 200 with bug reports list", async () => {
    const mockBugs = [
      {
        id: "bug-1",
        title: "Test bug",
        status: "NEW",
        priority: "P2",
        createdAt: new Date(),
      },
    ]
    mockFindMany.mockResolvedValue(mockBugs as never)
    mockCount.mockResolvedValue(1)

    const res = await GET(createRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.bugReports).toHaveLength(1)
    expect(body.total).toBe(1)
  })

  it("filters by status query param", async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await GET(createRequest("status=NEW"))

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "NEW" }),
      })
    )
  })

  it("returns 500 on database error", async () => {
    mockFindMany.mockRejectedValue(new Error("DB down"))
    const res = await GET(createRequest())
    expect(res.status).toBe(500)
  })
})
