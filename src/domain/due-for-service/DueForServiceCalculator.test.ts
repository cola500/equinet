import { describe, it, expect } from "vitest"
import {
  calculateDueStatus,
  resolveInterval,
  type HorseServiceRecord,
} from "./DueForServiceCalculator"

const MS_PER_DAY = 1000 * 60 * 60 * 24

function daysAgo(days: number, from: Date = new Date("2026-03-01T12:00:00Z")): Date {
  return new Date(from.getTime() - days * MS_PER_DAY)
}

function makeRecord(overrides: Partial<HorseServiceRecord> = {}): HorseServiceRecord {
  return {
    horseId: "horse-1",
    horseName: "Blansen",
    serviceId: "service-1",
    serviceName: "Hovslagar",
    lastServiceDate: daysAgo(42), // 6 weeks ago
    intervalWeeks: 6,
    ...overrides,
  }
}

const NOW = new Date("2026-03-01T12:00:00Z")

describe("resolveInterval", () => {
  it("returns override when provided", () => {
    expect(resolveInterval(6, 4)).toBe(4)
  })

  it("returns default when override is null", () => {
    expect(resolveInterval(6, null)).toBe(6)
  })

  it("returns default when override is undefined", () => {
    expect(resolveInterval(8, undefined as unknown as null)).toBe(8)
  })

  // --- New: 3-tier priority with customerInterval ---

  it("returns customerInterval when set (highest priority)", () => {
    expect(resolveInterval(6, 4, 8)).toBe(8)
  })

  it("returns providerOverride when customerInterval is null", () => {
    expect(resolveInterval(6, 4, null)).toBe(4)
  })

  it("returns providerOverride when customerInterval is undefined", () => {
    expect(resolveInterval(6, 4, undefined)).toBe(4)
  })

  it("returns customerInterval even when defaultWeeks is null", () => {
    expect(resolveInterval(null, null, 10)).toBe(10)
  })

  it("returns null when all sources are null", () => {
    expect(resolveInterval(null, null, null)).toBeNull()
  })
})

describe("calculateDueStatus", () => {
  it("returns overdue when last service was 10 weeks ago with 6-week interval", () => {
    const record = makeRecord({
      lastServiceDate: daysAgo(70, NOW), // 10 weeks
      intervalWeeks: 6,
    })
    const result = calculateDueStatus(record, NOW)

    expect(result.status).toBe("overdue")
    expect(result.daysUntilDue).toBeLessThan(0)
    expect(result.horseName).toBe("Blansen")
    expect(result.horseId).toBe("horse-1")
  })

  it("returns upcoming when last service was 5 weeks ago with 6-week interval", () => {
    const record = makeRecord({
      lastServiceDate: daysAgo(35, NOW), // 5 weeks
      intervalWeeks: 6,
    })
    const result = calculateDueStatus(record, NOW)

    expect(result.status).toBe("upcoming")
    // Due in 7 days (42 - 35 = 7)
    expect(result.daysUntilDue).toBe(7)
  })

  it("returns ok when last service was 2 weeks ago with 6-week interval", () => {
    const record = makeRecord({
      lastServiceDate: daysAgo(14, NOW), // 2 weeks
      intervalWeeks: 6,
    })
    const result = calculateDueStatus(record, NOW)

    expect(result.status).toBe("ok")
    // Due in 28 days (42 - 14 = 28)
    expect(result.daysUntilDue).toBe(28)
  })

  it("returns upcoming when daysUntilDue is 0 (due today)", () => {
    const record = makeRecord({
      lastServiceDate: daysAgo(42, NOW), // exactly 6 weeks
      intervalWeeks: 6,
    })
    const result = calculateDueStatus(record, NOW)

    expect(result.status).toBe("upcoming")
    expect(result.daysUntilDue).toBe(0)
  })

  it("returns upcoming when daysUntilDue is exactly 14", () => {
    const record = makeRecord({
      lastServiceDate: daysAgo(28, NOW), // 4 weeks ago, 6 week interval = 14 days left
      intervalWeeks: 6,
    })
    const result = calculateDueStatus(record, NOW)

    expect(result.status).toBe("upcoming")
    expect(result.daysUntilDue).toBe(14)
  })

  it("returns ok when daysUntilDue is 15", () => {
    const record = makeRecord({
      lastServiceDate: daysAgo(27, NOW), // 27 days ago, 6 week interval = 15 days left
      intervalWeeks: 6,
    })
    const result = calculateDueStatus(record, NOW)

    expect(result.status).toBe("ok")
    expect(result.daysUntilDue).toBe(15)
  })

  it("calculates daysSinceService correctly", () => {
    const record = makeRecord({
      lastServiceDate: daysAgo(45, NOW),
      intervalWeeks: 8,
    })
    const result = calculateDueStatus(record, NOW)

    expect(result.daysSinceService).toBe(45)
  })

  it("calculates dueDate correctly", () => {
    const lastService = daysAgo(10, NOW)
    const record = makeRecord({
      lastServiceDate: lastService,
      intervalWeeks: 4,
    })
    const result = calculateDueStatus(record, NOW)

    // dueDate = lastService + 4*7 = lastService + 28 days
    const expectedDueDate = new Date(lastService)
    expectedDueDate.setDate(expectedDueDate.getDate() + 28)
    expect(result.dueDate).toBe(expectedDueDate.toISOString())
  })

  it("returns lastServiceDate as ISO string", () => {
    const lastService = daysAgo(10, NOW)
    const record = makeRecord({ lastServiceDate: lastService })
    const result = calculateDueStatus(record, NOW)

    expect(result.lastServiceDate).toBe(lastService.toISOString())
  })

  it("preserves all input fields in result", () => {
    const record = makeRecord({
      horseId: "h-123",
      horseName: "Stella",
      serviceId: "s-456",
      serviceName: "Tandvard",
    })
    const result = calculateDueStatus(record, NOW)

    expect(result.horseId).toBe("h-123")
    expect(result.horseName).toBe("Stella")
    expect(result.serviceId).toBe("s-456")
    expect(result.serviceName).toBe("Tandvard")
  })

  it("uses current time when now is not provided", () => {
    const record = makeRecord({
      lastServiceDate: new Date(), // just now
      intervalWeeks: 6,
    })
    const result = calculateDueStatus(record)

    expect(result.status).toBe("ok")
    expect(result.daysSinceService).toBe(0)
  })
})
