import { describe, it, expect, beforeEach, vi } from "vitest"
import { PrismaDueForServiceLookup } from "./DueForServiceLookup"

// Mock Prisma
const mockPrisma = {
  booking: { findMany: vi.fn() },
  horseServiceInterval: { findMany: vi.fn() },
  customerHorseServiceInterval: { findMany: vi.fn() },
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: { findMany: vi.fn() },
    horseServiceInterval: { findMany: vi.fn() },
    customerHorseServiceInterval: { findMany: vi.fn() },
  },
}))

// Import after mock to get the mocked version
import { prisma } from "@/lib/prisma"

const NOW = new Date("2026-03-01")

function createLookup() {
  return new PrismaDueForServiceLookup(NOW)
}

// Helper: booking completed X weeks ago
function completedBooking(overrides: {
  customerId: string
  horseId: string
  horseName: string
  serviceId: string
  serviceName: string
  weeksAgo: number
  recommendedIntervalWeeks: number | null
}) {
  const bookingDate = new Date(NOW)
  bookingDate.setDate(bookingDate.getDate() - overrides.weeksAgo * 7)

  return {
    customerId: overrides.customerId,
    horseId: overrides.horseId,
    serviceId: overrides.serviceId,
    bookingDate,
    horse: { id: overrides.horseId, name: overrides.horseName },
    service: {
      id: overrides.serviceId,
      name: overrides.serviceName,
      recommendedIntervalWeeks: overrides.recommendedIntervalWeeks,
    },
  }
}

describe("PrismaDueForServiceLookup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])
    vi.mocked(prisma.horseServiceInterval.findMany).mockResolvedValue([])
    vi.mocked(prisma.customerHorseServiceInterval.findMany).mockResolvedValue([])
  })

  it("should return empty Map for empty customerIds", async () => {
    const lookup = createLookup()
    const result = await lookup.getOverdueHorsesForCustomers([])
    expect(result.size).toBe(0)
    expect(prisma.booking.findMany).not.toHaveBeenCalled()
  })

  it("should return overdue horse info for a customer", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      completedBooking({
        customerId: "c1",
        horseId: "h1",
        horseName: "Blansen",
        serviceId: "s1",
        serviceName: "Hovvård",
        weeksAgo: 10,
        recommendedIntervalWeeks: 8,
      }),
    ] as any)

    const lookup = createLookup()
    const result = await lookup.getOverdueHorsesForCustomers(["c1"])

    expect(result.has("c1")).toBe(true)
    const items = result.get("c1")!
    expect(items).toHaveLength(1)
    expect(items[0].horseName).toBe("Blansen")
    expect(items[0].serviceName).toBe("Hovvård")
    expect(items[0].daysOverdue).toBe(14) // 10 weeks - 8 weeks = 2 weeks = 14 days
  })

  it("should not include customer without overdue horses", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      completedBooking({
        customerId: "c1",
        horseId: "h1",
        horseName: "Blansen",
        serviceId: "s1",
        serviceName: "Hovvård",
        weeksAgo: 4, // 4 weeks ago, interval 8 weeks -- not overdue
        recommendedIntervalWeeks: 8,
      }),
    ] as any)

    const lookup = createLookup()
    const result = await lookup.getOverdueHorsesForCustomers(["c1"])

    expect(result.has("c1")).toBe(false)
  })

  it("should handle two customers, one with overdue horse", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      completedBooking({
        customerId: "c1",
        horseId: "h1",
        horseName: "Blansen",
        serviceId: "s1",
        serviceName: "Hovvård",
        weeksAgo: 10, // overdue (10 > 8)
        recommendedIntervalWeeks: 8,
      }),
      completedBooking({
        customerId: "c2",
        horseId: "h2",
        horseName: "Stella",
        serviceId: "s1",
        serviceName: "Hovvård",
        weeksAgo: 4, // not overdue (4 < 8)
        recommendedIntervalWeeks: 8,
      }),
    ] as any)

    const lookup = createLookup()
    const result = await lookup.getOverdueHorsesForCustomers(["c1", "c2"])

    expect(result.has("c1")).toBe(true)
    expect(result.has("c2")).toBe(false)
  })

  it("should dedup: keep latest booking per (horseId, serviceId)", async () => {
    const olderBooking = completedBooking({
      customerId: "c1",
      horseId: "h1",
      horseName: "Blansen",
      serviceId: "s1",
      serviceName: "Hovvård",
      weeksAgo: 20, // very old
      recommendedIntervalWeeks: 8,
    })
    const newerBooking = completedBooking({
      customerId: "c1",
      horseId: "h1",
      horseName: "Blansen",
      serviceId: "s1",
      serviceName: "Hovvård",
      weeksAgo: 4, // recent -- not overdue
      recommendedIntervalWeeks: 8,
    })

    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      olderBooking,
      newerBooking,
    ] as any)

    const lookup = createLookup()
    const result = await lookup.getOverdueHorsesForCustomers(["c1"])

    // Newer booking is 4 weeks ago (not overdue), so c1 should NOT be in result
    expect(result.has("c1")).toBe(false)
  })

  it("should use provider override interval", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      completedBooking({
        customerId: "c1",
        horseId: "h1",
        horseName: "Blansen",
        serviceId: "s1",
        serviceName: "Hovvård",
        weeksAgo: 5,
        recommendedIntervalWeeks: 8, // default: 8 weeks -- not overdue
      }),
    ] as any)

    // Provider override: 4 weeks -- now overdue
    vi.mocked(prisma.horseServiceInterval.findMany).mockResolvedValue([
      { horseId: "h1", revisitIntervalWeeks: 4 },
    ] as any)

    const lookup = createLookup()
    const result = await lookup.getOverdueHorsesForCustomers(["c1"])

    expect(result.has("c1")).toBe(true)
    expect(result.get("c1")![0].daysOverdue).toBe(7) // 5 weeks - 4 weeks = 1 week = 7 days
  })

  it("should use customer interval (trumps provider override)", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      completedBooking({
        customerId: "c1",
        horseId: "h1",
        horseName: "Blansen",
        serviceId: "s1",
        serviceName: "Hovvård",
        weeksAgo: 5,
        recommendedIntervalWeeks: 8, // default: not overdue
      }),
    ] as any)

    // Provider override: 4 weeks -- would be overdue
    vi.mocked(prisma.horseServiceInterval.findMany).mockResolvedValue([
      { horseId: "h1", revisitIntervalWeeks: 4 },
    ] as any)

    // Customer interval: 6 weeks -- overrides provider, not overdue
    vi.mocked(prisma.customerHorseServiceInterval.findMany).mockResolvedValue([
      { horseId: "h1", serviceId: "s1", intervalWeeks: 6 },
    ] as any)

    const lookup = createLookup()
    const result = await lookup.getOverdueHorsesForCustomers(["c1"])

    // Customer set 6 weeks, booking was 5 weeks ago -- not overdue
    expect(result.has("c1")).toBe(false)
  })

  it("should sort most overdue first", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      completedBooking({
        customerId: "c1",
        horseId: "h1",
        horseName: "Blansen",
        serviceId: "s1",
        serviceName: "Hovvård",
        weeksAgo: 10, // 2 weeks overdue
        recommendedIntervalWeeks: 8,
      }),
      completedBooking({
        customerId: "c1",
        horseId: "h2",
        horseName: "Stella",
        serviceId: "s1",
        serviceName: "Hovvård",
        weeksAgo: 16, // 8 weeks overdue
        recommendedIntervalWeeks: 8,
      }),
    ] as any)

    const lookup = createLookup()
    const result = await lookup.getOverdueHorsesForCustomers(["c1"])

    const items = result.get("c1")!
    expect(items).toHaveLength(2)
    expect(items[0].horseName).toBe("Stella") // most overdue first
    expect(items[1].horseName).toBe("Blansen")
  })

  it("should skip horse with no interval from any source", async () => {
    vi.mocked(prisma.booking.findMany).mockResolvedValue([
      completedBooking({
        customerId: "c1",
        horseId: "h1",
        horseName: "Blansen",
        serviceId: "s1",
        serviceName: "Hovvård",
        weeksAgo: 10,
        recommendedIntervalWeeks: null, // no default interval
      }),
    ] as any)

    const lookup = createLookup()
    const result = await lookup.getOverdueHorsesForCustomers(["c1"])

    expect(result.has("c1")).toBe(false)
  })
})
