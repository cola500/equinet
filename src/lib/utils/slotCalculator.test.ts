import { describe, it, expect } from "vitest"
import {
  calculateAvailableSlots,
  BookedSlot,
  timeToMinutes,
  minutesToTime,
} from "./slotCalculator"

describe("slotCalculator", () => {
  // ─── timeToMinutes / minutesToTime ─────────────────────────────────

  describe("timeToMinutes", () => {
    it("converts 08:00 to 480", () => {
      expect(timeToMinutes("08:00")).toBe(480)
    })

    it("converts 17:30 to 1050", () => {
      expect(timeToMinutes("17:30")).toBe(1050)
    })
  })

  describe("minutesToTime", () => {
    it("converts 480 to 08:00", () => {
      expect(minutesToTime(480)).toBe("08:00")
    })

    it("converts 1050 to 17:30", () => {
      expect(minutesToTime(1050)).toBe("17:30")
    })
  })

  // ─── calculateAvailableSlots ───────────────────────────────────────

  describe("calculateAvailableSlots", () => {
    it("generates slots at service duration intervals by default", () => {
      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "11:00",
        bookedSlots: [],
        serviceDurationMinutes: 30,
      })

      expect(slots).toHaveLength(4)
      expect(slots.map((s) => s.startTime)).toEqual(["09:00", "09:30", "10:00", "10:30"])
    })

    it("generates slots at custom interval when slotInterval is specified", () => {
      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "10:00",
        bookedSlots: [],
        serviceDurationMinutes: 30,
        slotInterval: 15,
      })

      expect(slots).toHaveLength(3)
      expect(slots.map((s) => s.startTime)).toEqual(["09:00", "09:15", "09:30"])
    })

    it("marks slots as unavailable with reason 'booked' when they overlap", () => {
      const bookedSlots: BookedSlot[] = [
        { startTime: "09:30", endTime: "10:00" },
      ]

      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "11:00",
        bookedSlots,
        serviceDurationMinutes: 30,
        slotInterval: 15,
      })

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
      // Booked slots should have reason "booked"
      unavailable.forEach((s) => {
        expect(s.unavailableReason).toBe("booked")
      })
    })

    it("calculates endTime based on service duration", () => {
      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "10:00",
        bookedSlots: [],
        serviceDurationMinutes: 45,
        slotInterval: 15,
      })

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

    it("handles multiple booked slots with reason 'booked'", () => {
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
      expect(available.map((s) => s.startTime)).toEqual(["09:30", "10:30"])

      const booked = slots.filter((s) => s.unavailableReason === "booked")
      expect(booked.map((s) => s.startTime)).toEqual(["09:00", "10:00"])
    })

    it("handles service duration longer than slot interval", () => {
      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "10:30",
        bookedSlots: [],
        serviceDurationMinutes: 60,
        slotInterval: 15,
      })

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

      const lastSlot = slots[slots.length - 1]
      expect(lastSlot.startTime).toBe("16:30")
      expect(lastSlot.endTime).toBe("17:00")
    })

    it("marks past slots as unavailable with reason 'past'", () => {
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
      expect(available[0].startTime).toBe("10:30")

      // Past slots should have reason "past"
      const pastSlots = slots.filter((s) => s.unavailableReason === "past")
      expect(pastSlots.length).toBe(3) // 09:00, 09:30, 10:00
    })

    it("marks all slots as unavailable with reason 'past' for past dates", () => {
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

      // All should have reason "past"
      slots.forEach((s) => {
        expect(s.unavailableReason).toBe("past")
      })
    })

    it("allows all slots for future dates", () => {
      const currentDateTime = new Date("2026-01-29T15:00:00")

      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "10:30",
        bookedSlots: [],
        serviceDurationMinutes: 30,
        date: "2026-01-30",
        currentDateTime,
      })

      const available = slots.filter((s) => s.isAvailable)
      expect(available).toHaveLength(3)
    })

    it("works without date/currentDateTime (backwards compatible)", () => {
      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "10:30",
        bookedSlots: [],
        serviceDurationMinutes: 30,
      })

      const available = slots.filter((s) => s.isAvailable)
      expect(available).toHaveLength(3)
    })

    // ─── Priority: past > booked ───────────────────────────────────

    it("past+booked slot gets reason 'past' (past takes priority)", () => {
      const currentDateTime = new Date("2026-01-30T10:00:00")

      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "11:00",
        bookedSlots: [{ startTime: "09:00", endTime: "09:30" }],
        serviceDurationMinutes: 30,
        date: "2026-01-29", // yesterday
        currentDateTime,
      })

      // 09:00 is both past AND booked -- should get "past"
      const slot0900 = slots.find((s) => s.startTime === "09:00")!
      expect(slot0900.isAvailable).toBe(false)
      expect(slot0900.unavailableReason).toBe("past")
    })

    // ─── Travel-time callback ──────────────────────────────────────

    it("marks slot as 'travel-time' unavailable via checkTravelTime callback", () => {
      const slots = calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "10:30",
        bookedSlots: [],
        serviceDurationMinutes: 30,
        checkTravelTime: (startTime) => startTime === "09:30", // Only 09:30 has travel conflict
      })

      const slot0900 = slots.find((s) => s.startTime === "09:00")!
      expect(slot0900.isAvailable).toBe(true)

      const slot0930 = slots.find((s) => s.startTime === "09:30")!
      expect(slot0930.isAvailable).toBe(false)
      expect(slot0930.unavailableReason).toBe("travel-time")

      const slot1000 = slots.find((s) => s.startTime === "10:00")!
      expect(slot1000.isAvailable).toBe(true)
    })

    it("does not call checkTravelTime for already unavailable slots (past/booked)", () => {
      const checkCalls: string[] = []
      const currentDateTime = new Date("2026-01-29T09:45:00")

      calculateAvailableSlots({
        openingTime: "09:00",
        closingTime: "11:00",
        bookedSlots: [{ startTime: "10:00", endTime: "10:30" }],
        serviceDurationMinutes: 30,
        date: "2026-01-29",
        currentDateTime,
        checkTravelTime: (startTime) => {
          checkCalls.push(startTime)
          return false
        },
      })

      // 09:00 and 09:30 are past, 10:00 is booked -- none should trigger checkTravelTime
      expect(checkCalls).not.toContain("09:00")
      expect(checkCalls).not.toContain("09:30")
      expect(checkCalls).not.toContain("10:00")
      // 10:30 and later should be checked
      expect(checkCalls).toContain("10:30")
    })
  })
})
