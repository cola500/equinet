/**
 * BookingTime - pure time calculations for a booking (BR-BOOK-001)
 *
 * A booking stores a calendar date (`bookingDate`), local wall-clock times
 * (`startTime`/`endTime` as "HH:mm") and an IANA `timezone`. This module turns
 * those into an absolute instant without depending on the server's or the
 * browser's own timezone.
 *
 * `bookingDate` is stored in several variants (UTC midnight from the API,
 * local midnight from seed/demo, local 10:00 from E2E seed). The calendar
 * date is therefore read in the booking's timezone, never in UTC.
 *
 * Safe to import from client components: no server-only dependencies.
 */
import { Result } from '@/domain/shared/types/Result'

export const DEFAULT_BOOKING_TIMEZONE = 'Europe/Stockholm'

export type BookingTimeError = 'INVALID_TIMEZONE' | 'INVALID_TIME' | 'INVALID_DATE'

export interface BookingEndInput {
  bookingDate: Date | string
  endTime: string
  timezone: string
}

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function getFormatter(timezone: string): Intl.DateTimeFormat | null {
  const cached = formatterCache.get(timezone)
  if (cached) return cached
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatterCache.set(timezone, formatter)
    return formatter
  } catch {
    // RangeError for unknown IANA zone
    return null
  }
}

/** Wall-clock fields of an instant as seen in the formatter's timezone */
function wallClock(formatter: Intl.DateTimeFormat, instantMs: number) {
  const parts = formatter.formatToParts(new Date(instantMs))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  }
}

/** Offset (ms) between the timezone's wall clock and UTC at a given instant */
function offsetAt(formatter: Intl.DateTimeFormat, instantMs: number): number {
  const wholeSeconds = instantMs - (((instantMs % 1000) + 1000) % 1000)
  const w = wallClock(formatter, wholeSeconds)
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  return wallAsUtc - wholeSeconds
}

/**
 * The absolute instant when the booking ends, in the booking's timezone.
 * Fails (never guesses) for an unknown timezone or malformed time.
 */
export function getBookingEndInstant(input: BookingEndInput): Result<Date, BookingTimeError> {
  const formatter = getFormatter(input.timezone)
  if (!formatter) return Result.fail('INVALID_TIMEZONE')

  const match = HH_MM.exec(input.endTime)
  if (!match) return Result.fail('INVALID_TIME')

  const stored = input.bookingDate instanceof Date ? input.bookingDate : new Date(input.bookingDate)
  if (Number.isNaN(stored.getTime())) return Result.fail('INVALID_DATE')

  // 1. Calendar date as seen in the booking's timezone
  const { year, month, day } = wallClock(formatter, stored.getTime())

  // 2. Local wall-clock end time, first interpreted as if it were UTC
  const wallAsUtc = Date.UTC(year, month - 1, day, Number(match[1]), Number(match[2]))

  // 3. Subtract the zone offset; re-evaluate once so DST transitions resolve
  const firstGuess = wallAsUtc - offsetAt(formatter, wallAsUtc)
  const instant = wallAsUtc - offsetAt(formatter, firstGuess)

  return Result.ok(new Date(instant))
}

/**
 * Whether "completed" is allowed at `now` (BR-BOOK-001: at or after end time).
 * Returns false when the end time cannot be determined (fails closed).
 */
export function canMarkCompleted(input: BookingEndInput, now: Date): boolean {
  const end = getBookingEndInstant(input)
  return end.isSuccess && now.getTime() >= end.value.getTime()
}
