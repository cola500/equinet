import { describe, it, expect, beforeEach, vi } from "vitest"
import { GET } from "./route"
import { prisma } from "@/lib/prisma"
import * as rateLimit from "@/lib/rate-limit"

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

describe("GET /api/providers/[id]/availability", () => {
  const mockProviderId = "provider-123"

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimit.rateLimiters.api).mockResolvedValue(true)
    vi.mocked(prisma.provider.findUnique).mockResolvedValue({
      id: mockProviderId,
    } as any)
    // Default: no availability exception
    vi.mocked(prisma.availabilityException.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.booking.findMany).mockResolvedValue([])
  })

  function createRequest(date: string): Request {
    return new Request(
      `http://localhost/api/providers/${mockProviderId}/availability?date=${date}`
    )
  }

  describe("closed day via AvailabilityException", () => {
    it("should return isClosed when exception with isClosed=true exists", async () => {
      vi.mocked(prisma.availabilityException.findUnique).mockResolvedValue({
        isClosed: true,
        reason: "Semester",
        startTime: null,
        endTime: null,
      } as any)

      // Normal weekly schedule exists
      vi.mocked(prisma.availability.findFirst).mockResolvedValue({
        startTime: "08:00",
        endTime: "17:00",
        isClosed: false,
        isActive: true,
      } as any)

      const response = await GET(createRequest("2026-02-10") as any, {
        params: Promise.resolve({ id: mockProviderId }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.isClosed).toBe(true)
      expect(data.closedReason).toBe("Semester")
      expect(data.slots).toEqual([])
    })

    it("should use alternative hours from exception when isClosed=false", async () => {
      vi.mocked(prisma.availabilityException.findUnique).mockResolvedValue({
        isClosed: false,
        reason: null,
        startTime: "10:00",
        endTime: "14:00",
      } as any)

      // Normal weekly schedule is wider
      vi.mocked(prisma.availability.findFirst).mockResolvedValue({
        startTime: "08:00",
        endTime: "17:00",
        isClosed: false,
        isActive: true,
      } as any)

      const response = await GET(createRequest("2026-02-10") as any, {
        params: Promise.resolve({ id: mockProviderId }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.isClosed).toBe(false)
      expect(data.openingTime).toBe("10:00")
      expect(data.closingTime).toBe("14:00")
      // Slots should be within 10:00-14:00, not 08:00-17:00
      const slotTimes = data.slots.map((s: any) => s.startTime)
      expect(slotTimes).toContain("10:00")
      expect(slotTimes).not.toContain("08:00")
      expect(slotTimes).not.toContain("14:00") // 14:00+30min=14:30 > 14:00, so no slot starting at 14:00
    })

    it("should fall through to weekly schedule when no exception exists", async () => {
      vi.mocked(prisma.availabilityException.findUnique).mockResolvedValue(null)

      vi.mocked(prisma.availability.findFirst).mockResolvedValue({
        startTime: "08:00",
        endTime: "17:00",
        isClosed: false,
        isActive: true,
      } as any)

      const response = await GET(createRequest("2026-02-10") as any, {
        params: Promise.resolve({ id: mockProviderId }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.isClosed).toBe(false)
      expect(data.openingTime).toBe("08:00")
      expect(data.closingTime).toBe("17:00")
    })

    it("should return isClosed with no reason when reason is null", async () => {
      vi.mocked(prisma.availabilityException.findUnique).mockResolvedValue({
        isClosed: true,
        reason: null,
        startTime: null,
        endTime: null,
      } as any)

      vi.mocked(prisma.availability.findFirst).mockResolvedValue({
        startTime: "08:00",
        endTime: "17:00",
        isClosed: false,
        isActive: true,
      } as any)

      const response = await GET(createRequest("2026-02-10") as any, {
        params: Promise.resolve({ id: mockProviderId }),
      })

      const data = await response.json()
      expect(data.isClosed).toBe(true)
      expect(data.closedReason).toBeNull()
      expect(data.slots).toEqual([])
    })
  })
})
