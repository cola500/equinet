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

export interface EndpointCacheRecord {
  url: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  cachedAt: number
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
  endpointCache: EntityTable<EndpointCacheRecord, "url">
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

db.version(3).stores({
  bookings: "id",
  routes: "id",
  profile: "id",
  metadata: "key",
  debugLogs: "++id, timestamp, category",
  endpointCache: "&url, cachedAt",
})

export { db as offlineDb }
