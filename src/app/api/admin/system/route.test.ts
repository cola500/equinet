import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
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
    $queryRaw: vi.fn(),
    notification: {
      findFirst: vi.fn(),
      count: vi.fn(),
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

const mockAdminSession = {
  user: { id: "admin-1", email: "admin@test.se" },
} as any

describe("GET /api/admin/system", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockAdminSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      isAdmin: true,
    } as any)
  })

  it("should return system health status", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }])
    vi.mocked(prisma.notification.findFirst).mockResolvedValue({
      createdAt: new Date("2026-02-10T08:00:00Z"),
    } as any)
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

  it("should return 403 for non-admin users", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      isAdmin: false,
    } as any)

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
