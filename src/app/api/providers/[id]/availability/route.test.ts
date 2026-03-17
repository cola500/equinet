import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
import { prisma } from "@/lib/prisma"
import * as rateLimit from "@/lib/rate-limit"
import { TravelTimeService } from "@/domain/booking/TravelTimeService"
import { Location } from "@/domain/shared/Location"

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
    },
    availability: {
      findFirst: vi.fn(),
    },
    availabilityException: {
      findUnique: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
    },
  },
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimiters: {
    api: vi.fn(),
  },
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
}))
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

const mockHasEnoughTravelTime = vi.fn()
vi.mock("@/domain/booking/TravelTimeService", () => ({
  TravelTimeService: vi.fn(),
}))
vi.mock("@/domain/shared/Location", () => ({
  Location: {
    create: vi.fn(),
  },
}))

describe("GET /api/providers/[id]/availability", () => {
  const mockProviderId = "provider-123"

  beforeEach(() => {
    vi.clearAllMocks()

    // Re-apply mock implementations after clearAllMocks
    vi.mocked(TravelTimeService).mockImplementation(function () {
      return { hasEnoughTravelTime: mockHasEnoughTravelTime } as never
    })
    vi.mocked(Location.create).mockReturnValue({
      isSuccess: true,
      value: { lat: 59.0, lng: 18.0 },
    } as never)
    mockHasEnoughTravelTime.mockReturnValue({ valid: true })

    vi.mocked(rateLimit.rateLimiters.api).mockResolvedValue(true)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
    } as never)
    vi.mocked(prisma.availabilityException.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])
  })

  function createRequest(queryString: string): Request {
    return new Request(
      `http://localhost/api/providers/${mockProviderId}/availability?${queryString}`
    )
  }

  function callGET(queryString: string) {
    return GET(createRequest(queryString) as never, {
      params: Promise.resolve({ id: mockProviderId }),
    })
  }

  /** Helper: set up a standard open day (future date, 08:00-17:00) */
  function setupOpenDay() {
    vi.mocked(prisma.availability.findFirst).mockResolvedValue({
      startTime: "08:00",
      endTime: "17:00",
      isClosed: false,
      isActive: true,
    } as never)
  }

  // ─── Parameter validation ──────────────────────────────────────────

  describe("parameter validation", () => {
    it("returns 400 without date parameter", async () => {
      const response = await callGET("")
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe("Datumparameter krävs")
    })

    it("returns 404 for non-existent provider", async () => {
      vi.mocked(prisma.provider.findUnique).mockResolvedValue(null)
      setupOpenDay()

      const response = await callGET("date=2027-06-15")
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe("Leverantör hittades inte")
    })

    it("returns 429 when rate limited", async () => {
      vi.mocked(rateLimit.rateLimiters.api).mockResolvedValue(false)

      const response = await callGET("date=2027-06-15")
      expect(response.status).toBe(429)
    })
  })

  // ─── Closed day ────────────────────────────────────────────────────

  describe("closed day", () => {
    it("returns isClosed when exception with isClosed=true exists", async () => {
      vi.mocked(prisma.availabilityException.findUnique).mockResolvedValue({
        isClosed: true,
        reason: "Semester",
        startTime: null,
        endTime: null,
      } as never)
      setupOpenDay()

      const response = await callGET("date=2026-02-10")
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.isClosed).toBe(true)
      expect(data.closedReason).toBe("Semester")
      expect(data.slots).toEqual([])
    })

    it("uses alternative hours from exception when isClosed=false", async () => {
      vi.mocked(prisma.availabilityException.findUnique).mockResolvedValue({
        isClosed: false,
        reason: null,
        startTime: "10:00",
        endTime: "14:00",
      } as never)
      setupOpenDay()

      const response = await callGET("date=2027-06-15")
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.isClosed).toBe(false)
      expect(data.openingTime).toBe("10:00")
      expect(data.closingTime).toBe("14:00")
      const slotTimes = data.slots.map((s: { startTime: string }) => s.startTime)
      expect(slotTimes).toContain("10:00")
      expect(slotTimes).not.toContain("08:00")
      expect(slotTimes).not.toContain("14:00")
    })

    it("falls through to weekly schedule when no exception exists", async () => {
      vi.mocked(prisma.availabilityException.findUnique).mockResolvedValue(null)
      setupOpenDay()

      const response = await callGET("date=2027-06-15")
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.isClosed).toBe(false)
      expect(data.openingTime).toBe("08:00")
      expect(data.closingTime).toBe("17:00")
    })

    it("returns isClosed with no reason when reason is null", async () => {
      vi.mocked(prisma.availabilityException.findUnique).mockResolvedValue({
        isClosed: true,
        reason: null,
        startTime: null,
        endTime: null,
      } as never)
      setupOpenDay()

      const response = await callGET("date=2026-02-10")
      const data = await response.json()
      expect(data.isClosed).toBe(true)
      expect(data.closedReason).toBeNull()
      expect(data.slots).toEqual([])
    })

    it("returns isClosed when no weekly schedule exists (availability=null)", async () => {
      vi.mocked(prisma.availability.findFirst).mockResolvedValue(null)

      const response = await callGET("date=2027-06-15")
      const data = await response.json()
      expect(data.isClosed).toBe(true)
      expect(data.slots).toEqual([])
    })

    it("returns isClosed when weekly schedule has isClosed=true", async () => {
      vi.mocked(prisma.availability.findFirst).mockResolvedValue({
        startTime: "08:00",
        endTime: "17:00",
        isClosed: true,
        isActive: true,
      } as never)

      const response = await callGET("date=2027-06-15")
      const data = await response.json()
      expect(data.isClosed).toBe(true)
      expect(data.slots).toEqual([])
    })
  })

  // ─── Slot generation ───────────────────────────────────────────────

  describe("slot generation", () => {
    it("generates 30-min slots within 08:00-17:00 (18 slots)", async () => {
      setupOpenDay()

      const response = await callGET("date=2027-06-15")
      const data = await response.json()

      expect(data.slots).toHaveLength(18)
      expect(data.slots[0].startTime).toBe("08:00")
      expect(data.slots[0].endTime).toBe("08:30")
      expect(data.slots[17].startTime).toBe("16:30")
      expect(data.slots[17].endTime).toBe("17:00")
    })

    it("generates slots with custom serviceDuration=60 (9 slots)", async () => {
      setupOpenDay()

      const response = await callGET("date=2027-06-15&serviceDuration=60")
      const data = await response.json()

      expect(data.slots).toHaveLength(9)
      expect(data.slots[0].startTime).toBe("08:00")
      expect(data.slots[0].endTime).toBe("09:00")
      expect(data.slots[8].startTime).toBe("16:00")
      expect(data.slots[8].endTime).toBe("17:00")
    })

    it("does not generate a slot that goes past closingTime", async () => {
      vi.mocked(prisma.availability.findFirst).mockResolvedValue({
        startTime: "08:00",
        endTime: "09:15",
        isClosed: false,
        isActive: true,
      } as never)

      const response = await callGET("date=2027-06-15")
      const data = await response.json()

      expect(data.slots).toHaveLength(2)
      expect(data.slots[1].endTime).toBe("09:00")
    })

    it("uses default serviceDuration=30 when parameter omitted", async () => {
      setupOpenDay()

      const response = await callGET("date=2027-06-15")
      const data = await response.json()

      expect(data.slots[0].startTime).toBe("08:00")
      expect(data.slots[0].endTime).toBe("08:30")
    })
  })

  // ─── Booking conflicts ────────────────────────────────────────────

  describe("booking conflicts", () => {
    it("marks booked slot as unavailable with reason 'booked'", async () => {
      setupOpenDay()
      vi.mocked(prisma.booking.findMany).mockResolvedValue([
        {
          id: "b1",
          startTime: "10:00",
          endTime: "10:30",
          customer: { latitude: null, longitude: null },
          service: { name: "Hovvård" },
        },
      ] as never)

      const response = await callGET("date=2027-06-15")
      const data = await response.json()

      const slot1000 = data.slots.find((s: { startTime: string }) => s.startTime === "10:00")
      expect(slot1000.isAvailable).toBe(false)
      expect(slot1000.unavailableReason).toBe("booked")

      const slot0930 = data.slots.find((s: { startTime: string }) => s.startTime === "09:30")
      expect(slot0930.isAvailable).toBe(true)
      const slot1030 = data.slots.find((s: { startTime: string }) => s.startTime === "10:30")
      expect(slot1030.isAvailable).toBe(true)
    })

    it("booking blocks overlapping slots", async () => {
      setupOpenDay()
      vi.mocked(prisma.booking.findMany).mockResolvedValue([
        {
          id: "b1",
          startTime: "10:00",
          endTime: "10:45",
          customer: { latitude: null, longitude: null },
          service: { name: "Hovvård" },
        },
      ] as never)

      const response = await callGET("date=2027-06-15")
      const data = await response.json()

      const slot1000 = data.slots.find((s: { startTime: string }) => s.startTime === "10:00")
      const slot1030 = data.slots.find((s: { startTime: string }) => s.startTime === "10:30")
      expect(slot1000.isAvailable).toBe(false)
      expect(slot1030.isAvailable).toBe(false)
    })

    it("handles multiple bookings on same day", async () => {
      setupOpenDay()
      vi.mocked(prisma.booking.findMany).mockResolvedValue([
        {
          id: "b1",
          startTime: "08:00",
          endTime: "08:30",
          customer: { latitude: null, longitude: null },
          service: { name: "Hovvård" },
        },
        {
          id: "b2",
          startTime: "12:00",
          endTime: "12:30",
          customer: { latitude: null, longitude: null },
          service: { name: "Sadelfixning" },
        },
      ] as never)

      const response = await callGET("date=2027-06-15")
      const data = await response.json()

      const slot0800 = data.slots.find((s: { startTime: string }) => s.startTime === "08:00")
      const slot1200 = data.slots.find((s: { startTime: string }) => s.startTime === "12:00")
      expect(slot0800.isAvailable).toBe(false)
      expect(slot1200.isAvailable).toBe(false)

      const slot0900 = data.slots.find((s: { startTime: string }) => s.startTime === "09:00")
      expect(slot0900.isAvailable).toBe(true)
    })
  })

  // ─── Past filtering ────────────────────────────────────────────────

  describe("past slot filtering", () => {
    it("marks all slots as unavailable with reason 'past' for past date", async () => {
      setupOpenDay()

      const response = await callGET("date=2020-01-01")
      const data = await response.json()

      const allUnavailable = data.slots.every((s: { isAvailable: boolean }) => !s.isAvailable)
      expect(allUnavailable).toBe(true)

      const allPast = data.slots.every(
        (s: { unavailableReason?: string }) => s.unavailableReason === "past"
      )
      expect(allPast).toBe(true)
    })
  })

  // ─── Travel time validation ────────────────────────────────────────

  describe("travel time validation", () => {
    it("marks slot as 'travel-time' unavailable when travel time insufficient", async () => {
      setupOpenDay()
      vi.mocked(prisma.booking.findMany).mockResolvedValue([
        {
          id: "b1",
          startTime: "10:00",
          endTime: "10:30",
          customer: { latitude: 59.3, longitude: 18.1 },
          service: { name: "Hovvård" },
        },
      ] as never)

      mockHasEnoughTravelTime.mockReturnValue({ valid: false, error: "Not enough time" })

      const response = await callGET("date=2027-06-15&lat=59.0&lng=18.0")
      const data = await response.json()

      const travelTimeSlots = data.slots.filter(
        (s: { unavailableReason?: string }) => s.unavailableReason === "travel-time"
      )
      expect(travelTimeSlots.length).toBeGreaterThan(0)
    })

    it("skips travel time validation when no customer location provided", async () => {
      setupOpenDay()
      vi.mocked(prisma.booking.findMany).mockResolvedValue([
        {
          id: "b1",
          startTime: "10:00",
          endTime: "10:30",
          customer: { latitude: 59.3, longitude: 18.1 },
          service: { name: "Hovvård" },
        },
      ] as never)

      const response = await callGET("date=2027-06-15")
      const data = await response.json()

      expect(mockHasEnoughTravelTime).not.toHaveBeenCalled()
      const slot0800 = data.slots.find((s: { startTime: string }) => s.startTime === "08:00")
      expect(slot0800.isAvailable).toBe(true)
    })
  })

  // ─── Response format & edge cases ──────────────────────────────────

  describe("response format and edge cases", () => {
    it("bookedSlots array contains serviceName for backwards compatibility", async () => {
      setupOpenDay()
      vi.mocked(prisma.booking.findMany).mockResolvedValue([
        {
          id: "b1",
          startTime: "10:00",
          endTime: "10:30",
          customer: { latitude: null, longitude: null },
          service: { name: "Hovvård" },
        },
      ] as never)

      const response = await callGET("date=2027-06-15")
      const data = await response.json()

      expect(data.bookedSlots).toHaveLength(1)
      expect(data.bookedSlots[0]).toEqual({
        startTime: "10:00",
        endTime: "10:30",
        serviceName: "Hovvård",
      })
    })

    it("calculates dayOfWeek correctly (Monday=0)", async () => {
      setupOpenDay()

      // 2027-06-15 is a Tuesday
      const response = await callGET("date=2027-06-15")
      const data = await response.json()
      expect(data.dayOfWeek).toBe(1) // Tuesday = 1

      // 2027-06-14 is a Monday
      const response2 = await callGET("date=2027-06-14")
      const data2 = await response2.json()
      expect(data2.dayOfWeek).toBe(0) // Monday = 0
    })

    it("returns 500 on database error", async () => {
      vi.mocked(prisma.provider.findUnique).mockRejectedValue(
        new Error("DB connection failed")
      )

      const response = await callGET("date=2027-06-15")
      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe("Kunde inte hämta tillgänglighet")
    })
  })
})
