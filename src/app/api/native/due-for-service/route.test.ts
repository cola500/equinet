import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/mobile-auth", () => ({
  authFromMobileToken: vi.fn(),
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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: { findUnique: vi.fn() },
    booking: { findMany: vi.fn() },
    horseServiceInterval: { findMany: vi.fn() },
    customerHorseServiceInterval: { findMany: vi.fn() },
  },
}))

import { GET } from "./route"
import { authFromMobileToken } from "@/lib/mobile-auth"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { prisma } from "@/lib/prisma"

const TEST_UUIDS = {
  userId: "a0000000-0000-4000-a000-000000000001",
  provider: "a0000000-0000-4000-a000-000000000002",
  horse1: "a0000000-0000-4000-a000-000000000003",
  horse2: "a0000000-0000-4000-a000-000000000004",
  customer1: "a0000000-0000-4000-a000-000000000005",
  service1: "a0000000-0000-4000-a000-000000000006",
}

const makeRequest = (params = "") =>
  new NextRequest(`http://localhost:3000/api/native/due-for-service${params}`)

describe("GET /api/native/due-for-service", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(authFromMobileToken).mockResolvedValue({
      userId: TEST_UUIDS.userId,
      tokenId: "token-1",
    })

    vi.mocked(isFeatureEnabled).mockResolvedValue(true)

    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: TEST_UUIDS.provider,
    } as never)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([])
    vi.mocked(prisma.horseServiceInterval.findMany).mockResolvedValue([])
    vi.mocked(prisma.customerHorseServiceInterval.findMany).mockResolvedValue([])
  })

  it("returns 401 when no token", async () => {
    vi.mocked(authFromMobileToken).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
  })

  it("returns 404 when feature flag disabled", async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false)
    const res = await GET(makeRequest())
    expect(res.status).toBe(404)
  })

  it("returns 404 when provider not found", async () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(404)
  })

  it("returns empty items for provider with no bookings", async () => {
    const res = await GET(makeRequest())
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.items).toEqual([])
  })

  it("returns items sorted by urgency (overdue first)", async () => {
    const now = new Date()
    const tenWeeksAgo = new Date(now)
    tenWeeksAgo.setDate(tenWeeksAgo.getDate() - 70)
    const threeWeeksAgo = new Date(now)
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        horseId: TEST_UUIDS.horse1,
        serviceId: TEST_UUIDS.service1,
        bookingDate: tenWeeksAgo,
        horse: { id: TEST_UUIDS.horse1, name: "Blansen" },
        customer: { firstName: "Anna", lastName: "Svensson" },
        service: { id: TEST_UUIDS.service1, name: "Hovslagning", recommendedIntervalWeeks: 6 },
      },
      {
        horseId: TEST_UUIDS.horse2,
        serviceId: TEST_UUIDS.service1,
        bookingDate: threeWeeksAgo,
        horse: { id: TEST_UUIDS.horse2, name: "Pransen" },
        customer: { firstName: "Anna", lastName: "Svensson" },
        service: { id: TEST_UUIDS.service1, name: "Hovslagning", recommendedIntervalWeeks: 6 },
      },
    ] as never)

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(data.items).toHaveLength(2)
    expect(data.items[0].horseName).toBe("Blansen")
    expect(data.items[0].status).toBe("overdue")
    expect(data.items[0].ownerName).toBe("Anna Svensson")
    expect(data.items[1].horseName).toBe("Pransen")
  })

  it("filters by overdue only", async () => {
    const now = new Date()
    const tenWeeksAgo = new Date(now)
    tenWeeksAgo.setDate(tenWeeksAgo.getDate() - 70)
    const threeWeeksAgo = new Date(now)
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        horseId: TEST_UUIDS.horse1,
        serviceId: TEST_UUIDS.service1,
        bookingDate: tenWeeksAgo,
        horse: { id: TEST_UUIDS.horse1, name: "Blansen" },
        customer: { firstName: "Anna", lastName: "Svensson" },
        service: { id: TEST_UUIDS.service1, name: "Hovslagning", recommendedIntervalWeeks: 6 },
      },
      {
        horseId: TEST_UUIDS.horse2,
        serviceId: TEST_UUIDS.service1,
        bookingDate: threeWeeksAgo,
        horse: { id: TEST_UUIDS.horse2, name: "Pransen" },
        customer: { firstName: "Anna", lastName: "Svensson" },
        service: { id: TEST_UUIDS.service1, name: "Hovslagning", recommendedIntervalWeeks: 6 },
      },
    ] as never)

    const res = await GET(makeRequest("?filter=overdue"))
    const data = await res.json()

    expect(data.items).toHaveLength(1)
    expect(data.items[0].horseName).toBe("Blansen")
  })

  it("deduplicates by horse+service, keeping latest booking", async () => {
    const now = new Date()
    const tenWeeksAgo = new Date(now)
    tenWeeksAgo.setDate(tenWeeksAgo.getDate() - 70)
    const twoWeeksAgo = new Date(now)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      {
        horseId: TEST_UUIDS.horse1,
        serviceId: TEST_UUIDS.service1,
        bookingDate: tenWeeksAgo,
        horse: { id: TEST_UUIDS.horse1, name: "Blansen" },
        customer: { firstName: "Anna", lastName: "Svensson" },
        service: { id: TEST_UUIDS.service1, name: "Hovslagning", recommendedIntervalWeeks: 6 },
      },
      {
        horseId: TEST_UUIDS.horse1,
        serviceId: TEST_UUIDS.service1,
        bookingDate: twoWeeksAgo,
        horse: { id: TEST_UUIDS.horse1, name: "Blansen" },
        customer: { firstName: "Anna", lastName: "Svensson" },
        service: { id: TEST_UUIDS.service1, name: "Hovslagning", recommendedIntervalWeeks: 6 },
      },
    ] as never)

    const res = await GET(makeRequest())
    const data = await res.json()

    expect(data.items).toHaveLength(1)
    expect(data.items[0].status).toBe("ok")
  })
})
