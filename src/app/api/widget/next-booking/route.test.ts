/**
 * GET /api/widget/next-booking tests
 *
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { readFileSync } from "node:fs"
import { join } from "node:path"

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

// Shared contract fixture, also decoded by the iOS test (CalendarModelsTests).
const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "contracts/ios/widget-next-booking.json"), "utf-8")
) as {
  upcoming: { booking: Record<string, string | null>; updatedAt: string }
  empty: { booking: null; updatedAt: string }
}

// Database row shape (nested relations) that matches the fixture's booking.
const fb = fixture.upcoming.booking
const mockBooking = {
  id: fb.id,
  bookingDate: new Date(fb.bookingDate as string),
  startTime: fb.startTime,
  endTime: fb.endTime,
  status: fb.status,
  horseName: fb.horseName,
  customer: { firstName: fb.customerFirstName, lastName: fb.customerLastName },
  service: { name: fb.serviceName },
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
    expect(body.updatedAt).toBeDefined()
  })

  it("matches the shared contract fixture for an upcoming booking (flat format)", async () => {
    const res = await GET(createRequest())
    const body = await res.json()
    expect(new Date(body.updatedAt).toISOString()).toBe(body.updatedAt)
    expect({ ...body, updatedAt: fixture.upcoming.updatedAt }).toEqual(fixture.upcoming)
  })

  it("matches the shared contract fixture when there is no upcoming booking", async () => {
    mockFindFirst.mockResolvedValue(null)
    const res = await GET(createRequest())
    const body = await res.json()
    expect({ ...body, updatedAt: fixture.empty.updatedAt }).toEqual(fixture.empty)
  })

  it("returns horseName as null when the booking has no horse", async () => {
    mockFindFirst.mockResolvedValue({ ...mockBooking, horseName: null } as never)
    const res = await GET(createRequest())
    const body = await res.json()
    expect(body.booking.horseName).toBeNull()
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
