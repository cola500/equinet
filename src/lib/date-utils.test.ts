import { describe, it, expect } from "vitest"
import { parseDate, formatDateToString, isValidDateString } from "./date-utils"

describe("parseDate", () => {
  it("should parse a valid YYYY-MM-DD date", () => {
    const date = parseDate("2026-01-27")
    expect(date.getUTCFullYear()).toBe(2026)
    expect(date.getUTCMonth()).toBe(0) // January is 0
    expect(date.getUTCDate()).toBe(27)
  })

  it("should return UTC time (midnight)", () => {
    const date = parseDate("2026-01-27")
    expect(date.getUTCHours()).toBe(0)
    expect(date.getUTCMinutes()).toBe(0)
    expect(date.getUTCSeconds()).toBe(0)
  })

  it("should handle month boundaries correctly", () => {
    // Last day of January
    const jan31 = parseDate("2026-01-31")
    expect(jan31.getUTCMonth()).toBe(0)
    expect(jan31.getUTCDate()).toBe(31)

    // First day of February
    const feb1 = parseDate("2026-02-01")
    expect(feb1.getUTCMonth()).toBe(1)
    expect(feb1.getUTCDate()).toBe(1)
  })

  it("should handle year boundaries correctly", () => {
    // Last day of 2025
    const dec31 = parseDate("2025-12-31")
    expect(dec31.getUTCFullYear()).toBe(2025)
    expect(dec31.getUTCMonth()).toBe(11) // December is 11
    expect(dec31.getUTCDate()).toBe(31)

    // First day of 2026
    const jan1 = parseDate("2026-01-01")
    expect(jan1.getUTCFullYear()).toBe(2026)
    expect(jan1.getUTCMonth()).toBe(0)
    expect(jan1.getUTCDate()).toBe(1)
  })

  it("should handle leap year dates", () => {
    // 2024 is a leap year
    const leapDay = parseDate("2024-02-29")
    expect(leapDay.getUTCFullYear()).toBe(2024)
    expect(leapDay.getUTCMonth()).toBe(1)
    expect(leapDay.getUTCDate()).toBe(29)
  })

  it("should throw on invalid format - missing parts", () => {
    expect(() => parseDate("2026-01")).toThrow("Invalid date format")
    expect(() => parseDate("2026")).toThrow("Invalid date format")
    expect(() => parseDate("01-27")).toThrow("Invalid date format")
  })

  it("should throw on invalid format - wrong separators", () => {
    expect(() => parseDate("2026/01/27")).toThrow("Invalid date format")
    expect(() => parseDate("2026.01.27")).toThrow("Invalid date format")
    expect(() => parseDate("20260127")).toThrow("Invalid date format")
  })

  it("should throw on invalid format - non-numeric", () => {
    expect(() => parseDate("abcd-ef-gh")).toThrow("Invalid date format")
    expect(() => parseDate("2026-Jan-27")).toThrow("Invalid date format")
  })

  it("should throw on empty string", () => {
    expect(() => parseDate("")).toThrow("Invalid date format")
  })
})

describe("formatDateToString", () => {
  it("should format a UTC date to YYYY-MM-DD", () => {
    const date = new Date("2026-01-27T00:00:00.000Z")
    expect(formatDateToString(date)).toBe("2026-01-27")
  })

  it("should pad single-digit months and days", () => {
    const date = new Date("2026-01-05T00:00:00.000Z")
    expect(formatDateToString(date)).toBe("2026-01-05")

    const date2 = new Date("2026-09-09T00:00:00.000Z")
    expect(formatDateToString(date2)).toBe("2026-09-09")
  })

  it("should handle December correctly", () => {
    const date = new Date("2026-12-31T00:00:00.000Z")
    expect(formatDateToString(date)).toBe("2026-12-31")
  })

  it("should roundtrip with parseDate", () => {
    const original = "2026-06-15"
    const parsed = parseDate(original)
    const formatted = formatDateToString(parsed)
    expect(formatted).toBe(original)
  })
})

describe("isValidDateString", () => {
  it("should return true for valid YYYY-MM-DD format", () => {
    expect(isValidDateString("2026-01-27")).toBe(true)
    expect(isValidDateString("2024-02-29")).toBe(true)
    expect(isValidDateString("1999-12-31")).toBe(true)
  })

  it("should return false for invalid formats", () => {
    expect(isValidDateString("2026/01/27")).toBe(false)
    expect(isValidDateString("2026-1-27")).toBe(false)
    expect(isValidDateString("26-01-27")).toBe(false)
    expect(isValidDateString("2026-01")).toBe(false)
    expect(isValidDateString("")).toBe(false)
    expect(isValidDateString("not-a-date")).toBe(false)
  })
})
