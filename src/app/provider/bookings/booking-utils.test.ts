import { describe, expect, it } from "vitest"
import {
  sortBookings,
  filterBookings,
  countByStatus,
  type BookingSortable,
} from "./booking-utils"

function makeBooking(
  status: string,
  bookingDate: string
): BookingSortable {
  return { status, bookingDate }
}

describe("sortBookings", () => {
  it("places pending bookings first in 'all' view", () => {
    const bookings = [
      makeBooking("confirmed", "2026-02-15"),
      makeBooking("pending", "2026-02-10"),
      makeBooking("completed", "2026-02-20"),
      makeBooking("pending", "2026-02-12"),
    ]

    const sorted = sortBookings(bookings, "all")

    expect(sorted[0].status).toBe("pending")
    expect(sorted[1].status).toBe("pending")
    expect(sorted[2].status).not.toBe("pending")
    expect(sorted[3].status).not.toBe("pending")
  })

  it("sorts pending bookings by date descending (newest first)", () => {
    const bookings = [
      makeBooking("pending", "2026-02-10"),
      makeBooking("pending", "2026-02-15"),
      makeBooking("pending", "2026-02-12"),
    ]

    const sorted = sortBookings(bookings, "all")

    expect(sorted[0].bookingDate).toBe("2026-02-15")
    expect(sorted[1].bookingDate).toBe("2026-02-12")
    expect(sorted[2].bookingDate).toBe("2026-02-10")
  })

  it("sorts non-pending bookings by date descending after pending group", () => {
    const bookings = [
      makeBooking("confirmed", "2026-02-10"),
      makeBooking("pending", "2026-02-05"),
      makeBooking("completed", "2026-02-20"),
      makeBooking("confirmed", "2026-02-15"),
    ]

    const sorted = sortBookings(bookings, "all")

    // Pending first
    expect(sorted[0]).toEqual(makeBooking("pending", "2026-02-05"))
    // Then non-pending by date desc
    expect(sorted[1].bookingDate).toBe("2026-02-20")
    expect(sorted[2].bookingDate).toBe("2026-02-15")
    expect(sorted[3].bookingDate).toBe("2026-02-10")
  })

  it("sorts by date descending only in single-status filter", () => {
    const bookings = [
      makeBooking("confirmed", "2026-02-10"),
      makeBooking("confirmed", "2026-02-20"),
      makeBooking("confirmed", "2026-02-15"),
    ]

    const sorted = sortBookings(bookings, "confirmed")

    expect(sorted[0].bookingDate).toBe("2026-02-20")
    expect(sorted[1].bookingDate).toBe("2026-02-15")
    expect(sorted[2].bookingDate).toBe("2026-02-10")
  })

  it("does NOT prioritize pending in single-status filter views", () => {
    // Even if there are pending bookings mixed in (shouldn't happen with proper filtering),
    // single-status views should only sort by date
    const bookings = [
      makeBooking("pending", "2026-02-10"),
      makeBooking("confirmed", "2026-02-20"),
    ]

    const sorted = sortBookings(bookings, "pending")

    expect(sorted[0].bookingDate).toBe("2026-02-20")
    expect(sorted[1].bookingDate).toBe("2026-02-10")
  })

  it("returns empty array for empty input", () => {
    expect(sortBookings([], "all")).toEqual([])
  })

  it("does not mutate the original array", () => {
    const bookings = [
      makeBooking("confirmed", "2026-02-15"),
      makeBooking("pending", "2026-02-10"),
    ]
    const original = [...bookings]

    sortBookings(bookings, "all")

    expect(bookings).toEqual(original)
  })
})

describe("filterBookings", () => {
  const bookings = [
    makeBooking("pending", "2026-02-10"),
    makeBooking("confirmed", "2026-02-11"),
    makeBooking("completed", "2026-02-12"),
    makeBooking("cancelled", "2026-02-13"),
    makeBooking("pending", "2026-02-14"),
    makeBooking("no_show", "2026-02-15"),
  ]

  it("'all' filter excludes cancelled and no_show bookings", () => {
    const filtered = filterBookings(bookings, "all")

    expect(filtered).toHaveLength(4)
    expect(filtered.every((b) => b.status !== "cancelled" && b.status !== "no_show")).toBe(true)
  })

  it("'pending' filter returns only pending", () => {
    const filtered = filterBookings(bookings, "pending")

    expect(filtered).toHaveLength(2)
    expect(filtered.every((b) => b.status === "pending")).toBe(true)
  })

  it("'confirmed' filter returns only confirmed", () => {
    const filtered = filterBookings(bookings, "confirmed")

    expect(filtered).toHaveLength(1)
    expect(filtered[0].status).toBe("confirmed")
  })

  it("'completed' filter returns only completed", () => {
    const filtered = filterBookings(bookings, "completed")

    expect(filtered).toHaveLength(1)
    expect(filtered[0].status).toBe("completed")
  })

  it("'cancelled' filter returns only cancelled", () => {
    const filtered = filterBookings(bookings, "cancelled")

    expect(filtered).toHaveLength(1)
    expect(filtered[0].status).toBe("cancelled")
  })

  it("'no_show' filter returns only no_show", () => {
    const filtered = filterBookings(bookings, "no_show")

    expect(filtered).toHaveLength(1)
    expect(filtered[0].status).toBe("no_show")
  })

  it("returns empty array when no bookings match filter", () => {
    const onlyPending = [makeBooking("pending", "2026-02-10")]

    expect(filterBookings(onlyPending, "confirmed")).toEqual([])
  })
})

describe("countByStatus", () => {
  it("counts bookings per status correctly", () => {
    const bookings = [
      makeBooking("pending", "2026-02-10"),
      makeBooking("pending", "2026-02-11"),
      makeBooking("confirmed", "2026-02-12"),
      makeBooking("completed", "2026-02-13"),
      makeBooking("cancelled", "2026-02-14"),
      makeBooking("no_show", "2026-02-15"),
    ]

    const counts = countByStatus(bookings)

    expect(counts.pending).toBe(2)
    expect(counts.confirmed).toBe(1)
    expect(counts.completed).toBe(1)
    expect(counts.cancelled).toBe(1)
    expect(counts.no_show).toBe(1)
    expect(counts.all).toBe(4) // Excludes cancelled and no_show
  })

  it("returns zeros for empty array", () => {
    const counts = countByStatus([])

    expect(counts).toEqual({
      all: 0,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    })
  })

  it("all count excludes cancelled and no_show", () => {
    const bookings = [
      makeBooking("cancelled", "2026-02-10"),
      makeBooking("cancelled", "2026-02-11"),
      makeBooking("no_show", "2026-02-12"),
      makeBooking("pending", "2026-02-13"),
    ]

    const counts = countByStatus(bookings)

    expect(counts.all).toBe(1)
    expect(counts.cancelled).toBe(2)
    expect(counts.no_show).toBe(1)
  })
})
