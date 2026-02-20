import Dexie, { type EntityTable } from "dexie"

export interface CachedRecord {
  id: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  cachedAt: number
}

export interface MetadataRecord {
  key: string
  lastSyncedAt: number
  version: number
}

export interface DebugLogEntry {
  id?: number
  timestamp: number
  category: "network" | "auth" | "navigation" | "error" | "sw" | "general" | "bugreport"
  level: "info" | "warn" | "error"
  message: string
  data?: string
}

const db = new Dexie("equinet-offline") as Dexie & {
  bookings: EntityTable<CachedRecord, "id">
  routes: EntityTable<CachedRecord, "id">
  profile: EntityTable<CachedRecord, "id">
  metadata: EntityTable<MetadataRecord, "key">
  debugLogs: EntityTable<DebugLogEntry, "id">
}

db.version(1).stores({
  bookings: "id",
  routes: "id",
  profile: "id",
  metadata: "key",
})

db.version(2).stores({
  bookings: "id",
  routes: "id",
  profile: "id",
  metadata: "key",
  debugLogs: "++id, timestamp, category",
})

export { db as offlineDb }
