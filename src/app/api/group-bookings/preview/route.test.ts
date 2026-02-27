import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
import { auth } from "@/lib/auth-server"
import { NextRequest } from "next/server"
import { Result } from "@/domain/shared"
import { isFeatureEnabled } from "@/lib/feature-flags"

const mockIsFeatureEnabled = vi.mocked(isFeatureEnabled)

const TEST_UUIDS = {
  customer: "11111111-1111-4111-8111-111111111111",
}

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

const mockService = {
  getPreviewByCode: vi.fn(),
}

vi.mock("@/domain/group-booking/GroupBookingService", () => ({
  createGroupBookingService: () => mockService,
}))

describe("GET /api/group-bookings/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 404 when group_bookings feature flag is disabled", async () => {
    mockIsFeatureEnabled.mockResolvedValueOnce(false)
    const req = new NextRequest("http://localhost/api/group-bookings/preview?code=ABC")
    const res = await GET(req)
    expect(res.status).toBe(404)
    expect(mockIsFeatureEnabled).toHaveBeenCalledWith("group_bookings")
  })

  it("should return preview for valid invite code", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.customer, userType: "customer" },
    } as never)
    mockService.getPreviewByCode.mockResolvedValue(
      Result.ok({
        serviceType: "hovslagning",
        locationName: "Sollebrunn Ridklubb",
        address: "Stallvägen 1",
        dateFrom: new Date("2026-03-01"),
        dateTo: new Date("2026-03-07"),
        maxParticipants: 6,
        currentParticipants: 2,
        joinDeadline: null,
        notes: null,
        status: "open",
      })
    )

    const request = new NextRequest(
      "http://localhost:3000/api/group-bookings/preview?code=ABC12345"
    )
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.serviceType).toBe("hovslagning")
    expect(data.currentParticipants).toBe(2)
    expect(mockService.getPreviewByCode).toHaveBeenCalledWith("ABC12345")
  })

  it("should return 400 when code parameter is missing", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.customer, userType: "customer" },
    } as never)

    const request = new NextRequest(
      "http://localhost:3000/api/group-bookings/preview"
    )
    const response = await GET(request)

    expect(response.status).toBe(400)
  })

  it("should return 400 when code is too long", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.customer, userType: "customer" },
    } as never)

    const request = new NextRequest(
      "http://localhost:3000/api/group-bookings/preview?code=ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    )
    const response = await GET(request)

    expect(response.status).toBe(400)
  })

  it("should return 404 for unknown code", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.customer, userType: "customer" },
    } as never)
    mockService.getPreviewByCode.mockResolvedValue(
      Result.fail({
        type: "GROUP_BOOKING_NOT_FOUND",
        message: "Ogiltig inbjudningskod",
      })
    )

    const request = new NextRequest(
      "http://localhost:3000/api/group-bookings/preview?code=UNKNOWN1"
    )
    const response = await GET(request)

    expect(response.status).toBe(404)
  })

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )

    const request = new NextRequest(
      "http://localhost:3000/api/group-bookings/preview?code=ABC12345"
    )
    const response = await GET(request)

    expect(response.status).toBe(401)
  })
})
