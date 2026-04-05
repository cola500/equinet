import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

const mockGetAuthUser = vi.fn()
vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    review: {
      groupBy: vi.fn(),
    },
    notification: {
      create: vi.fn(),
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

import { GET, PATCH } from "./route"
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

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(adminUser)
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
    ] as never)
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
    mockGetAuthUser.mockResolvedValue({ ...adminUser, isAdmin: false })

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

  it("returns correct averageRating using database aggregation", async () => {
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
          id: "prov-1",
          businessName: "Hästkliniken",
          isVerified: true,
          isActive: true,
          city: "Stockholm",
          _count: { bookings: 15, services: 3 },
          fortnoxConnection: { id: "fc-1" },
        },
      },
    ] as never)
    vi.mocked(prisma.user.count).mockResolvedValue(1)
    vi.mocked(prisma.review.groupBy).mockResolvedValue([
      { providerId: "prov-1", _avg: { rating: 4.5 }, _count: { _all: 2 } },
    ] as never)

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
    expect(prisma.review.groupBy).toHaveBeenCalledWith({
      by: ["providerId"],
      where: { providerId: { in: ["prov-1"] } },
      _avg: { rating: true },
      _count: { _all: true },
    })
  })

  it("handles providers with 0 reviews (null rating)", async () => {
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
          id: "prov-2",
          businessName: "Ny Klinik",
          isVerified: false,
          isActive: true,
          city: null,
          _count: { bookings: 0, services: 0 },
          fortnoxConnection: null,
        },
      },
    ] as never)
    vi.mocked(prisma.user.count).mockResolvedValue(1)
    // groupBy returns empty array when no reviews exist
    vi.mocked(prisma.review.groupBy).mockResolvedValue([] as never)

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

const adminUserPatch = {
  id: ADMIN_UUID,
  email: "admin@test.se",
  userType: "customer",
  isAdmin: true,
  providerId: null,
  stableId: null,
  authMethod: "supabase" as const,
}

describe("PATCH /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue(adminUserPatch)
  })

  function makePatchRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost:3000/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    })
  }

  it("should toggle isBlocked on a user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: USER_UUID,
      isBlocked: false,
      isAdmin: false,
    } as never)
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: USER_UUID,
      isBlocked: true,
    } as never)
    vi.mocked(prisma.notification.create).mockResolvedValue({} as never)

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
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: USER2_UUID,
      isBlocked: false,
      isAdmin: false,
    } as never)
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: USER2_UUID,
      isAdmin: true,
    } as never)

    const response = await PATCH(makePatchRequest({ userId: USER2_UUID, action: "toggleAdmin" }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.isAdmin).toBe(true)
  })

  it("should not allow blocking yourself", async () => {
    const response = await PATCH(makePatchRequest({ userId: ADMIN_UUID, action: "toggleBlocked" }))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toMatch(/dig själv/)
  })

  it("should not allow removing own admin", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: ADMIN_UUID,
      isBlocked: false,
      isAdmin: true,
    } as never)

    const response = await PATCH(makePatchRequest({ userId: ADMIN_UUID, action: "toggleAdmin" }))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toMatch(/egen admin/)
  })

  it("should return 404 for non-existent userId", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const response = await PATCH(makePatchRequest({ userId: NONEXISTENT_UUID, action: "toggleBlocked" }))

    expect(response.status).toBe(404)
  })

  it("should return 400 for invalid action (Zod)", async () => {
    const response = await PATCH(makePatchRequest({ userId: USER_UUID, action: "deleteUser" }))

    expect(response.status).toBe(400)
  })

  it("should return 403 for non-admin users", async () => {
    mockGetAuthUser.mockResolvedValue({ ...adminUserPatch, isAdmin: false })

    const response = await PATCH(makePatchRequest({ userId: USER_UUID, action: "toggleBlocked" }))

    expect(response.status).toBe(403)
  })

  it("should return 401 when not logged in", async () => {
    mockGetAuthUser.mockResolvedValue(null)

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
