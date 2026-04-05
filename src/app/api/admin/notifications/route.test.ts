import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

const mockGetAuthUser = vi.fn()
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
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

import { POST } from "./route"
import { prisma } from "@/lib/prisma"

const ADMIN_UUID = "a0000000-0000-4000-a000-000000000001"

const adminUser = {
  id: ADMIN_UUID,
  email: "admin@test.se",
  userType: "customer",
  isAdmin: true,
  providerId: null,
  stableId: null,
  authMethod: "supabase" as const,
}

describe("POST /api/admin/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(adminUser)
  })

  function makePostRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost:3000/api/admin/notifications", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("should send notifications to all users", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "u-1" },
      { id: "u-2" },
      { id: "u-3" },
    ] as never)
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 3 })

    const response = await POST(makePostRequest({
      target: "all",
      title: "Viktig uppdatering",
      message: "Ny funktion tillgänglig!",
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.sent).toBe(3)
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          userId: "u-1",
          type: "system_notification",
          message: "Viktig uppdatering: Ny funktion tillgänglig!",
        }),
      ]),
    })
  })

  it("should send to customers only", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "c-1" },
      { id: "c-2" },
    ] as never)
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 2 })

    const response = await POST(makePostRequest({
      target: "customers",
      title: "Kundnyhet",
      message: "Nya tjänster finns!",
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.sent).toBe(2)
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userType: "customer" },
      })
    )
  })

  it("should send to providers only", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "p-1" },
    ] as never)
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 })

    const response = await POST(makePostRequest({
      target: "providers",
      title: "Leverantörsinfo",
      message: "Ny funktionalitet!",
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.sent).toBe(1)
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userType: "provider" },
      })
    )
  })

  it("should validate title and message length", async () => {
    const response = await POST(makePostRequest({
      target: "all",
      title: "",
      message: "Kort meddelande",
    }))

    expect(response.status).toBe(400)
  })

  it("should include linkUrl if provided", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "u-1" }] as never)
    vi.mocked(prisma.notification.createMany).mockResolvedValue({ count: 1 })

    const response = await POST(makePostRequest({
      target: "all",
      title: "Ny funktion",
      message: "Kolla in!",
      linkUrl: "/customer/bookings",
    }))

    expect(response.status).toBe(200)
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          linkUrl: "/customer/bookings",
        }),
      ]),
    })
  })

  it("should return 403 for non-admin", async () => {
    mockGetAuthUser.mockResolvedValue({ ...adminUser, isAdmin: false })

    const response = await POST(makePostRequest({
      target: "all",
      title: "Test",
      message: "Meddelande",
    }))

    expect(response.status).toBe(403)
  })

  it("should return 429 when rate limited", async () => {
    const { rateLimiters } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

    const response = await POST(makePostRequest({
      target: "all",
      title: "Test",
      message: "Meddelande",
    }))

    expect(response.status).toBe(429)
  })
})
