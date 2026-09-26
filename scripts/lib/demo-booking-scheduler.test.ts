import { describe, it, expect } from "vitest"
import {
  toSeedDayOfWeek,
  formatDateKey,
  findNearestOpenDate,
  DemoBookingScheduler,
  type WeeklyAvailabilityDay,
  type AvailabilityExceptionDay,
} from "./demo-booking-scheduler"

// Mon–Fri 07:00–16:00 open, Sat–Sun closed — matches the seeded demo provider schedule.
const MON_FRI_SCHEDULE: WeeklyAvailabilityDay[] = [
  { dayOfWeek: 0, isClosed: false, startTime: "07:00", endTime: "16:00" }, // Mon
  { dayOfWeek: 1, isClosed: false, startTime: "07:00", endTime: "16:00" }, // Tue
  { dayOfWeek: 2, isClosed: false, startTime: "07:00", endTime: "16:00" }, // Wed
  { dayOfWeek: 3, isClosed: false, startTime: "07:00", endTime: "16:00" }, // Thu
  { dayOfWeek: 4, isClosed: false, startTime: "07:00", endTime: "16:00" }, // Fri
  { dayOfWeek: 5, isClosed: true, startTime: "00:00", endTime: "00:00" }, // Sat
  { dayOfWeek: 6, isClosed: true, startTime: "00:00", endTime: "00:00" }, // Sun
]

function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

describe("toSeedDayOfWeek", () => {
  it("maps Monday to 0 and Sunday to 6 (ISO-style, matching Availability.dayOfWeek)", () => {
    // 2026-09-28 is a Monday, 2026-10-04 is a Sunday
    expect(toSeedDayOfWeek(localDate(2026, 9, 28))).toBe(0)
    expect(toSeedDayOfWeek(localDate(2026, 9, 29))).toBe(1)
    expect(toSeedDayOfWeek(localDate(2026, 10, 3))).toBe(5) // Saturday
    expect(toSeedDayOfWeek(localDate(2026, 10, 4))).toBe(6) // Sunday
  })
})

describe("formatDateKey", () => {
  it("formats using local date parts (no UTC shift)", () => {
    expect(formatDateKey(localDate(2026, 1, 5))).toBe("2026-01-05")
    expect(formatDateKey(localDate(2026, 12, 31))).toBe("2026-12-31")
  })
})

describe("findNearestOpenDate", () => {
  it("returns the same date when it is already open", () => {
    const tuesday = localDate(2026, 9, 29)
    const result = findNearestOpenDate(tuesday, MON_FRI_SCHEDULE, new Map())
    expect(formatDateKey(result)).toBe(formatDateKey(tuesday))
  })

  it("shifts a Saturday to the nearest open day (Friday, 1 day back beats Monday, 2 days forward)", () => {
    const saturday = localDate(2026, 10, 3)
    const result = findNearestOpenDate(saturday, MON_FRI_SCHEDULE, new Map())
    expect(formatDateKey(result)).toBe("2026-10-02") // Friday
  })

  it("shifts a Sunday to the nearest open day (Monday, 1 day forward beats Friday, 2 days back)", () => {
    const sunday = localDate(2026, 10, 4)
    const result = findNearestOpenDate(sunday, MON_FRI_SCHEDULE, new Map())
    expect(formatDateKey(result)).toBe("2026-10-05") // Monday
  })

  it("respects an AvailabilityException that closes an otherwise-open weekday", () => {
    const tuesday = localDate(2026, 9, 29)
    const exceptions = new Map<string, AvailabilityExceptionDay>([
      ["2026-09-29", { dateKey: "2026-09-29", isClosed: true }],
    ])
    const result = findNearestOpenDate(tuesday, MON_FRI_SCHEDULE, exceptions)
    // Nearest open day around a closed Tuesday is Monday (1 day back) or Wednesday (1 day fwd) — tie broken forward
    expect(formatDateKey(result)).toBe("2026-09-30")
  })

  it("respects an AvailabilityException that opens an otherwise-closed weekend day", () => {
    const saturday = localDate(2026, 10, 3)
    const exceptions = new Map<string, AvailabilityExceptionDay>([
      ["2026-10-03", { dateKey: "2026-10-03", isClosed: false, startTime: "10:00", endTime: "14:00" }],
    ])
    const result = findNearestOpenDate(saturday, MON_FRI_SCHEDULE, exceptions)
    expect(formatDateKey(result)).toBe("2026-10-03")
  })

  it("throws if no open day exists within the search radius", () => {
    const allClosed: WeeklyAvailabilityDay[] = MON_FRI_SCHEDULE.map((d) => ({ ...d, isClosed: true }))
    expect(() => findNearestOpenDate(localDate(2026, 9, 29), allClosed, new Map(), 3)).toThrow()
  })
})

describe("DemoBookingScheduler", () => {
  // Reference "today" = Thursday 2026-10-01, chosen so daysFromNow(2) lands on
  // Saturday 2026-10-03 — this is the exact bug scenario (booking on a closed day).
  const REFERENCE = localDate(2026, 10, 1)

  function makeScheduler(bufferMinutes = 15) {
    return new DemoBookingScheduler(REFERENCE, MON_FRI_SCHEDULE, new Map(), { bufferMinutes })
  }

  it("never places a booking on a closed weekday", () => {
    const scheduler = makeScheduler()
    for (let offset = -30; offset <= 30; offset++) {
      const result = scheduler.resolve(offset, "09:00", 60)
      const dow = toSeedDayOfWeek(result.date)
      expect(dow).toBeLessThan(5) // Mon(0)..Fri(4), never Sat(5)/Sun(6)
    }
  })

  it("returns a date whose UTC representation is exactly that calendar day at midnight (timezone-safe for storage)", () => {
    // Regression test: a *local*-midnight Date, once written by Prisma to the
    // non-timezone-aware bookingDate column, serializes as the *previous*
    // calendar day in any timezone ahead of UTC (e.g. Stockholm summer time,
    // UTC+2) — silently landing seeded bookings a day early, sometimes on a
    // closed day. resolve() must hand back a UTC-midnight-anchored Date, the
    // same convention the real booking API uses (`new Date("YYYY-MM-DD")`).
    const scheduler = makeScheduler()
    const result = scheduler.resolve(7, "09:00", 60) // offset 7 lands on 2026-10-08 (Thursday)
    expect(result.date.toISOString()).toBe(`${result.dateKey}T00:00:00.000Z`)
  })

  it("keeps the booking within the provider's opening hours", () => {
    const scheduler = makeScheduler()
    const result = scheduler.resolve(2, "07:30", 75)
    expect(result.startTime >= "07:00").toBe(true)
    expect(result.endTime <= "16:00").toBe(true)
  })

  it("ensures the end time fits before closing (never spills past 16:00)", () => {
    const scheduler = makeScheduler()
    // Preferred time deliberately too close to closing for a 75-minute service
    const result = scheduler.resolve(2, "15:30", 75)
    expect(result.endTime <= "16:00").toBe(true)
  })

  it("is deterministic: the same offset always resolves to the same date (grouping)", () => {
    const scheduler = makeScheduler()
    const a = scheduler.resolve(2, "08:00", 75)
    const b = scheduler.resolve(2, "10:30", 45)
    const c = scheduler.resolve(2, "13:00", 75)
    expect(formatDateKey(a.date)).toBe(formatDateKey(b.date))
    expect(formatDateKey(b.date)).toBe(formatDateKey(c.date))
  })

  it("produces identical results across independent scheduler instances given the same reference date (idempotent)", () => {
    const run = () => {
      const s = makeScheduler()
      return [
        s.resolve(2, "08:00", 75),
        s.resolve(3, "10:30", 45),
        s.resolve(-42, "10:00", 45),
        s.resolve(-42, "10:00", 40),
      ]
    }
    const first = run()
    const second = run()
    expect(first).toEqual(second)
  })

  it("shifts overlapping bookings on the same date to a non-overlapping, buffered slot", () => {
    const scheduler = makeScheduler(15)
    const first = scheduler.resolve(-42, "10:00", 45) // occupies 10:00-10:45 (+ buffer)
    const second = scheduler.resolve(-42, "10:00", 40) // same offset+time as first — must move
    expect(first.startTime).toBe("10:00")
    expect(second.startTime).not.toBe("10:00")

    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number)
      return h * 60 + m
    }
    const firstStart = toMin(first.startTime)
    const firstEnd = toMin(first.endTime)
    const secondStart = toMin(second.startTime)
    const secondEnd = toMin(second.endTime)
    const gapOk =
      secondStart >= firstEnd + 15 || firstStart >= secondEnd + 15
    expect(gapOk).toBe(true)
  })

  it("never produces two resolved bookings that overlap on the same date, across many bookings", () => {
    const scheduler = makeScheduler(15)
    const specs: Array<[number, string, number]> = [
      [2, "08:00", 75],
      [2, "10:30", 45],
      [2, "13:00", 75],
      [3, "10:30", 75],
      [-42, "10:00", 45],
      [-42, "10:00", 40],
      [-56, "09:00", 75],
      [-56, "08:00", 75],
    ]
    const byDate = new Map<string, Array<{ start: number; end: number }>>()
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number)
      return h * 60 + m
    }
    for (const [offset, preferred, duration] of specs) {
      const r = scheduler.resolve(offset, preferred, duration)
      const key = formatDateKey(r.date)
      const list = byDate.get(key) ?? []
      const start = toMin(r.startTime)
      const end = toMin(r.endTime)
      for (const existing of list) {
        const overlaps = start < existing.end && end > existing.start
        expect(overlaps).toBe(false)
      }
      list.push({ start, end })
      byDate.set(key, list)
    }
  })
})
