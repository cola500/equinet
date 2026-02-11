import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET, PATCH } from "./route"
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
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      create: vi.fn(),
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

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockAdminSession)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      isAdmin: true,
    } as any)
  })

  it("should return paginated user list", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "user-1",
        email: "kund@test.se",
        firstName: "Anna",
        lastName: "Svensson",
        userType: "customer",
        isAdmin: false,
        createdAt: new Date("2026-01-15"),
        emailVerified: new Date("2026-01-15"),
        provider: null,
      },
    ] as any)
    vi.mocked(prisma.user.count).mockResolvedValue(1)

    const request = new NextRequest("http://localhost:3000/api/admin/users?page=1&limit=20")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.users).toHaveLength(1)
    expect(data.users[0]).toMatchObject({
      id: "user-1",
      email: "kund@test.se",
      firstName: "Anna",
      lastName: "Svensson",
      userType: "customer",
    })
    // Must NOT expose passwordHash
    expect(data.users[0].passwordHash).toBeUndefined()
    expect(data.total).toBe(1)
    expect(data.page).toBe(1)
    expect(data.totalPages).toBe(1)
  })

  it("should filter by search term", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([])
    vi.mocked(prisma.user.count).mockResolvedValue(0)

    const request = new NextRequest("http://localhost:3000/api/admin/users?search=anna")
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ email: expect.objectContaining({ contains: "anna" }) }),
          ]),
        }),
      })
    )
  })

  it("should filter by user type", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([])
    vi.mocked(prisma.user.count).mockResolvedValue(0)

    const request = new NextRequest("http://localhost:3000/api/admin/users?type=provider")
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userType: "provider",
        }),
      })
    )
  })

  it("should paginate correctly", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([])
    vi.mocked(prisma.user.count).mockResolvedValue(50)

    const request = new NextRequest("http://localhost:3000/api/admin/users?page=2&limit=10")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.page).toBe(2)
    expect(data.totalPages).toBe(5)
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      })
    )
  })

  it("should return 403 for non-admin users", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "admin-1",
      isAdmin: false,
    } as any)

    const request = new NextRequest("http://localhost:3000/api/admin/users")
    const response = await GET(request)

    expect(response.status).toBe(403)
  })

  it("should return 429 when rate limited", async () => {
    const { rateLimiters } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

    const request = new NextRequest("http://localhost:3000/api/admin/users")
    const response = await GET(request)

    expect(response.status).toBe(429)
  })

  it("should include extended provider data when type=provider", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "user-p1",
        email: "lev@test.se",
        firstName: "Erik",
        lastName: "Johansson",
        userType: "provider",
        isAdmin: false,
        createdAt: new Date("2026-01-10"),
        emailVerified: new Date("2026-01-10"),
        provider: {
          businessName: "Hästkliniken",
          isVerified: true,
          isActive: true,
          city: "Stockholm",
          _count: { bookings: 15, services: 3 },
          reviews: [{ rating: 5 }, { rating: 4 }],
          fortnoxConnection: { id: "fc-1" },
        },
      },
    ] as any)
    vi.mocked(prisma.user.count).mockResolvedValue(1)

    const request = new NextRequest("http://localhost:3000/api/admin/users?type=provider")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.users[0].provider).toMatchObject({
      businessName: "Hästkliniken",
      isVerified: true,
      isActive: true,
      city: "Stockholm",
      bookingCount: 15,
      serviceCount: 3,
      averageRating: 4.5,
      hasFortnox: true,
    })
  })

  it("should handle provider with no reviews (null averageRating)", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "user-p2",
        email: "ny@test.se",
        firstName: "Ny",
        lastName: "Leverantör",
        userType: "provider",
        isAdmin: false,
        createdAt: new Date("2026-02-01"),
        emailVerified: null,
        provider: {
          businessName: "Ny Klinik",
          isVerified: false,
          isActive: true,
          city: null,
          _count: { bookings: 0, services: 0 },
          reviews: [],
          fortnoxConnection: null,
        },
      },
    ] as any)
    vi.mocked(prisma.user.count).mockResolvedValue(1)

    const request = new NextRequest("http://localhost:3000/api/admin/users?type=provider")
    const response = await GET(request)
    const data = await response.json()

    expect(data.users[0].provider).toMatchObject({
      businessName: "Ny Klinik",
      city: null,
      bookingCount: 0,
      serviceCount: 0,
      averageRating: null,
      hasFortnox: false,
    })
  })

  it("should filter providers by verified status", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([])
    vi.mocked(prisma.user.count).mockResolvedValue(0)

    const request = new NextRequest("http://localhost:3000/api/admin/users?type=provider&verified=true")
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userType: "provider",
          provider: expect.objectContaining({ isVerified: true }),
        }),
      })
    )
  })

  it("should filter providers by active status", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([])
    vi.mocked(prisma.user.count).mockResolvedValue(0)

    const request = new NextRequest("http://localhost:3000/api/admin/users?type=provider&active=false")
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userType: "provider",
          provider: expect.objectContaining({ isActive: false }),
        }),
      })
    )
  })

  it("should search by businessName when type=provider", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([])
    vi.mocked(prisma.user.count).mockResolvedValue(0)

    const request = new NextRequest("http://localhost:3000/api/admin/users?type=provider&search=häst")
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              provider: expect.objectContaining({
                businessName: expect.objectContaining({ contains: "häst" }),
              }),
            }),
          ]),
        }),
      })
    )
  })
})

// ============================================================
// PATCH /api/admin/users -- Admin actions (block/admin toggle)
// ============================================================

// Valid UUID v4 test IDs (position 13=4, position 19=a)
const ADMIN_UUID = "a0000000-0000-4000-a000-000000000001"
const USER_UUID = "a0000000-0000-4000-a000-000000000002"
const USER2_UUID = "a0000000-0000-4000-a000-000000000003"
const NONEXISTENT_UUID = "a0000000-0000-4000-a000-000000000099"

const mockAdminSessionPatch = {
  user: { id: ADMIN_UUID, email: "admin@test.se" },
} as any

describe("PATCH /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockAdminSessionPatch)
    // requireAdmin lookup
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: ADMIN_UUID,
      isAdmin: true,
    } as any)
  })

  function makePatchRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost:3000/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("should toggle isBlocked on a user", async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: ADMIN_UUID, isAdmin: true } as any)
      .mockResolvedValueOnce({ id: USER_UUID, isBlocked: false, isAdmin: false } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: USER_UUID,
      isBlocked: true,
    } as any)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as any)

    const response = await PATCH(makePatchRequest({ userId: USER_UUID, action: "toggleBlocked" }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.isBlocked).toBe(true)
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_UUID },
        data: { isBlocked: true },
      })
    )
  })

  it("should toggle isAdmin on a user", async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: ADMIN_UUID, isAdmin: true } as any)
      .mockResolvedValueOnce({ id: USER2_UUID, isBlocked: false, isAdmin: false } as any)
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: USER2_UUID,
      isAdmin: true,
    } as any)

    const response = await PATCH(makePatchRequest({ userId: USER2_UUID, action: "toggleAdmin" }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.isAdmin).toBe(true)
  })

  it("should not allow blocking yourself", async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: ADMIN_UUID, isAdmin: true } as any)

    const response = await PATCH(makePatchRequest({ userId: ADMIN_UUID, action: "toggleBlocked" }))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toMatch(/dig själv/)
  })

  it("should not allow removing own admin", async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: ADMIN_UUID, isAdmin: true } as any)
      .mockResolvedValueOnce({ id: ADMIN_UUID, isBlocked: false, isAdmin: true } as any)

    const response = await PATCH(makePatchRequest({ userId: ADMIN_UUID, action: "toggleAdmin" }))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toMatch(/egen admin/)
  })

  it("should return 404 for non-existent userId", async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce({ id: ADMIN_UUID, isAdmin: true } as any)
      .mockResolvedValueOnce(null)

    const response = await PATCH(makePatchRequest({ userId: NONEXISTENT_UUID, action: "toggleBlocked" }))

    expect(response.status).toBe(404)
  })

  it("should return 400 for invalid action (Zod)", async () => {
    const response = await PATCH(makePatchRequest({ userId: USER_UUID, action: "deleteUser" }))

    expect(response.status).toBe(400)
  })

  it("should return 403 for non-admin users", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: ADMIN_UUID,
      isAdmin: false,
    } as any)

    const response = await PATCH(makePatchRequest({ userId: USER_UUID, action: "toggleBlocked" }))

    expect(response.status).toBe(403)
  })

  it("should return 401 when not logged in", async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await PATCH(makePatchRequest({ userId: USER_UUID, action: "toggleBlocked" }))

    expect(response.status).toBe(401)
  })

  it("should return 429 when rate limited", async () => {
    const { rateLimiters } = await import("@/lib/rate-limit")
    vi.mocked(rateLimiters.api).mockResolvedValueOnce(false)

    const response = await PATCH(makePatchRequest({ userId: USER_UUID, action: "toggleBlocked" }))

    expect(response.status).toBe(429)
  })
})
