import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
import { auth } from "@/lib/auth-server"
import { NextRequest } from "next/server"
import { Result } from "@/domain/shared"

const TEST_UUIDS = {
  providerUser: "11111111-1111-4111-8111-111111111111",
  provider: "22222222-2222-4222-8222-222222222222",
  customerUser: "33333333-3333-4333-8333-333333333333",
}

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: { api: vi.fn().mockResolvedValue(true) },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

const mockService = {
  listAvailableForProvider: vi.fn(),
}

vi.mock("@/domain/group-booking/GroupBookingService", () => ({
  createGroupBookingService: () => mockService,
}))

describe("GET /api/group-bookings/available", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return open group bookings for provider", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.providerUser, userType: "provider" },
    } as any)
    mockService.listAvailableForProvider.mockResolvedValue(
      Result.ok({
        provider: { id: TEST_UUIDS.provider },
        requests: [
          {
            id: "gr1",
            serviceType: "hovslagning",
            locationName: "Sollebrunn Ridklubb",
            status: "open",
            participants: [{ user: { firstName: "Anna" } }],
            _count: { participants: 1 },
          },
        ],
      })
    )

    const request = new NextRequest("http://localhost:3000/api/group-bookings/available")
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveLength(1)
    expect(data[0].serviceType).toBe("hovslagning")
  })

  it("should return 403 for non-provider users", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: TEST_UUIDS.customerUser, userType: "customer" },
    } as any)

    const request = new NextRequest("http://localhost:3000/api/group-bookings/available")
    const response = await GET(request)

    expect(response.status).toBe(403)
  })

  it("should return 401 when not authenticated", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )

    const request = new NextRequest("http://localhost:3000/api/group-bookings/available")
    const response = await GET(request)

    expect(response.status).toBe(401)
  })
})
