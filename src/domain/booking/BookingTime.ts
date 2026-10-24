/**
 * BookingTime - pure time calculations for a booking (BR-BOOK-001)
 *
 * A booking stores a calendar date (`bookingDate`), local wall-clock times
 * (`startTime`/`endTime` as "HH:mm") and an IANA `timezone`. This module turns
 * those into an absolute instant without depending on the server's or the
 * browser's own timezone.
 *
 * `bookingDate` is stored in several variants (UTC midnight from the API,
 * local midnight from seed/demo, local 10:00 from E2E seed); see
 * `calendarDate` for how the calendar date is recovered.
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

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i

/**
 * 1. The booking's calendar date.
 *
 * - "YYYY-MM-DD" is the calendar date as-is.
 * - A timestamp without zone (Supabase REST returns Prisma's `timestamp(3)`
 *   like "2026-11-10T00:00:00") is UTC, never the reader's local time.
 * - Stored variants are UTC midnight, local midnight and local 10:00. East of
 *   UTC (offset >= 0) all three fall on the right day in the booking's zone;
 *   west of UTC they all fall on the right day in UTC.
 */
function calendarDate(
  raw: Date | string,
  formatter: Intl.DateTimeFormat
): { year: number; month: number; day: number } | null {
  if (typeof raw === 'string') {
    const dateOnly = DATE_ONLY.exec(raw)
    if (dateOnly) {
      return { year: Number(dateOnly[1]), month: Number(dateOnly[2]), day: Number(dateOnly[3]) }
    }
  }
  const stored =
    raw instanceof Date ? raw : new Date(HAS_ZONE.test(raw) ? raw : `${raw}Z`)
  const ms = stored.getTime()
  if (Number.isNaN(ms)) return null

  if (offsetAt(formatter, ms) >= 0) {
    const { year, month, day } = wallClock(formatter, ms)
    return { year, month, day }
  }
  return { year: stored.getUTCFullYear(), month: stored.getUTCMonth() + 1, day: stored.getUTCDate() }
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

  const date = calendarDate(input.bookingDate, formatter)
  if (!date) return Result.fail('INVALID_DATE')
  const { year, month, day } = date

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
