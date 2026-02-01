import { describe, it, expect, beforeEach, vi } from "vitest"
import { POST } from "./route"
import { auth } from "@/lib/auth-server"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"
import { Result } from "@/domain/shared"

const TEST_UUIDS = {
  providerUser: "11111111-1111-4111-8111-111111111111",
  provider: "22222222-2222-4222-8222-222222222222",
  service: "33333333-3333-4333-8333-333333333333",
  groupRequest: "44444444-4444-4444-8444-444444444444",
  customerUser: "55555555-5555-4555-8555-555555555555",
}

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { booking: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: { findUnique: vi.fn() },
    service: { findFirst: vi.fn() },
  },
}))

const mockService = {
  matchRequest: vi.fn(),
}

vi.mock("@/domain/group-booking/GroupBookingService", () => ({
  createGroupBookingService: () => mockService,
}))

const makeParams = (id: string) => Promise.resolve({ id })

describe("POST /api/group-bookings/[id]/match", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should match provider to group booking and create bookings", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.providerUser, userType: "provider" },
    } as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: TEST_UUIDS.provider,
    } as any)
    vi.mocked(prisma.service.findFirst).mockResolvedValue({
      id: TEST_UUIDS.service,
      durationMinutes: 60,
    } as any)
    mockService.matchRequest.mockResolvedValue(
      Result.ok({
        bookingsCreated: 3,
        errors: [],
      })
    )

    const request = new NextRequest(
      `http://localhost:3000/api/group-bookings/${TEST_UUIDS.groupRequest}/match`,
      {
        method: "POST",
        body: JSON.stringify({
          serviceId: TEST_UUIDS.service,
          bookingDate: "2026-02-15",
          startTime: "10:00",
        }),
      }
    )

    const response = await POST(request, { params: makeParams(TEST_UUIDS.groupRequest) })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.bookingsCreated).toBe(3)
  })

  it("should return 403 for non-provider users", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.customerUser, userType: "customer" },
    } as any)

    const request = new NextRequest(
      `http://localhost:3000/api/group-bookings/${TEST_UUIDS.groupRequest}/match`,
      {
        method: "POST",
        body: JSON.stringify({
          serviceId: TEST_UUIDS.service,
          bookingDate: "2026-02-15",
          startTime: "10:00",
        }),
      }
    )

    const response = await POST(request, { params: makeParams(TEST_UUIDS.groupRequest) })
    expect(response.status).toBe(403)
  })

  it("should return 400 when service not found", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.providerUser, userType: "provider" },
    } as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: TEST_UUIDS.provider,
    } as any)
    vi.mocked(prisma.service.findFirst).mockResolvedValue(null)

    const request = new NextRequest(
      `http://localhost:3000/api/group-bookings/${TEST_UUIDS.groupRequest}/match`,
      {
        method: "POST",
        body: JSON.stringify({
          serviceId: TEST_UUIDS.service,
          bookingDate: "2026-02-15",
          startTime: "10:00",
        }),
      }
    )

    const response = await POST(request, { params: makeParams(TEST_UUIDS.groupRequest) })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain("Tjänsten")
  })

  it("should return 400 when matching fails", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.providerUser, userType: "provider" },
    } as any)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: TEST_UUIDS.provider,
    } as any)
    vi.mocked(prisma.service.findFirst).mockResolvedValue({
      id: TEST_UUIDS.service,
      durationMinutes: 60,
    } as any)
    mockService.matchRequest.mockResolvedValue(
      Result.fail({
        type: 'GROUP_BOOKING_NOT_FOUND',
        message: 'Grupprequesten hittades inte eller är inte öppen',
      })
    )

    const request = new NextRequest(
      `http://localhost:3000/api/group-bookings/${TEST_UUIDS.groupRequest}/match`,
      {
        method: "POST",
        body: JSON.stringify({
          serviceId: TEST_UUIDS.service,
          bookingDate: "2026-02-15",
          startTime: "10:00",
        }),
      }
    )

    const response = await POST(request, { params: makeParams(TEST_UUIDS.groupRequest) })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toContain("hittades inte")
  })
})
