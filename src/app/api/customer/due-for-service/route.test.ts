import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
import { auth } from "@/lib/auth-server"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth-server", () => ({
  auth: vi.fn(),
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn().mockResolvedValue(true),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(true),
}))

const mockGetForCustomer = vi.fn()
const mockGetForHorse = vi.fn()

vi.mock("@/domain/due-for-service/DueForServiceService", () => ({
  DueForServiceService: class {
    getForCustomer = mockGetForCustomer
    getForHorse = mockGetForHorse
  },
}))

const CUSTOMER_ID = "a0000000-0000-4000-a000-000000000001"
const HORSE_ID = "a0000000-0000-4000-a000-000000000002"

function makeRequest(params = "") {
  return new NextRequest(
    `http://localhost:3000/api/customer/due-for-service${params}`
  )
}

describe("GET /api/customer/due-for-service", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockResolvedValue({
      user: { id: CUSTOMER_ID, userType: "customer" },
    } as any)

    vi.mocked(isFeatureEnabled).mockResolvedValue(true)

    mockGetForCustomer.mockResolvedValue([])
    mockGetForHorse.mockResolvedValue([])
  })

  it("returns 401 for unauthenticated users", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Ej inloggad" }), { status: 401 })
    )

    const response = await GET(makeRequest())
    expect(response.status).toBe(401)
  })

  it("returns 403 for provider users", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "provider-user", userType: "provider" },
    } as any)

    const response = await GET(makeRequest())
    expect(response.status).toBe(403)
  })

  it("returns empty items when feature flag is disabled", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false)

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.items).toEqual([])
    expect(mockGetForCustomer).not.toHaveBeenCalled()
  })

  it("returns due-for-service items for customer", async () => {
    const items = [
      {
        horseId: "horse-1",
        horseName: "Blansen",
        serviceId: "service-1",
        serviceName: "Hovslagar",
        lastServiceDate: "2026-01-01T00:00:00.000Z",
        daysSinceService: 59,
        intervalWeeks: 6,
        dueDate: "2026-02-12T00:00:00.000Z",
        daysUntilDue: -17,
        status: "overdue",
      },
    ]
    mockGetForCustomer.mockResolvedValue(items)

    const response = await GET(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.items).toEqual(items)
    expect(mockGetForCustomer).toHaveBeenCalledWith(CUSTOMER_ID)
  })

  it("filters by horseId when query param is provided", async () => {
    const items = [
      {
        horseId: HORSE_ID,
        horseName: "Stella",
        status: "upcoming",
      },
    ]
    mockGetForHorse.mockResolvedValue(items)

    const response = await GET(makeRequest(`?horseId=${HORSE_ID}`))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.items).toEqual(items)
    expect(mockGetForHorse).toHaveBeenCalledWith(HORSE_ID, CUSTOMER_ID)
  })

  it("returns 404 when horse does not belong to customer", async () => {
    mockGetForHorse.mockResolvedValue(null)

    const response = await GET(makeRequest(`?horseId=${HORSE_ID}`))
    expect(response.status).toBe(404)
  })

  it("returns 400 for invalid horseId format", async () => {
    const response = await GET(makeRequest("?horseId=not-a-uuid"))
    expect(response.status).toBe(400)
  })
})
