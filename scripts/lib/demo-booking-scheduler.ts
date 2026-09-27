/**
 * Deterministic date/time resolution for the demo/staging seed data.
 *
 * The bookings in scripts/seed-demo-provider.ts are described as "N days from
 * whenever the seed runs" (e.g. daysFromNow(2)). That alone says nothing about
 * whether the resulting calendar date actually falls within the provider's
 * seeded weekly availability (Mon-Fri) or any AvailabilityException — running
 * the seed on a Thursday could place a booking on the following Saturday,
 * when the demo provider is closed.
 *
 * This module resolves each "offset" to the nearest day the provider is
 * actually open, and then to a start/end time that fits inside opening hours
 * and does not overlap any other seeded booking on that date (with a small
 * buffer, standing in for travel time between visits). It has no Prisma
 * dependency so it can be unit-tested in isolation from the database.
 */

import {
  timeToMinutes,
  minutesToTime,
  calculateAvailableSlots,
} from "../../src/lib/utils/slotCalculator"

export interface WeeklyAvailabilityDay {
  dayOfWeek: number // 0=Monday .. 6=Sunday, matches Prisma's Availability.dayOfWeek
  isClosed: boolean
  startTime: string
  endTime: string
}

export interface AvailabilityExceptionDay {
  dateKey: string // "YYYY-MM-DD"
  isClosed: boolean
  startTime?: string | null
  endTime?: string | null
}

export interface ResolvedBookingSlot {
  date: Date
  dateKey: string
  startTime: string
  endTime: string
}

/**
 * Convert a JS Date's day-of-week (0=Sunday) to the seed/Prisma convention
 * (0=Monday .. 6=Sunday). Mirrors the exact formula already used in
 * src/app/api/providers/[id]/availability/route.ts, so a date resolved here
 * matches what the real availability API would report for the same date.
 */
export function toSeedDayOfWeek(date: Date): number {
  return (date.getDay() + 6) % 7
}

/** Local-time YYYY-MM-DD key. Deliberately avoids toISOString() (UTC), which
 *  can shift the calendar date near midnight depending on the machine's
 *  timezone. */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function dateOnly(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = dateOnly(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Convert a local-midnight Date to a Date whose UTC representation is that
 * same calendar day at 00:00 UTC (e.g. local Oct 2 -> "2026-10-02T00:00:00.000Z").
 *
 * This matters because the rest of the app builds `bookingDate` from a plain
 * "YYYY-MM-DD" string (`new Date(dateStr)`), which JS parses as UTC midnight
 * per spec. All the open-day/weekday logic in this module intentionally uses
 * local-calendar-date semantics internally (so it reads naturally and matches
 * the seeded Availability's dayOfWeek), but a *local* midnight Date, once
 * written by Prisma to the non-timezone-aware `bookingDate` column, would
 * serialize as the *previous* calendar day in any timezone ahead of UTC
 * (e.g. Europe/Stockholm in summer, UTC+2) — silently landing the booking on
 * the wrong date, potentially a closed one. Converting to UTC midnight at
 * this single boundary keeps the internal logic simple while matching what
 * the real booking-creation path already produces.
 */
function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

interface OpenHours {
  open: boolean
  startTime: string
  endTime: string
}

/** Resolve the effective open/closed state and hours for one specific date,
 *  giving an AvailabilityException priority over the weekly schedule —
 *  matching the precedence already used by the live availability API route. */
function getOpenHours(
  date: Date,
  schedule: WeeklyAvailabilityDay[],
  exceptionsByDateKey: Map<string, AvailabilityExceptionDay>
): OpenHours {
  const dateKey = formatDateKey(date)
  const exception = exceptionsByDateKey.get(dateKey)

  if (exception) {
    if (exception.isClosed) {
      return { open: false, startTime: "", endTime: "" }
    }
    if (exception.startTime && exception.endTime) {
      return { open: true, startTime: exception.startTime, endTime: exception.endTime }
    }
  }

  const dayOfWeek = toSeedDayOfWeek(date)
  const weekly = schedule.find((d) => d.dayOfWeek === dayOfWeek)
  if (!weekly || weekly.isClosed) {
    return { open: false, startTime: "", endTime: "" }
  }
  return { open: true, startTime: weekly.startTime, endTime: weekly.endTime }
}

/**
 * Find the calendar date closest to `reference` (in either direction) that
 * the provider is actually open, per the weekly schedule and any exceptions.
 * Ties (equal distance forward/back) are broken forward, so e.g. a closed
 * Tuesday resolves to Wednesday rather than Monday.
 */
export function findNearestOpenDate(
  reference: Date,
  schedule: WeeklyAvailabilityDay[],
  exceptionsByDateKey: Map<string, AvailabilityExceptionDay>,
  maxRadius = 14
): Date {
  const base = dateOnly(reference)
  if (getOpenHours(base, schedule, exceptionsByDateKey).open) {
    return base
  }
  for (let radius = 1; radius <= maxRadius; radius++) {
    const forward = addDays(base, radius)
    if (getOpenHours(forward, schedule, exceptionsByDateKey).open) {
      return forward
    }
    const backward = addDays(base, -radius)
    if (getOpenHours(backward, schedule, exceptionsByDateKey).open) {
      return backward
    }
  }
  throw new Error(
    `No open day found within ${maxRadius} days of ${formatDateKey(base)} — check the seeded Availability schedule.`
  )
}

interface OccupiedSlot {
  start: number // minutes from midnight
  end: number // minutes from midnight
}

export interface DemoBookingSchedulerOptions {
  /** Minimum gap (minutes) kept between seeded bookings on the same date —
   *  a stand-in for travel time/buffer between visits. */
  bufferMinutes?: number
  /** How many days out to search for an open day before giving up. */
  maxSearchRadiusDays?: number
}

/**
 * Resolves a sequence of "N days from the seed run" booking requests to
 * concrete, non-overlapping (date, startTime, endTime) triples that respect
 * the provider's actual seeded availability.
 *
 * Two calls with the same `offsetDays` always resolve to the same date (so a
 * multi-stop demo day like "Dagens rutt" stays on one calendar day even if
 * that day had to move because the original offset landed on a closed day).
 * Everything is a pure function of the constructor's `reference` date, the
 * schedule/exceptions, and the fixed call order — no randomness, no clock
 * reads — so re-running the seed on the same day reproduces the same dates.
 */
export class DemoBookingScheduler {
  private readonly reference: Date
  private readonly schedule: WeeklyAvailabilityDay[]
  private readonly exceptionsByDateKey: Map<string, AvailabilityExceptionDay>
  private readonly bufferMinutes: number
  private readonly maxSearchRadiusDays: number

  private readonly resolvedDateByOffset = new Map<number, Date>()
  private readonly occupiedByDateKey = new Map<string, OccupiedSlot[]>()

  constructor(
    reference: Date,
    schedule: WeeklyAvailabilityDay[],
    exceptionsByDateKey: Map<string, AvailabilityExceptionDay>,
    options: DemoBookingSchedulerOptions = {}
  ) {
    this.reference = dateOnly(reference)
    this.schedule = schedule
    this.exceptionsByDateKey = exceptionsByDateKey
    this.bufferMinutes = options.bufferMinutes ?? 15
    this.maxSearchRadiusDays = options.maxSearchRadiusDays ?? 14
  }

  /** Resolve one booking request to a concrete date + non-overlapping time. */
  resolve(offsetDays: number, preferredStartTime: string, durationMinutes: number): ResolvedBookingSlot {
    const date = this.resolveDateForOffset(offsetDays)
    const dateKey = formatDateKey(date)
    const hours = getOpenHours(date, this.schedule, this.exceptionsByDateKey)
    if (!hours.open) {
      // Should be unreachable: resolveDateForOffset only returns open dates.
      throw new Error(`Resolved date ${dateKey} is not open — this is a bug in DemoBookingScheduler.`)
    }

    const existing = this.occupiedByDateKey.get(dateKey) ?? []
    const { startTime, endTime } = this.findNonOverlappingSlot(
      hours,
      existing,
      preferredStartTime,
      durationMinutes
    )

    const updated = [...existing, { start: timeToMinutes(startTime), end: timeToMinutes(endTime) }]
    this.occupiedByDateKey.set(dateKey, updated)

    return { date: toUtcMidnight(date), dateKey, startTime, endTime }
  }

  private resolveDateForOffset(offsetDays: number): Date {
    const cached = this.resolvedDateByOffset.get(offsetDays)
    if (cached) return cached

    const naive = addDays(this.reference, offsetDays)
    const resolved = findNearestOpenDate(
      naive,
      this.schedule,
      this.exceptionsByDateKey,
      this.maxSearchRadiusDays
    )
    this.resolvedDateByOffset.set(offsetDays, resolved)
    return resolved
  }

  private findNonOverlappingSlot(
    hours: OpenHours,
    existing: OccupiedSlot[],
    preferredStartTime: string,
    durationMinutes: number
  ): { startTime: string; endTime: string } {
    const buffer = this.bufferMinutes
    // Treat each existing booking as occupying [start-buffer, end+buffer) so
    // auto-picked slots keep a realistic gap; the original hand-authored
    // times already have wide gaps and are unaffected by this.
    const bookedSlots = existing.map((slot) => ({
      startTime: minutesToTime(Math.max(0, slot.start - buffer)),
      endTime: minutesToTime(slot.end + buffer),
    }))

    const fits = (startTime: string): boolean => {
      const start = timeToMinutes(startTime)
      const end = start + durationMinutes
      if (start < timeToMinutes(hours.startTime) || end > timeToMinutes(hours.endTime)) {
        return false
      }
      return !bookedSlots.some((b) => {
        const bStart = timeToMinutes(b.startTime)
        const bEnd = timeToMinutes(b.endTime)
        return start < bEnd && end > bStart
      })
    }

    if (fits(preferredStartTime)) {
      return { startTime: preferredStartTime, endTime: minutesToTime(timeToMinutes(preferredStartTime) + durationMinutes) }
    }

    // Search forward from the preferred time first (closest-in-time slot
    // >= what was asked for), then fall back to filling an earlier gap.
    const slots = calculateAvailableSlots({
      openingTime: hours.startTime,
      closingTime: hours.endTime,
      bookedSlots,
      serviceDurationMinutes: durationMinutes,
      slotInterval: 5,
    })

    const preferredMinutes = timeToMinutes(preferredStartTime)
    const forward = slots
      .filter((s) => s.isAvailable && timeToMinutes(s.startTime) >= preferredMinutes)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))[0]
    if (forward) {
      return { startTime: forward.startTime, endTime: forward.endTime }
    }

    const backward = slots
      .filter((s) => s.isAvailable && timeToMinutes(s.startTime) < preferredMinutes)
      .sort((a, b) => timeToMinutes(b.startTime) - timeToMinutes(a.startTime))[0]
    if (backward) {
      return { startTime: backward.startTime, endTime: backward.endTime }
    }

    throw new Error(
      `No non-overlapping ${durationMinutes}-minute slot available between ${hours.startTime} and ${hours.endTime} ` +
        `(preferred ${preferredStartTime}) — the demo schedule for this date is fully booked.`
    )
  }
}
