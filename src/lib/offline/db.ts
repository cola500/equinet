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
  category: "network" | "auth" | "navigation" | "error" | "sw" | "general" | "bugreport" | "sync"
  level: "info" | "warn" | "error"
  message: string
  data?: string
}

export type MutationStatus = "pending" | "syncing" | "synced" | "failed" | "conflict"

export interface PendingMutation {
  id?: number
  method: "PUT" | "PATCH" | "POST" | "DELETE"
  url: string
  body: string
  entityType: "booking" | "booking-notes" | "route-stop" | "availability-exception" | "manual-booking" | "availability-schedule" | "horse-interval" | "customer" | "customer-note" | "customer-horse" | "service"
  entityId: string
  createdAt: number
  status: MutationStatus
  retryCount: number
  error?: string
}

const db = new Dexie("equinet-offline") as Dexie & {
  bookings: EntityTable<CachedRecord, "id">
  routes: EntityTable<CachedRecord, "id">
  profile: EntityTable<CachedRecord, "id">
  metadata: EntityTable<MetadataRecord, "key">
  debugLogs: EntityTable<DebugLogEntry, "id">
  endpointCache: EntityTable<EndpointCacheRecord, "url">
  pendingMutations: EntityTable<PendingMutation, "id">
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

db.version(4).stores({
  bookings: "id",
  routes: "id",
  profile: "id",
  metadata: "key",
  debugLogs: "++id, timestamp, category",
  endpointCache: "&url, cachedAt",
  pendingMutations: "++id, status, entityId, createdAt",
})

export { db as offlineDb }
