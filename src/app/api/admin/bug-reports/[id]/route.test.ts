import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Mock auth-dual
const mockGetAuthUser = vi.fn()
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bugReport: { findUnique: vi.fn(), update: vi.fn() },
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
  logger: { info: vi.fn(), error: vi.fn(), security: vi.fn(), warn: vi.fn() },
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

import { GET, PATCH } from "./route"
import { prisma } from "@/lib/prisma"

const mockBugFindUnique = vi.mocked(prisma.bugReport.findUnique)
const mockUpdate = vi.mocked(prisma.bugReport.update)

const adminUser = {
  id: "admin-1",
  email: "admin@test.se",
  userType: "customer",
  isAdmin: true,
  providerId: null,
  stableId: null,
  authMethod: "supabase" as const,
}

const mockBug = {
  id: "bug-1",
  title: "Test",
  description: "Test desc",
  reproductionSteps: null,
  pageUrl: "/test",
  userAgent: "Mozilla",
  platform: "MacOS",
  userRole: "CUSTOMER",
  status: "NEW",
  priority: "P2",
  internalNote: null,
  userId: "user-1",
  updatedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { firstName: "Test", lastName: "User", email: "test@test.se" },
}

const routeContext = { params: Promise.resolve({ id: "bug-1" }) }

function createGetRequest() {
  return new NextRequest(
    "http://localhost:3000/api/admin/bug-reports/bug-1",
    { method: "GET" }
  )
}

function createPatchRequest(body: Record<string, unknown>) {
  return new NextRequest(
    "http://localhost:3000/api/admin/bug-reports/bug-1",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
}

describe("GET /api/admin/bug-reports/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(adminUser)
    mockBugFindUnique.mockResolvedValue(mockBug as never)
  })

  it("returns 403 when user is not admin", async () => {
    mockGetAuthUser.mockResolvedValue({ ...adminUser, isAdmin: false })
    const res = await GET(createGetRequest(), routeContext)
    expect(res.status).toBe(403)
  })

  it("returns 404 when bug report not found", async () => {
    mockBugFindUnique.mockResolvedValue(null)
    const res = await GET(createGetRequest(), routeContext)
    expect(res.status).toBe(404)
  })

  it("returns 200 with bug report details", async () => {
    const res = await GET(createGetRequest(), routeContext)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe("bug-1")
    expect(body.title).toBe("Test")
  })
})

describe("PATCH /api/admin/bug-reports/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(adminUser)
    mockBugFindUnique.mockResolvedValue(mockBug as never)
    mockUpdate.mockResolvedValue({
      ...mockBug,
      status: "INVESTIGATING",
    } as never)
  })

  it("returns 403 when user is not admin", async () => {
    mockGetAuthUser.mockResolvedValue({ ...adminUser, isAdmin: false })
    const res = await PATCH(
      createPatchRequest({ status: "INVESTIGATING" }),
      routeContext
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when bug report not found", async () => {
    mockBugFindUnique.mockResolvedValue(null)
    const res = await PATCH(
      createPatchRequest({ status: "INVESTIGATING" }),
      routeContext
    )
    expect(res.status).toBe(404)
  })

  it("returns 400 for invalid status", async () => {
    const res = await PATCH(
      createPatchRequest({ status: "INVALID" }),
      routeContext
    )
    expect(res.status).toBe(400)
  })

  it("returns 200 on successful update", async () => {
    const res = await PATCH(
      createPatchRequest({
        status: "INVESTIGATING",
        priority: "P1",
        internalNote: "Kollar på detta",
      }),
      routeContext
    )
    await res.json()

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "bug-1" },
        data: expect.objectContaining({
          status: "INVESTIGATING",
          priority: "P1",
          internalNote: "Kollar på detta",
          updatedBy: "admin-1",
        }),
      })
    )
  })

  it("returns 500 on database error", async () => {
    mockUpdate.mockRejectedValue(new Error("DB down"))
    const res = await PATCH(
      createPatchRequest({ status: "INVESTIGATING" }),
      routeContext
    )
    expect(res.status).toBe(500)
  })
})
