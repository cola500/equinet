import { describe, it, expect, vi, beforeEach } from "vitest"
import { DueForServiceService } from "./DueForServiceService"

const mockBookingFindMany = vi.fn()
const mockHorseServiceIntervalFindMany = vi.fn()
const mockCustomerHorseServiceIntervalFindMany = vi.fn()
const mockHorseFindFirst = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    booking: {
      findMany: (...args: unknown[]) => mockBookingFindMany(...args),
    },
    horseServiceInterval: {
      findMany: (...args: unknown[]) => mockHorseServiceIntervalFindMany(...args),
    },
    customerHorseServiceInterval: {
      findMany: (...args: unknown[]) => mockCustomerHorseServiceIntervalFindMany(...args),
    },
    horse: {
      findFirst: (...args: unknown[]) => mockHorseFindFirst(...args),
    },
  },
}))

const MS_PER_DAY = 1000 * 60 * 60 * 24
const NOW = new Date("2026-03-01T12:00:00Z")

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * MS_PER_DAY)
}

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    horseId: "horse-1",
    serviceId: "service-1",
    bookingDate: daysAgo(50),
    horse: { id: "horse-1", name: "Blansen" },
    service: { id: "service-1", name: "Hovslagar", recommendedIntervalWeeks: 6 },
    ...overrides,
  }
}

describe("DueForServiceService", () => {
  let service: DueForServiceService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new DueForServiceService(NOW)
    mockBookingFindMany.mockResolvedValue([])
    mockHorseServiceIntervalFindMany.mockResolvedValue([])
    mockCustomerHorseServiceIntervalFindMany.mockResolvedValue([])
    mockHorseFindFirst.mockResolvedValue(null)
  })

  describe("getForCustomer", () => {
    it("returns overdue horses for customer", async () => {
      mockBookingFindMany.mockResolvedValue([
        makeBooking({ bookingDate: daysAgo(50) }), // 50 days ago, 6-week (42 day) interval = overdue
      ])
      mockHorseServiceIntervalFindMany.mockResolvedValue([])

      const result = await service.getForCustomer("customer-1")

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe("overdue")
      expect(result[0].horseName).toBe("Blansen")
    })

    it("returns upcoming horses for customer", async () => {
      mockBookingFindMany.mockResolvedValue([
        makeBooking({ bookingDate: daysAgo(35) }), // 5 weeks ago, 6-week interval = 7 days left
      ])
      mockHorseServiceIntervalFindMany.mockResolvedValue([])

      const result = await service.getForCustomer("customer-1")

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe("upcoming")
    })

    it("filters out ok status (only returns overdue and upcoming)", async () => {
      mockBookingFindMany.mockResolvedValue([
        makeBooking({ bookingDate: daysAgo(14) }), // 2 weeks ago, 6-week interval = 28 days left = ok
      ])
      mockHorseServiceIntervalFindMany.mockResolvedValue([])

      const result = await service.getForCustomer("customer-1")

      expect(result).toHaveLength(0)
    })

    it("deduplicates keeping latest booking per horse+service", async () => {
      mockBookingFindMany.mockResolvedValue([
        makeBooking({ bookingDate: daysAgo(50) }), // older
        makeBooking({ bookingDate: daysAgo(30) }), // newer -- same horse+service
      ])
      mockHorseServiceIntervalFindMany.mockResolvedValue([])

      const result = await service.getForCustomer("customer-1")

      // Should use the newer booking (30 days ago, 6-week interval = 12 days left = upcoming)
      expect(result).toHaveLength(1)
      expect(result[0].daysSinceService).toBe(30)
    })

    it("applies horse-specific interval override (per service)", async () => {
      mockBookingFindMany.mockResolvedValue([
        makeBooking({ bookingDate: daysAgo(25) }), // 25 days ago
      ])
      mockHorseServiceIntervalFindMany.mockResolvedValue([
        { horseId: "horse-1", serviceId: "service-1", revisitIntervalWeeks: 3 }, // 3-week override = 21 days
      ])

      const result = await service.getForCustomer("customer-1")

      // 25 days ago with 3-week (21 day) interval = 4 days overdue
      expect(result).toHaveLength(1)
      expect(result[0].status).toBe("overdue")
      expect(result[0].intervalWeeks).toBe(3)
    })

    it("sorts by urgency (most overdue first)", async () => {
      mockBookingFindMany.mockResolvedValue([
        makeBooking({
          horseId: "horse-1",
          bookingDate: daysAgo(35), // upcoming
          horse: { id: "horse-1", name: "Blansen" },
        }),
        makeBooking({
          horseId: "horse-2",
          serviceId: "service-1",
          bookingDate: daysAgo(60), // very overdue
          horse: { id: "horse-2", name: "Stella" },
        }),
      ])
      mockHorseServiceIntervalFindMany.mockResolvedValue([])

      const result = await service.getForCustomer("customer-1")

      expect(result).toHaveLength(2)
      expect(result[0].horseName).toBe("Stella") // most overdue first
      expect(result[1].horseName).toBe("Blansen")
    })

    it("handles multiple services per horse", async () => {
      mockBookingFindMany.mockResolvedValue([
        makeBooking({
          serviceId: "service-1",
          bookingDate: daysAgo(50), // overdue for hovslagare
          service: { id: "service-1", name: "Hovslagar", recommendedIntervalWeeks: 6 },
        }),
        makeBooking({
          serviceId: "service-2",
          bookingDate: daysAgo(30), // upcoming for tandvard
          service: { id: "service-2", name: "Tandvard", recommendedIntervalWeeks: 6 },
        }),
      ])
      mockHorseServiceIntervalFindMany.mockResolvedValue([])

      const result = await service.getForCustomer("customer-1")

      expect(result).toHaveLength(2)
    })

    it("returns empty array when no bookings", async () => {
      mockBookingFindMany.mockResolvedValue([])

      const result = await service.getForCustomer("customer-1")

      expect(result).toHaveLength(0)
    })

    it("does not filter on recommendedIntervalWeeks", async () => {
      await service.getForCustomer("customer-1")

      const callArgs = mockBookingFindMany.mock.calls[0][0]
      // Should NOT have service: { recommendedIntervalWeeks: { not: null } }
      expect(callArgs.where.service).toBeUndefined()
    })

    it("ignores provider override for a different service", async () => {
      mockBookingFindMany.mockResolvedValue([
        makeBooking({ bookingDate: daysAgo(35) }), // 35 days ago, service-1
      ])
      mockHorseServiceIntervalFindMany.mockResolvedValue([
        { horseId: "horse-1", serviceId: "service-other", revisitIntervalWeeks: 3 }, // override for DIFFERENT service
      ])

      const result = await service.getForCustomer("customer-1")

      // Should use default 6-week interval (not the 3-week override for other service)
      // 35 days ago with 6-week (42 day) interval = 7 days left = upcoming
      expect(result).toHaveLength(1)
      expect(result[0].intervalWeeks).toBe(6)
      expect(result[0].status).toBe("upcoming")
    })

    // --- New: 3-tier priority with customerInterval ---

    it("customer interval trumps provider override and service default", async () => {
      mockBookingFindMany.mockResolvedValue([
        makeBooking({
          bookingDate: daysAgo(25),
          service: { id: "service-1", name: "Hovslagar", recommendedIntervalWeeks: 6 },
        }),
      ])
      mockHorseServiceIntervalFindMany.mockResolvedValue([
        { horseId: "horse-1", serviceId: "service-1", revisitIntervalWeeks: 4 },
      ])
      mockCustomerHorseServiceIntervalFindMany.mockResolvedValue([
        { horseId: "horse-1", serviceId: "service-1", intervalWeeks: 3 },
      ])

      const result = await service.getForCustomer("customer-1")

      expect(result).toHaveLength(1)
      expect(result[0].intervalWeeks).toBe(3)
      // 25 days ago with 3-week (21 day) interval = 4 days overdue
      expect(result[0].status).toBe("overdue")
    })

    it("service with null recommendedIntervalWeeks but customer interval set returns result", async () => {
      mockBookingFindMany.mockResolvedValue([
        makeBooking({
          bookingDate: daysAgo(25),
          service: { id: "service-1", name: "Hovslagar", recommendedIntervalWeeks: null },
        }),
      ])
      mockHorseServiceIntervalFindMany.mockResolvedValue([])
      mockCustomerHorseServiceIntervalFindMany.mockResolvedValue([
        { horseId: "horse-1", serviceId: "service-1", intervalWeeks: 3 },
      ])

      const result = await service.getForCustomer("customer-1")

      expect(result).toHaveLength(1)
      expect(result[0].intervalWeeks).toBe(3)
    })

    it("skips horse+service with no interval from any source", async () => {
      mockBookingFindMany.mockResolvedValue([
        makeBooking({
          bookingDate: daysAgo(25),
          service: { id: "service-1", name: "Hovslagar", recommendedIntervalWeeks: null },
        }),
      ])
      mockHorseServiceIntervalFindMany.mockResolvedValue([])
      mockCustomerHorseServiceIntervalFindMany.mockResolvedValue([])

      const result = await service.getForCustomer("customer-1")

      expect(result).toHaveLength(0)
    })
  })

  describe("getForHorse", () => {
    it("returns due status for a specific horse", async () => {
      mockHorseFindFirst.mockResolvedValue({ id: "horse-1", ownerId: "customer-1" })
      mockBookingFindMany.mockResolvedValue([
        makeBooking({ bookingDate: daysAgo(50) }),
      ])
      mockHorseServiceIntervalFindMany.mockResolvedValue([])

      const result = await service.getForHorse("horse-1", "customer-1")

      expect(result).toHaveLength(1)
      expect(result[0].horseId).toBe("horse-1")
    })

    it("returns null if horse does not belong to customer", async () => {
      mockHorseFindFirst.mockResolvedValue(null) // ownership check fails

      const result = await service.getForHorse("horse-1", "wrong-customer")

      expect(result).toBeNull()
    })

    it("filters bookings by horseId", async () => {
      mockHorseFindFirst.mockResolvedValue({ id: "horse-1", ownerId: "customer-1" })
      mockBookingFindMany.mockResolvedValue([])

      await service.getForHorse("horse-1", "customer-1")

      expect(mockBookingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            horseId: "horse-1",
          }),
        })
      )
    })
  })
})
