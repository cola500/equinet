import { offlineDb } from "./db"

/** Maximum cache age: 4 hours (providers may be offline for extended periods) */
export const MAX_AGE_MS = 4 * 60 * 60 * 1000

// -- Bookings --

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cacheBookings(bookings: any[]): Promise<void> {
  const now = Date.now()
  await offlineDb.bookings.clear()
  await offlineDb.bookings.bulkPut(
    bookings.map((b) => ({ id: b.id ?? "all", data: b, cachedAt: now }))
  )
  await offlineDb.metadata.put({
    key: "bookings",
    lastSyncedAt: now,
    version: 1,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCachedBookings(): Promise<any[] | null> {
  const meta = await offlineDb.metadata.get("bookings")
  if (!meta || Date.now() - meta.lastSyncedAt > MAX_AGE_MS) {
    return null
  }
  const records = await offlineDb.bookings.toArray()
  if (records.length === 0) return null
  return records.map((r) => r.data)
}

// -- Routes --

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cacheRoutes(routes: any[]): Promise<void> {
  const now = Date.now()
  await offlineDb.routes.clear()
  await offlineDb.routes.bulkPut(
    routes.map((r) => ({ id: r.id ?? "all", data: r, cachedAt: now }))
  )
  await offlineDb.metadata.put({
    key: "routes",
    lastSyncedAt: now,
    version: 1,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCachedRoutes(): Promise<any[] | null> {
  const meta = await offlineDb.metadata.get("routes")
  if (!meta || Date.now() - meta.lastSyncedAt > MAX_AGE_MS) {
    return null
  }
  const records = await offlineDb.routes.toArray()
  if (records.length === 0) return null
  return records.map((r) => r.data)
}

// -- Profile --

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cacheProfile(profile: any): Promise<void> {
  const now = Date.now()
  await offlineDb.profile.put({
    id: "profile",
    data: profile,
    cachedAt: now,
  })
  await offlineDb.metadata.put({
    key: "profile",
    lastSyncedAt: now,
    version: 1,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCachedProfile(): Promise<any | null> {
  const meta = await offlineDb.metadata.get("profile")
  if (!meta || Date.now() - meta.lastSyncedAt > MAX_AGE_MS) {
    return null
  }
  const record = await offlineDb.profile.get("profile")
  if (!record) return null
  return record.data
}

// -- Cleanup --

export async function clearAllOfflineData(): Promise<void> {
  await Promise.all([
    offlineDb.bookings.clear(),
    offlineDb.routes.clear(),
    offlineDb.profile.clear(),
    offlineDb.metadata.clear(),
  ])
}
