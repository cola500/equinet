/**
 * Pure helpers for the horse owner's home (/hem).
 *
 * Derives the single-sentence status ("behöver jag göra något?") and the
 * per-horse next/last booking, from existing data only (useDueForService +
 * /api/bookings). No new endpoint or data model.
 */

export interface DueLikeItem {
  horseId: string
  horseName: string
  serviceId: string
  serviceName: string
  daysUntilDue: number
  status: "overdue" | "upcoming" | "ok"
}

export interface BookingLike {
  horseId: string | null
  bookingDate: string
  status: string
  horse?: { name?: string | null } | null
  horseName?: string | null
  service?: { name?: string | null } | null
}

const INACTIVE_BOOKING_STATUSES = new Set(["cancelled", "completed", "no_show"])

/** True if a booking is a real, upcoming visit (booked and in the future). */
function isUpcoming(b: BookingLike, now: Date): boolean {
  if (INACTIVE_BOOKING_STATUSES.has(b.status)) return false
  return new Date(b.bookingDate).getTime() > now.getTime()
}

export interface NextBooking {
  horse: string
  service: string
  date: string // raw ISO/date string; format at render
}

/** The owner's single nearest upcoming booking, or null. */
export function getNextBooking(bookings: BookingLike[], now: Date = new Date()): NextBooking | null {
  const upcoming = bookings
    .filter((b) => isUpcoming(b, now))
    .sort((a, b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime())
  const next = upcoming[0]
  if (!next) return null
  return {
    horse: next.horse?.name ?? next.horseName ?? "Din häst",
    service: next.service?.name ?? "Besök",
    date: next.bookingDate,
  }
}

export interface HorseVisit {
  service: string
  date: string // raw; format at render
}

export interface HorseBookings {
  last: HorseVisit | null
  next: HorseVisit | null
}

/** This horse's most recent completed visit and its nearest upcoming one. */
export function getHorseBookings(
  bookings: BookingLike[],
  horseId: string,
  now: Date = new Date()
): HorseBookings {
  const forHorse = bookings.filter((b) => b.horseId === horseId)

  const lastDone = forHorse
    .filter((b) => b.status === "completed" && new Date(b.bookingDate).getTime() <= now.getTime())
    .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime())[0]

  const nextUp = forHorse
    .filter((b) => isUpcoming(b, now))
    .sort((a, b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime())[0]

  return {
    last: lastDone ? { service: lastDone.service?.name ?? "Besök", date: lastDone.bookingDate } : null,
    next: nextUp ? { service: nextUp.service?.name ?? "Besök", date: nextUp.bookingDate } : null,
  }
}

export type HomeStatus =
  | { mode: "calm"; next: NextBooking | null }
  | {
      mode: "alarm"
      horse: string
      service: string
      serviceId: string
      daysOverdue: number
      othersCount: number
    }

/**
 * Calm when nothing is overdue; alarm (most urgent horse + "och N till") when
 * one or more horses are overdue. Never exposes counters/gauges — just the model.
 */
export function deriveHomeStatus(dueItems: DueLikeItem[], nextBooking: NextBooking | null): HomeStatus {
  const overdue = dueItems.filter((i) => i.status === "overdue")
  if (overdue.length === 0) {
    return { mode: "calm", next: nextBooking }
  }
  // Most urgent = most days overdue.
  const top = [...overdue].sort((a, b) => Math.abs(b.daysUntilDue) - Math.abs(a.daysUntilDue))[0]
  return {
    mode: "alarm",
    horse: top.horseName,
    service: top.serviceName,
    serviceId: top.serviceId,
    daysOverdue: Math.abs(top.daysUntilDue),
    othersCount: overdue.length - 1,
  }
}
