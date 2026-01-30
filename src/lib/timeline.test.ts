import { describe, it, expect } from "vitest"
import {
  mergeTimeline,
  TimelineBooking,
  TimelineNote,
} from "./timeline"

describe("mergeTimeline", () => {
  it("should merge bookings and notes sorted by date descending", () => {
    const bookings: TimelineBooking[] = [
      {
        type: "booking",
        id: "b1",
        date: "2026-01-10",
        title: "Hovvård",
        providerName: "Magnus Hovslageri",
        status: "completed",
        notes: null,
      },
      {
        type: "booking",
        id: "b2",
        date: "2026-01-20",
        title: "Massage",
        providerName: "Sara Hästmassage",
        status: "completed",
        notes: "Stel i ryggen",
      },
    ]

    const notes: TimelineNote[] = [
      {
        type: "note",
        id: "n1",
        date: "2026-01-15",
        title: "Vaccination - influensa",
        category: "veterinary",
        content: "Årlig vaccination genomförd",
        authorName: "Anna Svensson",
      },
    ]

    const result = mergeTimeline(bookings, notes)

    expect(result).toHaveLength(3)
    // Most recent first
    expect(result[0].id).toBe("b2") // Jan 20
    expect(result[1].id).toBe("n1") // Jan 15
    expect(result[2].id).toBe("b1") // Jan 10
  })

  it("should return empty array when both inputs are empty", () => {
    const result = mergeTimeline([], [])
    expect(result).toEqual([])
  })

  it("should return only bookings when no notes", () => {
    const bookings: TimelineBooking[] = [
      {
        type: "booking",
        id: "b1",
        date: "2026-01-10",
        title: "Hovvård",
        providerName: "Magnus",
        status: "completed",
        notes: null,
      },
    ]

    const result = mergeTimeline(bookings, [])

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("booking")
  })

  it("should return only notes when no bookings", () => {
    const notes: TimelineNote[] = [
      {
        type: "note",
        id: "n1",
        date: "2026-01-15",
        title: "Skada höger bak",
        category: "injury",
        content: "Svullnad",
        authorName: "Anna",
      },
    ]

    const result = mergeTimeline([], notes)

    expect(result).toHaveLength(1)
    expect(result[0].type).toBe("note")
  })

  it("should handle items on the same date", () => {
    const bookings: TimelineBooking[] = [
      {
        type: "booking",
        id: "b1",
        date: "2026-01-15",
        title: "Hovvård",
        providerName: "Magnus",
        status: "completed",
        notes: null,
      },
    ]

    const notes: TimelineNote[] = [
      {
        type: "note",
        id: "n1",
        date: "2026-01-15",
        title: "Notering",
        category: "general",
        content: null,
        authorName: "Anna",
      },
    ]

    const result = mergeTimeline(bookings, notes)

    expect(result).toHaveLength(2)
    // Both should be present (order between same-date items is stable)
    expect(result.map((r) => r.id).sort()).toEqual(["b1", "n1"])
  })
})
