import { describe, it, expect, vi } from "vitest"
import {
  clearUserDataCaches,
  USER_DATA_CACHE_NAMES,
  AUTH_SESSION_CACHE_NAME,
  API_CACHE_NAME,
} from "./sw-cache-cleanup"

function mockCacheStorage(): CacheStorage {
  return { delete: vi.fn().mockResolvedValue(true) } as unknown as CacheStorage
}

describe("USER_DATA_CACHE_NAMES", () => {
  it("includes the auth-session and apis caches", () => {
    expect(USER_DATA_CACHE_NAMES).toContain(AUTH_SESSION_CACHE_NAME)
    expect(USER_DATA_CACHE_NAMES).toContain(API_CACHE_NAME)
  })

  it("includes the page/RSC caches (rendered authenticated pages)", () => {
    // These come from @serwist/next/worker's PAGES_CACHE_NAME -- just assert
    // there are entries beyond auth-session/apis, without hardcoding the
    // exact strings (that's the package's concern, not ours).
    expect(USER_DATA_CACHE_NAMES.length).toBeGreaterThan(2)
  })

  it("does NOT include static asset or image caches", () => {
    const staticLike = USER_DATA_CACHE_NAMES.filter((n) =>
      /static|image|precache/i.test(n)
    )
    expect(staticLike).toHaveLength(0)
  })
})

describe("clearUserDataCaches", () => {
  it("deletes every cache in USER_DATA_CACHE_NAMES", async () => {
    const cacheStorage = mockCacheStorage()
    await clearUserDataCaches(cacheStorage)

    expect(cacheStorage.delete).toHaveBeenCalledTimes(USER_DATA_CACHE_NAMES.length)
    for (const name of USER_DATA_CACHE_NAMES) {
      expect(cacheStorage.delete).toHaveBeenCalledWith(name)
    }
  })

  it("does not throw if a cache does not exist (delete resolves false)", async () => {
    const cacheStorage = { delete: vi.fn().mockResolvedValue(false) } as unknown as CacheStorage
    await expect(clearUserDataCaches(cacheStorage)).resolves.toBeUndefined()
  })
})
