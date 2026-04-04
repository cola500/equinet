/**
 * GET /api/widget/next-booking tests
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-dual", () => ({
  getAuthUser: vi.fn(),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findFirst: vi.fn() },
  },
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { GET } from "./route"
import { getAuthUser } from "@/lib/auth-dual"
import { prisma } from "@/lib/prisma"

const mockGetAuthUser = vi.mocked(getAuthUser)
const mockFindFirst = vi.mocked(prisma.booking.findFirst)

function createRequest() {
  return new NextRequest("http://localhost:3000/api/widget/next-booking", {
    method: "GET",
    headers: { Authorization: "Bearer valid-jwt-token" },
  })
}

const mockBooking = {
  id: "booking-1",
  bookingDate: new Date("2026-03-10"),
  startTime: "10:00",
  endTime: "11:00",
  status: "confirmed",
  horseName: "Blansen",
  customer: { firstName: "Anna", lastName: "Andersson" },
  service: { name: "Hovslagare" },
}

describe("GET /api/widget/next-booking", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAuthUser.mockResolvedValue({
      id: "provider-user-1", email: "test@test.se", userType: "provider", isAdmin: false, providerId: null, stableId: null, authMethod: "supabase" as const,
      tokenId: "token-1",
    })
    mockFindFirst.mockResolvedValue(mockBooking as never)
  })

  it("returns 401 when Bearer token is invalid", async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const res = await GET(createRequest())
    expect(res.status).toBe(401)
  })

  it("returns booking data on success", async () => {
    const res = await GET(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.booking).toBeDefined()
    expect(body.booking.id).toBe("booking-1")
    expect(body.booking.startTime).toBe("10:00")
    expect(body.booking.customer.firstName).toBe("Anna")
    expect(body.booking.service.name).toBe("Hovslagare")
    expect(body.updatedAt).toBeDefined()
  })

  it("returns null booking when no upcoming bookings", async () => {
    mockFindFirst.mockResolvedValue(null)
    const res = await GET(createRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.booking).toBeNull()
    expect(body.updatedAt).toBeDefined()
  })

  it("queries for confirmed/pending bookings sorted by date", async () => {
    await GET(createRequest())
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["confirmed", "pending"] },
        }),
        orderBy: [{ bookingDate: "asc" }, { startTime: "asc" }],
      })
    )
  })
})
