import "fake-indexeddb/auto"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { generateBugReport, submitBugReport, type BugReportInput } from "./bug-report"
import { offlineDb, type DebugLogEntry } from "./db"

function makeInput(overrides?: Partial<BugReportInput>): BugReportInput {
  return {
    description: "Knappen fungerar inte",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
    screenWidth: 390,
    screenHeight: 844,
    isStandalone: true,
    isOnline: false,
    isAuthenticated: true,
    currentUrl: "/provider/calendar",
    featureFlags: { offline_mode: true, recurring_bookings: false },
    debugLogs: [],
    ...overrides,
  }
}

const sampleLogs: DebugLogEntry[] = [
  { id: 1, timestamp: 1708430001000, category: "navigation", level: "info", message: "Navigated to /provider/calendar" },
  { id: 2, timestamp: 1708430002000, category: "network", level: "warn", message: "Went offline" },
]

describe("bug-report", () => {
  beforeEach(async () => {
    await offlineDb.debugLogs.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("generateBugReport", () => {
    it("produces header with timestamp", () => {
      const report = generateBugReport(makeInput())

      expect(report).toContain("=== EQUINET BUGGRAPPORT ===")
      expect(report).toMatch(/Tid: \d{4}-\d{2}-\d{2}T/)
      expect(report).toContain("=== SLUT PÅ RAPPORT ===")
    })

    it("includes user description", () => {
      const report = generateBugReport(makeInput({ description: "Sidan blir vit" }))

      expect(report).toContain("Beskrivning: Sidan blir vit")
    })

    it("includes device info", () => {
      const report = generateBugReport(makeInput())

      expect(report).toContain("User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")
      expect(report).toContain("Skärm: 390x844")
      expect(report).toContain("Standalone: Ja")
      expect(report).toContain("Online: Nej")
    })

    it("includes auth section", () => {
      const report = generateBugReport(makeInput({ isAuthenticated: true }))
      expect(report).toContain("Inloggad: Ja")

      const report2 = generateBugReport(makeInput({ isAuthenticated: false }))
      expect(report2).toContain("Inloggad: Nej")
    })

    it("includes current URL", () => {
      const report = generateBugReport(makeInput({ currentUrl: "/provider/bookings" }))

      expect(report).toContain("URL: /provider/bookings")
    })

    it("includes feature flags", () => {
      const report = generateBugReport(makeInput())

      expect(report).toContain("offline_mode: true")
      expect(report).toContain("recurring_bookings: false")
    })

    it("includes formatted debug logs", () => {
      const report = generateBugReport(makeInput({ debugLogs: sampleLogs }))

      expect(report).toContain("[navigation] [info] Navigated to /provider/calendar")
      expect(report).toContain("[network] [warn] Went offline")
    })

    it("handles empty debug logs", () => {
      const report = generateBugReport(makeInput({ debugLogs: [] }))

      expect(report).toContain("Inga loggar")
    })
  })

  describe("submitBugReport", () => {
    it("saves entry with category bugreport to IndexedDB", async () => {
      const input = makeInput()
      await submitBugReport(input)

      const entries = await offlineDb.debugLogs
        .where("category")
        .equals("bugreport")
        .toArray()
      expect(entries).toHaveLength(1)
      expect(entries[0].level).toBe("info")
      expect(entries[0].message).toContain("Buggrapport skapad")
    })

    it("returns the generated report text", async () => {
      const input = makeInput()
      const report = await submitBugReport(input)

      expect(report).toContain("=== EQUINET BUGGRAPPORT ===")
      expect(report).toContain("Knappen fungerar inte")
    })
  })
})
