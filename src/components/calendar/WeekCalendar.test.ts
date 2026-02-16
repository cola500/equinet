import { describe, it, expect } from "vitest"
import { positionToTime, getNowPosition } from "./WeekCalendar"

describe("positionToTime", () => {
  it("converts 0% to 08:00 (start of day)", () => {
    expect(positionToTime(0)).toBe("08:00")
  })

  it("converts 50% to 13:00 (midday)", () => {
    expect(positionToTime(50)).toBe("13:00")
  })

  it("converts 100% to 18:00 (end of day)", () => {
    expect(positionToTime(100)).toBe("18:00")
  })

  it("snaps 32.5% to 11:15 (nearest 15-min interval)", () => {
    // 32.5% of 600 min = 195 min -> already on 15-min boundary -> 08:00 + 3h15m = 11:15
    expect(positionToTime(32.5)).toBe("11:15")
  })

  it("snaps 34.2% to 11:30 (nearest 15-min interval)", () => {
    // 34.2% of 600 min = 205.2 min -> round to nearest 15 = 210 -> 08:00 + 3h30m = 11:30
    expect(positionToTime(34.2)).toBe("11:30")
  })

  it("clamps negative values to 08:00", () => {
    expect(positionToTime(-10)).toBe("08:00")
  })

  it("clamps values above 100 to 18:00", () => {
    expect(positionToTime(150)).toBe("18:00")
  })
})

describe("getNowPosition", () => {
  it("returns percentage for time within 08:00-18:00", () => {
    // 12:00 = 4h into 10h range = 40%
    expect(getNowPosition(12, 0)).toBe(40)
  })

  it("returns 0 at exactly 08:00", () => {
    expect(getNowPosition(8, 0)).toBe(0)
  })

  it("returns 100 at exactly 18:00", () => {
    expect(getNowPosition(18, 0)).toBe(100)
  })

  it("handles half hours correctly", () => {
    // 13:30 = 5.5h into 10h range = 55%
    expect(getNowPosition(13, 30)).toBeCloseTo(55, 5)
  })

  it("returns null before START_HOUR", () => {
    expect(getNowPosition(7, 30)).toBeNull()
  })

  it("returns null after END_HOUR", () => {
    expect(getNowPosition(18, 30)).toBeNull()
  })
})
