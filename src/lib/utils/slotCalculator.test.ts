import { describe, it, expect } from "vitest"
import {
  calculateAvailableSlots,
  TimeSlot,
  BookedSlot,
} from "./slotCalculator"

describe("slotCalculator", () => {
  describe("calculateAvailableSlots", () => {
    it("generates slots at 15-minute intervals", () => {
      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "10:00",
        bookedSlots: [],
        serviceDurationMinutes: 30,
      })

      // Should have slots at 09:00, 09:15, 09:30 (09:45 would end at 10:15)
      expect(slots).toHaveLength(3)
      expect(slots.map((s) => s.startTime)).toEqual(["09:00", "09:15", "09:30"])
    })

    it("marks slots as unavailable when they overlap with booked slots", () => {
      const bookedSlots: BookedSlot[] = [
        { startTime: "09:30", endTime: "10:00" },
      ]

      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "11:00",
        bookedSlots,
        serviceDurationMinutes: 30,
      })

      // 09:00 - available (ends 09:30, before booking starts)
      // 09:15 - unavailable (ends 09:45, overlaps with 09:30-10:00)
      // 09:30 - unavailable (booking starts at 09:30)
      // 09:45 - unavailable (overlaps with booking)
      // 10:00 - available (booking ends at 10:00)
      // 10:15 - available
      // 10:30 - available

      const available = slots.filter((s) => s.isAvailable)
      const unavailable = slots.filter((s) => !s.isAvailable)

      expect(available.map((s) => s.startTime)).toEqual([
        "09:00",
        "10:00",
        "10:15",
        "10:30",
      ])
      expect(unavailable.map((s) => s.startTime)).toEqual([
        "09:15",
        "09:30",
        "09:45",
      ])
    })

    it("calculates endTime based on service duration", () => {
      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "10:00",
        bookedSlots: [],
        serviceDurationMinutes: 45,
      })

      // Only 09:00 and 09:15 fit (09:30 would end at 10:15)
      expect(slots).toHaveLength(2)
      expect(slots[0]).toEqual({
        startTime: "09:00",
        endTime: "09:45",
        isAvailable: true,
      })
      expect(slots[1]).toEqual({
        startTime: "09:15",
        endTime: "10:00",
        isAvailable: true,
      })
    })

    it("returns empty array if opening equals closing", () => {
      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "09:00",
        bookedSlots: [],
        serviceDurationMinutes: 30,
      })

      expect(slots).toEqual([])
    })

    it("handles multiple booked slots", () => {
      const bookedSlots: BookedSlot[] = [
        { startTime: "09:00", endTime: "09:30" },
        { startTime: "10:00", endTime: "10:30" },
      ]

      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "11:00",
        bookedSlots,
        serviceDurationMinutes: 30,
      })

      const available = slots.filter((s) => s.isAvailable)
      // 09:30 ends at 10:00 - OK (exactly at booking start, no overlap)
      // 09:45 ends at 10:15 - overlaps with 10:00-10:30
      // 10:30 ends at 11:00 - OK (after booking ends)
      expect(available.map((s) => s.startTime)).toEqual(["09:30", "10:30"])
    })

    it("handles service duration longer than slot interval", () => {
      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "10:30",
        bookedSlots: [],
        serviceDurationMinutes: 60,
      })

      // 09:00 -> 10:00, 09:15 -> 10:15, 09:30 -> 10:30
      expect(slots).toHaveLength(3)
      expect(slots[2].endTime).toBe("10:30")
    })

    it("excludes slots that would extend past closing time", () => {
      const slots = calculateAvailableSlots({
        openingTime: "16:00",
        closingTime: "17:00",
        bookedSlots: [],
        serviceDurationMinutes: 30,
      })

      // Last valid slot starts at 16:30 (ends 17:00)
      const lastSlot = slots[slots.length - 1]
      expect(lastSlot.startTime).toBe("16:30")
      expect(lastSlot.endTime).toBe("17:00")
    })

    it("marks past slots as unavailable when date and currentDateTime provided", () => {
      // It's 10:30 on 2026-01-29
      const currentDateTime = new Date("2026-01-29T10:30:00")

      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "12:00",
        bookedSlots: [],
        serviceDurationMinutes: 30,
        date: "2026-01-29",
        currentDateTime,
      })

      const available = slots.filter((s) => s.isAvailable)
      // Slots at 09:00, 09:15, 09:30, 09:45, 10:00, 10:15 are in the past
      // First available should be 10:30 or later
      expect(available[0].startTime).toBe("10:30")
    })

    it("marks all slots as unavailable for past dates", () => {
      // It's 2026-01-30, checking slots for 2026-01-29 (yesterday)
      const currentDateTime = new Date("2026-01-30T10:00:00")

      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "17:00",
        bookedSlots: [],
        serviceDurationMinutes: 30,
        date: "2026-01-29",
        currentDateTime,
      })

      const available = slots.filter((s) => s.isAvailable)
      expect(available).toHaveLength(0)
    })

    it("allows all slots for future dates", () => {
      // It's 2026-01-29, checking slots for 2026-01-30 (tomorrow)
      const currentDateTime = new Date("2026-01-29T15:00:00")

      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "10:00",
        bookedSlots: [],
        serviceDurationMinutes: 30,
        date: "2026-01-30",
        currentDateTime,
      })

      const available = slots.filter((s) => s.isAvailable)
      // All 3 slots should be available
      expect(available).toHaveLength(3)
    })

    it("works without date/currentDateTime (backwards compatible)", () => {
      // Old behavior - no date filtering
      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "10:00",
        bookedSlots: [],
        serviceDurationMinutes: 30,
      })

      const available = slots.filter((s) => s.isAvailable)
      expect(available).toHaveLength(3)
    })
  })
})
