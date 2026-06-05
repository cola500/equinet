import { describe, it, expect } from "vitest"
import { getNextBooking, deriveHomeStatus, getHorseBookings, type DueLikeItem, type BookingLike } from "./customer-home"

const NOW = new Date("2026-06-05T10:00:00Z")

function due(partial: Partial<DueLikeItem>): DueLikeItem {
  return {
    horseId: "h1",
    horseName: "Molly",
    serviceId: "s1",
    serviceName: "Omskoning",
    daysUntilDue: 0,
    status: "ok",
    ...partial,
  }
}

function booking(partial: Partial<BookingLike>): BookingLike {
  return {
    horseId: "h1",
    bookingDate: "2026-06-09T08:00:00Z",
    status: "confirmed",
    horse: { name: "Storm" },
    service: { name: "Verkning" },
    ...partial,
  }
}

describe("getNextBooking", () => {
  it("returns the nearest upcoming, booked visit", () => {
    const result = getNextBooking(
      [
        booking({ bookingDate: "2026-06-20T08:00:00Z", service: { name: "Omskoning" } }),
        booking({ bookingDate: "2026-06-09T08:00:00Z", service: { name: "Verkning" } }),
      ],
      NOW
    )
    expect(result).toEqual({ horse: "Storm", service: "Verkning", date: "2026-06-09T08:00:00Z" })
  })

  it("ignores past, cancelled and completed bookings", () => {
    expect(getNextBooking([booking({ bookingDate: "2026-05-01T08:00:00Z" })], NOW)).toBeNull()
    expect(getNextBooking([booking({ status: "cancelled" })], NOW)).toBeNull()
    expect(getNextBooking([booking({ status: "completed" })], NOW)).toBeNull()
  })

  it("returns null when there are no bookings", () => {
    expect(getNextBooking([], NOW)).toBeNull()
  })
})

describe("getHorseBookings", () => {
  it("returns the most recent completed visit and the nearest upcoming one", () => {
    const result = getHorseBookings(
      [
        booking({ horseId: "h1", status: "completed", bookingDate: "2026-05-01T08:00:00Z", service: { name: "Verkning" } }),
        booking({ horseId: "h1", status: "completed", bookingDate: "2026-04-02T08:00:00Z", service: { name: "Omskoning" } }),
        booking({ horseId: "h1", status: "confirmed", bookingDate: "2026-06-09T08:00:00Z", service: { name: "Verkning" } }),
        booking({ horseId: "OTHER", status: "confirmed", bookingDate: "2026-06-06T08:00:00Z" }),
      ],
      "h1",
      NOW
    )
    expect(result.last).toEqual({ service: "Verkning", date: "2026-05-01T08:00:00Z" })
    expect(result.next).toEqual({ service: "Verkning", date: "2026-06-09T08:00:00Z" })
  })

  it("returns nulls when the horse has no relevant bookings", () => {
    expect(getHorseBookings([], "h1", NOW)).toEqual({ last: null, next: null })
  })
})

describe("deriveHomeStatus", () => {
  it("is calm with the next booking when nothing is overdue", () => {
    const next = { horse: "Storm", service: "Verkning", date: "2026-06-09T08:00:00Z" }
    expect(deriveHomeStatus([due({ status: "ok" }), due({ status: "upcoming" })], next)).toEqual({
      mode: "calm",
      next,
    })
  })

  it("is calm with null next when there is no upcoming booking", () => {
    expect(deriveHomeStatus([due({ status: "ok" })], null)).toEqual({ mode: "calm", next: null })
  })

  it("alarms on the most overdue horse and counts the rest", () => {
    const result = deriveHomeStatus(
      [
        due({ horseName: "Molly", serviceName: "Omskoning", status: "overdue", daysUntilDue: -5 }),
        due({ horseName: "Storm", serviceName: "Verkning", status: "overdue", daysUntilDue: -12 }),
        due({ status: "ok" }),
      ],
      null
    )
    expect(result).toMatchObject({
      mode: "alarm",
      horse: "Storm",
      service: "Verkning",
      daysOverdue: 12,
      othersCount: 1,
    })
  })

  it("alarm with a single overdue horse has othersCount 0", () => {
    const result = deriveHomeStatus([due({ status: "overdue", daysUntilDue: -3 })], null)
    expect(result).toMatchObject({ mode: "alarm", daysOverdue: 3, othersCount: 0 })
  })
})
