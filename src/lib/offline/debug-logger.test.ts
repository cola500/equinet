import "fake-indexeddb/auto"
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { debugLog, getDebugLogs, clearDebugLogs } from "./debug-logger"
import { offlineDb } from "./db"

describe("debug-logger", () => {
  beforeEach(async () => {
    await offlineDb.debugLogs.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("saves entry with correct fields", async () => {
    await debugLog("network", "info", "Test message")

    const entries = await offlineDb.debugLogs.toArray()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      category: "network",
      level: "info",
      message: "Test message",
    })
    expect(entries[0].timestamp).toBeGreaterThan(0)
    expect(entries[0].id).toBeDefined()
  })

  it("includes stringified data", async () => {
    await debugLog("auth", "warn", "Auth changed", { status: "unauthenticated" })

    const entries = await offlineDb.debugLogs.toArray()
    expect(entries[0].data).toBe('{"status":"unauthenticated"}')
  })

  it("swallows errors and never throws", async () => {
    vi.spyOn(offlineDb.debugLogs, "add").mockRejectedValue(new Error("DB error"))

    await expect(debugLog("error", "error", "This should not throw")).resolves.toBeUndefined()
  })

  it("returns entries in reverse chronological order", async () => {
    await debugLog("general", "info", "First")
    await debugLog("general", "info", "Second")
    await debugLog("general", "info", "Third")

    const logs = await getDebugLogs()
    expect(logs[0].message).toBe("Third")
    expect(logs[1].message).toBe("Second")
    expect(logs[2].message).toBe("First")
  })

  it("filters by category", async () => {
    await debugLog("network", "info", "Net event")
    await debugLog("auth", "info", "Auth event")
    await debugLog("network", "warn", "Another net event")

    const logs = await getDebugLogs({ category: "network" })
    expect(logs).toHaveLength(2)
    expect(logs.every((l) => l.category === "network")).toBe(true)
  })

  it("respects limit", async () => {
    for (let i = 0; i < 10; i++) {
      await debugLog("general", "info", `Entry ${i}`)
    }

    const logs = await getDebugLogs({ limit: 3 })
    expect(logs).toHaveLength(3)
    expect(logs[0].message).toBe("Entry 9")
  })

  it("prunes oldest entries when exceeding MAX_ENTRIES", async () => {
    // Insert 502 entries directly to avoid slow loop
    const entries = Array.from({ length: 502 }, (_, i) => ({
      timestamp: Date.now() + i,
      category: "general" as const,
      level: "info" as const,
      message: `Entry ${i}`,
    }))
    await offlineDb.debugLogs.bulkAdd(entries)

    // Trigger prune via a normal write
    await debugLog("general", "info", "Trigger prune")

    const count = await offlineDb.debugLogs.count()
    expect(count).toBeLessThanOrEqual(500)
  })

  it("clearDebugLogs empties the table", async () => {
    await debugLog("general", "info", "Entry 1")
    await debugLog("general", "info", "Entry 2")

    await clearDebugLogs()

    const count = await offlineDb.debugLogs.count()
    expect(count).toBe(0)
  })
})
