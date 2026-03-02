import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

// Mock BroadcastChannel before importing module
class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = []
  name: string
  onmessage: ((event: MessageEvent) => void) | null = null
  closed = false

  constructor(name: string) {
    this.name = name
    MockBroadcastChannel.instances.push(this)
  }

  postMessage(data: unknown) {
    // Deliver to all OTHER instances on the same channel
    MockBroadcastChannel.instances
      .filter((i) => i !== this && i.name === this.name && !i.closed)
      .forEach((i) => {
        if (i.onmessage) {
          i.onmessage(new MessageEvent("message", { data }))
        }
      })
  }

  close() {
    this.closed = true
    MockBroadcastChannel.instances = MockBroadcastChannel.instances.filter(
      (i) => i !== this
    )
  }
}

// Install mock globally before imports
vi.stubGlobal("BroadcastChannel", MockBroadcastChannel)

import {
  createTabCoordinator,
} from "./tab-coordinator"

beforeEach(() => {
  MockBroadcastChannel.instances = []
})

afterEach(() => {
  MockBroadcastChannel.instances.forEach((i) => i.close())
  MockBroadcastChannel.instances = []
})

describe("tab-coordinator", () => {
  describe("acquireSyncLock", () => {
    it("should acquire lock when no other tab is syncing", async () => {
      const coordinator = createTabCoordinator()
      const acquired = await coordinator.acquireSyncLock()
      expect(acquired).toBe(true)
      coordinator.destroy()
    })

    it("should deny lock when another tab has already acquired it", async () => {
      const tabA = createTabCoordinator()
      const tabB = createTabCoordinator()

      const acquiredA = await tabA.acquireSyncLock()
      expect(acquiredA).toBe(true)

      const acquiredB = await tabB.acquireSyncLock()
      expect(acquiredB).toBe(false)

      tabA.destroy()
      tabB.destroy()
    })

    it("should allow re-acquisition after release", async () => {
      const tabA = createTabCoordinator()
      const tabB = createTabCoordinator()

      await tabA.acquireSyncLock()
      tabA.releaseSyncLock()

      // Small delay to let the message propagate
      await tick()

      const acquiredB = await tabB.acquireSyncLock()
      expect(acquiredB).toBe(true)

      tabA.destroy()
      tabB.destroy()
    })
  })

  describe("releaseSyncLock", () => {
    it("should broadcast SYNC_COMPLETED when releasing lock", async () => {
      const tabA = createTabCoordinator()
      const tabB = createTabCoordinator()

      const completedPromise = new Promise<void>((resolve) => {
        tabB.onSyncCompleted(resolve)
      })

      await tabA.acquireSyncLock()
      tabA.releaseSyncLock()

      await completedPromise
      // If we get here, the callback was called

      tabA.destroy()
      tabB.destroy()
    })
  })

  describe("onSyncCompleted", () => {
    it("should call callback when another tab completes sync", async () => {
      const tabA = createTabCoordinator()
      const tabB = createTabCoordinator()

      const callback = vi.fn()
      tabB.onSyncCompleted(callback)

      await tabA.acquireSyncLock()
      tabA.releaseSyncLock()

      await tick()

      expect(callback).toHaveBeenCalledTimes(1)

      tabA.destroy()
      tabB.destroy()
    })

    it("should not call callback when same tab completes sync", async () => {
      const tabA = createTabCoordinator()

      const callback = vi.fn()
      tabA.onSyncCompleted(callback)

      await tabA.acquireSyncLock()
      tabA.releaseSyncLock()

      await tick()

      // BroadcastChannel doesn't deliver to sender -- callback should not fire
      expect(callback).not.toHaveBeenCalled()

      tabA.destroy()
    })
  })

  describe("onCacheUpdated", () => {
    it("should call callback when another tab broadcasts cache update", async () => {
      const tabA = createTabCoordinator()
      const tabB = createTabCoordinator()

      const callback = vi.fn()
      tabB.onCacheUpdated(callback)

      await tabA.acquireSyncLock()
      tabA.releaseSyncLock()

      await tick()

      expect(callback).toHaveBeenCalledTimes(1)

      tabA.destroy()
      tabB.destroy()
    })
  })

  describe("destroy", () => {
    it("should clean up BroadcastChannel on destroy", async () => {
      const coordinator = createTabCoordinator()
      expect(MockBroadcastChannel.instances.length).toBeGreaterThan(0)

      coordinator.destroy()

      // All instances from this coordinator should be closed
      expect(
        MockBroadcastChannel.instances.filter((i) => !i.closed)
      ).toHaveLength(0)
    })
  })

  describe("fallback without BroadcastChannel", () => {
    it("should always acquire lock when BroadcastChannel is unavailable", async () => {
      const original = globalThis.BroadcastChannel
      // @ts-expect-error -- Simulating missing BroadcastChannel
      delete globalThis.BroadcastChannel

      const coordinator = createTabCoordinator()
      const acquired = await coordinator.acquireSyncLock()
      expect(acquired).toBe(true)

      coordinator.destroy()
      globalThis.BroadcastChannel = original
    })

    it("should not throw when releasing without BroadcastChannel", () => {
      const original = globalThis.BroadcastChannel
      // @ts-expect-error -- Simulating missing BroadcastChannel
      delete globalThis.BroadcastChannel

      const coordinator = createTabCoordinator()
      expect(() => coordinator.releaseSyncLock()).not.toThrow()

      coordinator.destroy()
      globalThis.BroadcastChannel = original
    })
  })

  describe("three-tab coordination", () => {
    it("should allow only one tab to sync at a time among three tabs", async () => {
      const tabA = createTabCoordinator()
      const tabB = createTabCoordinator()
      const tabC = createTabCoordinator()

      const acquiredA = await tabA.acquireSyncLock()
      expect(acquiredA).toBe(true)

      const acquiredB = await tabB.acquireSyncLock()
      expect(acquiredB).toBe(false)

      const acquiredC = await tabC.acquireSyncLock()
      expect(acquiredC).toBe(false)

      tabA.releaseSyncLock()
      await tick()

      // Now tab B should be able to acquire
      const acquiredB2 = await tabB.acquireSyncLock()
      expect(acquiredB2).toBe(true)

      tabA.destroy()
      tabB.destroy()
      tabC.destroy()
    })
  })
})

/** Flush micro-task queue */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
