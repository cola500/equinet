import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    bugReport: { findMany: vi.fn(), count: vi.fn() },
  },
}))
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), security: vi.fn() },
}))

import { GET } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"

const mockAuth = vi.mocked(auth)
const mockFindUnique = vi.mocked(prisma.user.findUnique)
const mockFindMany = vi.mocked(prisma.bugReport.findMany)
const mockCount = vi.mocked(prisma.bugReport.count)

const mockAdminSession = {
  user: { id: "admin-1", email: "admin@test.se", userType: "provider" },
} as never

function createRequest(params = "") {
  return new NextRequest(
    `http://localhost:3000/api/admin/bug-reports${params ? `?${params}` : ""}`,
    { method: "GET" }
  )
}

describe("GET /api/admin/bug-reports", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(mockAdminSession)
    mockFindUnique.mockResolvedValue({ id: "admin-1", isAdmin: true } as never)
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)
  })

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
    )
    const res = await GET(createRequest())
    expect(res.status).toBe(401)
  })

  it("returns 403 when user is not admin", async () => {
    mockFindUnique.mockResolvedValue({
      id: "admin-1",
      isAdmin: false,
    } as never)
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
