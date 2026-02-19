import "fake-indexeddb/auto"
import { describe, it, expect, beforeEach } from "vitest"
import { offlineDb } from "./db"

describe("offlineDb", () => {
  beforeEach(async () => {
    await offlineDb.bookings.clear()
    await offlineDb.routes.clear()
    await offlineDb.profile.clear()
    await offlineDb.metadata.clear()
  })

  it("stores and retrieves bookings", async () => {
    await offlineDb.bookings.put({
      id: "booking-1",
      data: { status: "confirmed" },
      cachedAt: Date.now(),
    })

    const result = await offlineDb.bookings.get("booking-1")
    expect(result).toBeDefined()
    expect(result!.data).toEqual({ status: "confirmed" })
  })

  it("stores and retrieves routes", async () => {
    await offlineDb.routes.put({
      id: "route-1",
      data: { stops: 3 },
      cachedAt: Date.now(),
    })

    const result = await offlineDb.routes.get("route-1")
    expect(result).toBeDefined()
    expect(result!.data).toEqual({ stops: 3 })
  })

  it("stores and retrieves profile", async () => {
    await offlineDb.profile.put({
      id: "profile",
      data: { name: "Test Provider" },
      cachedAt: Date.now(),
    })

    const result = await offlineDb.profile.get("profile")
    expect(result).toBeDefined()
    expect(result!.data).toEqual({ name: "Test Provider" })
  })

  it("stores and retrieves metadata", async () => {
    await offlineDb.metadata.put({
      key: "lastSync",
      lastSyncedAt: Date.now(),
      version: 1,
    })

    const result = await offlineDb.metadata.get("lastSync")
    expect(result).toBeDefined()
    expect(result!.version).toBe(1)
  })

  it("overwrites existing entries on put", async () => {
    await offlineDb.bookings.put({
      id: "booking-1",
      data: { status: "pending" },
      cachedAt: Date.now(),
    })

    await offlineDb.bookings.put({
      id: "booking-1",
      data: { status: "confirmed" },
      cachedAt: Date.now(),
    })

    const result = await offlineDb.bookings.get("booking-1")
    expect(result!.data).toEqual({ status: "confirmed" })
  })

  it("can clear all data from a table", async () => {
    await offlineDb.bookings.put({
      id: "b1",
      data: {},
      cachedAt: Date.now(),
    })
    await offlineDb.bookings.put({
      id: "b2",
      data: {},
      cachedAt: Date.now(),
    })

    await offlineDb.bookings.clear()
    const count = await offlineDb.bookings.count()
    expect(count).toBe(0)
  })
})
