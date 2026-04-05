import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Mock auth-dual
const mockGetAuthUser = vi.fn()
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    notification: {
      findFirst: vi.fn(),
      count: vi.fn(),
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

import { GET } from "./route"
import { prisma } from "@/lib/prisma"

const adminUser = {
  id: "admin-1",
  email: "admin@test.se",
  userType: "customer",
  isAdmin: true,
  providerId: null,
  stableId: null,
  authMethod: "supabase" as const,
}

describe("GET /api/admin/system", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(adminUser)
  })

  it("should return system health status", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }])
    vi.mocked(prisma.notification.findFirst).mockResolvedValue({
      createdAt: new Date("2026-02-10T08:00:00Z"),
    } as never)
    vi.mocked(prisma.notification.count).mockResolvedValue(42)

    const request = new NextRequest("http://localhost:3000/api/admin/system")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.database.healthy).toBe(true)
    expect(typeof data.database.responseTimeMs).toBe("number")
    expect(data.cron.remindersCount).toBe(42)
    expect(data.cron.lastReminderRun).toBeDefined()
  })

  it("should handle database failure", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("DB down"))
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.notification.count).mockResolvedValue(0)

    const request = new NextRequest("http://localhost:3000/api/admin/system")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.database.healthy).toBe(false)
  })

  it("should handle no reminders sent", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }])
    vi.mocked(prisma.notification.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.notification.count).mockResolvedValue(0)

    const request = new NextRequest("http://localhost:3000/api/admin/system")
    const response = await GET(request)
    const data = await response.json()

    expect(data.cron.lastReminderRun).toBeNull()
    expect(data.cron.remindersCount).toBe(0)
  })

  it("should return 401 for unauthenticated request", async () => {
    mockGetAuthUser.mockResolvedValue(null)

    const request = new NextRequest("http://localhost:3000/api/admin/system")
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it("should return 403 for non-admin users", async () => {
    mockGetAuthUser.mockResolvedValue({ ...adminUser, isAdmin: false })

    const request = new NextRequest("http://localhost:3000/api/admin/system")
    const response = await GET(request)

    expect(response.status).toBe(403)
  })

  it("should return 429 when rate limited", async () => {
    const { rateLimiters } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

    const request = new NextRequest("http://localhost:3000/api/admin/system")
    const response = await GET(request)

    expect(response.status).toBe(429)
  })
})
