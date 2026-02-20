import { offlineDb, type DebugLogEntry } from "./db"

const MAX_ENTRIES = 500

export async function debugLog(
  category: DebugLogEntry["category"],
  level: DebugLogEntry["level"],
  message: string,
  data?: unknown
): Promise<void> {
  try {
    await offlineDb.debugLogs.add({
      timestamp: Date.now(),
      category,
      level,
      message,
      data: data !== undefined ? JSON.stringify(data) : undefined,
    })
    await pruneOldEntries()
  } catch {
    // Fire-and-forget: never throw from debug logging
  }
}

export async function getDebugLogs(options?: {
  category?: DebugLogEntry["category"]
  limit?: number
}): Promise<DebugLogEntry[]> {
  let collection = offlineDb.debugLogs.orderBy("timestamp").reverse()

  if (options?.category) {
    const category = options.category
    collection = collection.filter((entry) => entry.category === category)
  }

  if (options?.limit) {
    return collection.limit(options.limit).toArray()
  }

  return collection.toArray()
}

export async function clearDebugLogs(): Promise<void> {
  await offlineDb.debugLogs.clear()
}

async function pruneOldEntries(): Promise<void> {
  const count = await offlineDb.debugLogs.count()
  if (count > MAX_ENTRIES) {
    const excess = count - MAX_ENTRIES
    const oldest = await offlineDb.debugLogs
      .orderBy("timestamp")
      .limit(excess)
      .primaryKeys()
    await offlineDb.debugLogs.bulkDelete(oldest)
  }
}
