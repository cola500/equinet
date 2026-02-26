import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET, PUT, DELETE } from "./route"
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

const mockHorseFindFirst = vi.fn()
const mockIntervalFindMany = vi.fn()
const mockIntervalUpsert = vi.fn()
const mockIntervalDelete = vi.fn()
const mockServiceFindUnique = vi.fn()
const mockBookingFindMany = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    horse: {
      findFirst: (...args: unknown[]) => mockHorseFindFirst(...args),
    },
    customerHorseServiceInterval: {
      findMany: (...args: unknown[]) => mockIntervalFindMany(...args),
      upsert: (...args: unknown[]) => mockIntervalUpsert(...args),
      delete: (...args: unknown[]) => mockIntervalDelete(...args),
    },
    service: {
      findUnique: (...args: unknown[]) => mockServiceFindUnique(...args),
    },
    booking: {
      findMany: (...args: unknown[]) => mockBookingFindMany(...args),
    },
  },
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

const CUSTOMER_ID = "a0000000-0000-4000-a000-000000000001"
const HORSE_ID = "a0000000-0000-4000-a000-000000000002"
const SERVICE_ID = "a0000000-0000-4000-a000-000000000003"

const makeContext = () => ({
  params: Promise.resolve({ horseId: HORSE_ID }),
})

function makeGetRequest() {
  return new NextRequest(
    `http://localhost:3000/api/customer/horses/${HORSE_ID}/intervals`
  )
}

function makePutRequest(body: unknown) {
  return new NextRequest(
    `http://localhost:3000/api/customer/horses/${HORSE_ID}/intervals`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
}

function makeDeleteRequest(body: unknown) {
  return new NextRequest(
    `http://localhost:3000/api/customer/horses/${HORSE_ID}/intervals`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )
}

describe("Customer Horse Intervals API", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(auth).mockResolvedValue({
      user: { id: CUSTOMER_ID, userType: "customer" },
    } as never)

    vi.mocked(isFeatureEnabled).mockResolvedValue(true)

    mockHorseFindFirst.mockResolvedValue({ id: HORSE_ID, ownerId: CUSTOMER_ID })
    mockIntervalFindMany.mockResolvedValue([])
    mockIntervalUpsert.mockResolvedValue({
      id: "interval-1",
      horseId: HORSE_ID,
      serviceId: SERVICE_ID,
      intervalWeeks: 6,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    mockServiceFindUnique.mockResolvedValue({ id: SERVICE_ID, name: "Hovslagare" })
    mockBookingFindMany.mockResolvedValue([])
  })

  // --- Auth & Guards ---

  it("returns 401 for unauthenticated users", async () => {
    vi.mocked(auth).mockRejectedValue(
      new Response(JSON.stringify({ error: "Ej inloggad" }), { status: 401 })
    )

    const response = await GET(makeGetRequest(), makeContext())
    expect(response.status).toBe(401)
  })

  it("returns 403 for provider users", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "provider-user", userType: "provider" },
    } as never)

    const response = await GET(makeGetRequest(), makeContext())
    expect(response.status).toBe(403)
  })

  it("returns empty items when feature flag is disabled", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false)

    const response = await GET(makeGetRequest(), makeContext())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.intervals).toEqual([])
  })

  it("returns 404 when horse does not belong to customer", async () => {
    mockHorseFindFirst.mockResolvedValue(null)

    const response = await GET(makeGetRequest(), makeContext())
    expect(response.status).toBe(404)
  })

  // --- GET ---

  describe("GET", () => {
    it("returns empty list when no intervals set", async () => {
      mockIntervalFindMany.mockResolvedValue([])

      const response = await GET(makeGetRequest(), makeContext())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.intervals).toEqual([])
    })

    it("returns availableServices from booking history", async () => {
      mockBookingFindMany.mockResolvedValue([
        { service: { id: SERVICE_ID, name: "Hovslagare", recommendedIntervalWeeks: 8 } },
        { service: { id: SERVICE_ID, name: "Hovslagare", recommendedIntervalWeeks: 8 } },
        { service: { id: "a0000000-0000-4000-a000-000000000004", name: "Tandvård", recommendedIntervalWeeks: 26 } },
      ])

      const response = await GET(makeGetRequest(), makeContext())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.availableServices).toHaveLength(2)
      expect(data.availableServices[0]).toEqual({
        id: SERVICE_ID,
        name: "Hovslagare",
        recommendedIntervalWeeks: 8,
      })
      expect(data.availableServices[1]).toEqual({
        id: "a0000000-0000-4000-a000-000000000004",
        name: "Tandvård",
        recommendedIntervalWeeks: 26,
      })
    })

    it("returns empty availableServices when no bookings exist", async () => {
      mockBookingFindMany.mockResolvedValue([])

      const response = await GET(makeGetRequest(), makeContext())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.availableServices).toEqual([])
    })

    it("returns intervals with service info", async () => {
      mockIntervalFindMany.mockResolvedValue([
        {
          id: "interval-1",
          serviceId: SERVICE_ID,
          intervalWeeks: 6,
          service: { id: SERVICE_ID, name: "Hovslagare", recommendedIntervalWeeks: 8 },
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        },
      ])

      const response = await GET(makeGetRequest(), makeContext())
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.intervals).toHaveLength(1)
      expect(data.intervals[0].intervalWeeks).toBe(6)
      expect(data.intervals[0].service.name).toBe("Hovslagare")
    })
  })

  // --- PUT ---

  describe("PUT", () => {
    it("creates new interval", async () => {
      const response = await PUT(
        makePutRequest({ serviceId: SERVICE_ID, intervalWeeks: 6 }),
        makeContext()
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.intervalWeeks).toBe(6)
      expect(mockIntervalUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { horseId_serviceId: { horseId: HORSE_ID, serviceId: SERVICE_ID } },
        })
      )
    })

    it("returns 400 for invalid JSON", async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/customer/horses/${HORSE_ID}/intervals`,
        { method: "PUT", body: "not json" }
      )

      const response = await PUT(request, makeContext())
      expect(response.status).toBe(400)
    })

    it("returns 400 for intervalWeeks below 1", async () => {
      const response = await PUT(
        makePutRequest({ serviceId: SERVICE_ID, intervalWeeks: 0 }),
        makeContext()
      )
      expect(response.status).toBe(400)
    })

    it("returns 400 for intervalWeeks above 104", async () => {
      const response = await PUT(
        makePutRequest({ serviceId: SERVICE_ID, intervalWeeks: 105 }),
        makeContext()
      )
      expect(response.status).toBe(400)
    })

    it("returns 400 for missing serviceId", async () => {
      const response = await PUT(
        makePutRequest({ intervalWeeks: 6 }),
        makeContext()
      )
      expect(response.status).toBe(400)
    })

    it("returns 400 for extra fields (strict)", async () => {
      const response = await PUT(
        makePutRequest({ serviceId: SERVICE_ID, intervalWeeks: 6, extra: "hack" }),
        makeContext()
      )
      expect(response.status).toBe(400)
    })
  })

  // --- DELETE ---

  describe("DELETE", () => {
    it("deletes interval successfully", async () => {
      mockIntervalDelete.mockResolvedValue({})

      const response = await DELETE(
        makeDeleteRequest({ serviceId: SERVICE_ID }),
        makeContext()
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it("returns 404 when interval does not exist (P2025)", async () => {
      const prismaError = Object.assign(new Error("Record not found"), { code: "P2025" });
      mockIntervalDelete.mockRejectedValue(prismaError)

      const response = await DELETE(
        makeDeleteRequest({ serviceId: SERVICE_ID }),
        makeContext()
      )
      expect(response.status).toBe(404)
    })

    it("returns 400 for missing serviceId", async () => {
      const response = await DELETE(
        makeDeleteRequest({}),
        makeContext()
      )
      expect(response.status).toBe(400)
    })
  })
})
