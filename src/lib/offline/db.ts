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

const db = new Dexie("equinet-offline") as Dexie & {
  bookings: EntityTable<CachedRecord, "id">
  routes: EntityTable<CachedRecord, "id">
  profile: EntityTable<CachedRecord, "id">
  metadata: EntityTable<MetadataRecord, "key">
}

db.version(1).stores({
  bookings: "id",
  routes: "id",
  profile: "id",
  metadata: "key",
})

export { db as offlineDb }
