import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// Mock auth-dual
const mockGetAuthUser = vi.fn()
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}))

// Mock rate-limit
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  RateLimitServiceError: class extends Error {},
}))

// Mock prisma
const mockFindMany = vi.fn()
const mockCount = vi.fn()
const mockAuditCreate = vi.fn().mockResolvedValue({})
vi.mock("@/lib/prisma", () => ({
  prisma: {
    adminAuditLog: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
      create: (...args: unknown[]) => mockAuditCreate(...args),
    },
  },
}))

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), security: vi.fn() },
}))

// Mock feature-flags
vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

// Mock supabase server (for admin session timeout)
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  }),
}))

import { GET } from "./route"

const adminUser = {
  id: "admin-1",
  email: "admin@test.se",
  userType: "customer",
  isAdmin: true,
  providerId: null,
  stableId: null,
  authMethod: "supabase" as const,
}

const nonAdminUser = {
  id: "user-1",
  email: "user@test.se",
  userType: "provider",
  isAdmin: false,
  providerId: "prov-1",
  stableId: null,
  authMethod: "supabase" as const,
}

describe("GET /api/admin/audit-log", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(adminUser)
    mockAuditCreate.mockResolvedValue({})
  })

  it("should return audit log entries for admin", async () => {
    const entries = [
      {
        id: "1",
        userId: "admin-1",
        userEmail: "admin@test.se",
        action: "POST /api/admin/system",
        ipAddress: "127.0.0.1",
        statusCode: 200,
        createdAt: new Date("2026-04-05T10:00:00Z"),
      },
    ]
    mockFindMany.mockResolvedValue(entries)
    mockCount.mockResolvedValue(1)

    const request = new NextRequest("http://localhost:3000/api/admin/audit-log")
    const res = await GET(request)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.entries).toHaveLength(1)
    expect(data.entries[0].action).toBe("POST /api/admin/system")
    expect(data.total).toBe(1)
  })

  it("should return 401 for unauthenticated request", async () => {
    mockGetAuthUser.mockResolvedValue(null)

    const request = new NextRequest("http://localhost:3000/api/admin/audit-log")
    const res = await GET(request)

    expect(res.status).toBe(401)
  })

  it("should return 403 for non-admin", async () => {
    mockGetAuthUser.mockResolvedValue(nonAdminUser)

    const request = new NextRequest("http://localhost:3000/api/admin/audit-log")
    const res = await GET(request)

    expect(res.status).toBe(403)
  })

  it("should support pagination via cursor", async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    const cursorId = "a0000000-0000-4000-a000-000000000001"
    const request = new NextRequest(
      `http://localhost:3000/api/admin/audit-log?cursor=${cursorId}&limit=50`
    )
    await GET(request)

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        cursor: { id: cursorId },
        skip: 1,
      })
    )
  })
})
