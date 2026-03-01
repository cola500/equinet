import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useMutationSync, _resetSyncGuard } from "./useMutationSync"

// Mock dependencies
vi.mock("./useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(() => true),
}))

vi.mock("@/components/providers/FeatureFlagProvider", () => ({
  useFeatureFlag: vi.fn(() => true),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}))

const mockProcessQueue = vi.fn(async () => ({ synced: 0, failed: 0, conflicts: 0, rateLimited: 0 }))
vi.mock("@/lib/offline/sync-engine", () => ({
  processMutationQueue: (...args: unknown[]) => mockProcessQueue(...args),
}))

const mockGetPendingCount = vi.fn(async () => 0)
const mockGetUnsyncedMutations = vi.fn(async () => [])
vi.mock("@/lib/offline/mutation-queue", () => ({
  getPendingCount: (...args: unknown[]) => mockGetPendingCount(...args),
  getUnsyncedMutations: (...args: unknown[]) => mockGetUnsyncedMutations(...args),
}))

const mockGlobalMutate = vi.fn(async () => undefined)
vi.mock("swr", () => ({
  mutate: (...args: unknown[]) => mockGlobalMutate(...args),
}))

import { useOnlineStatus } from "./useOnlineStatus"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { toast } from "sonner"

const mockUseOnlineStatus = vi.mocked(useOnlineStatus)
const mockUseFeatureFlag = vi.mocked(useFeatureFlag)

beforeEach(() => {
  _resetSyncGuard()
  mockUseOnlineStatus.mockReturnValue(true)
  mockUseFeatureFlag.mockReturnValue(true)
  mockProcessQueue.mockResolvedValue({ synced: 0, failed: 0, conflicts: 0, rateLimited: 0 })
  mockGetPendingCount.mockResolvedValue(0)
  mockGetUnsyncedMutations.mockResolvedValue([])
  mockGlobalMutate.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("useMutationSync", () => {
  it("should return initial state", () => {
    const { result } = renderHook(() => useMutationSync())

    expect(result.current.pendingCount).toBe(0)
    expect(result.current.isSyncing).toBe(false)
    expect(result.current.lastSyncResult).toBeNull()
  })

  it("should trigger sync on offline-to-online transition", async () => {
    mockUseOnlineStatus.mockReturnValue(false)
    mockGetPendingCount.mockResolvedValue(2)
    mockProcessQueue.mockResolvedValue({ synced: 2, failed: 0, conflicts: 0, rateLimited: 0 })

    const { rerender } = renderHook(() => useMutationSync())

    // Transition to online
    mockUseOnlineStatus.mockReturnValue(true)
    rerender()

    await waitFor(() => {
      expect(mockProcessQueue).toHaveBeenCalled()
    })
  })

  it("should show success toast when mutations are synced", async () => {
    mockUseOnlineStatus.mockReturnValue(false)
    mockGetPendingCount.mockResolvedValue(2)
    mockProcessQueue.mockResolvedValue({ synced: 2, failed: 0, conflicts: 0, rateLimited: 0 })

    const { rerender } = renderHook(() => useMutationSync())

    mockUseOnlineStatus.mockReturnValue(true)
    rerender()

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("2 ändringar synkade")
    })
  })

  it("should show warning toast when some mutations have conflicts", async () => {
    mockUseOnlineStatus.mockReturnValue(false)
    mockGetPendingCount.mockResolvedValue(3)
    mockProcessQueue.mockResolvedValue({ synced: 1, failed: 0, conflicts: 2, rateLimited: 0 })

    const { rerender } = renderHook(() => useMutationSync())

    mockUseOnlineStatus.mockReturnValue(true)
    rerender()

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalled()
    })
  })

  it("should show conflict warning toast with longer duration", async () => {
    mockUseOnlineStatus.mockReturnValue(false)
    mockGetPendingCount.mockResolvedValue(3)
    mockProcessQueue.mockResolvedValue({ synced: 1, failed: 0, conflicts: 2, rateLimited: 0 })

    const { rerender } = renderHook(() => useMutationSync())

    mockUseOnlineStatus.mockReturnValue(true)
    rerender()

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining("kunde inte synkas"),
        expect.objectContaining({ duration: 8000 })
      )
    })
  })

  it("should not sync when feature flag is off", async () => {
    mockUseFeatureFlag.mockReturnValue(false)
    mockUseOnlineStatus.mockReturnValue(false)
    mockGetPendingCount.mockResolvedValue(1)

    const { rerender } = renderHook(() => useMutationSync())

    // Clear any calls from setup
    mockProcessQueue.mockClear()

    mockUseOnlineStatus.mockReturnValue(true)
    rerender()

    // Give async code time to run
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })

    expect(mockProcessQueue).not.toHaveBeenCalled()
  })

  it("should update pending count on mutation-queued event", async () => {
    mockGetPendingCount.mockResolvedValue(3)

    const { result } = renderHook(() => useMutationSync())

    // Wait for initial count
    await waitFor(() => {
      expect(result.current.pendingCount).toBe(3)
    })

    // Simulate new mutation queued
    mockGetPendingCount.mockResolvedValue(4)
    act(() => {
      window.dispatchEvent(new CustomEvent("mutation-queued"))
    })

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(4)
    })
  })

  it("should trigger SWR global revalidation after sync", async () => {
    mockUseOnlineStatus.mockReturnValue(false)
    mockProcessQueue.mockResolvedValue({ synced: 1, failed: 0, conflicts: 0, rateLimited: 0 })

    const { rerender } = renderHook(() => useMutationSync())

    // Transition to online
    mockUseOnlineStatus.mockReturnValue(true)
    rerender()

    await waitFor(() => {
      expect(mockGlobalMutate).toHaveBeenCalledWith(
        expect.any(Function),
        undefined,
        { revalidate: true }
      )
    })
  })

  it("should revalidate all keys when all mutations sync successfully", async () => {
    mockUseOnlineStatus.mockReturnValue(false)
    mockProcessQueue.mockResolvedValue({ synced: 2, failed: 0, conflicts: 0, rateLimited: 0 })
    mockGetUnsyncedMutations.mockResolvedValue([]) // all synced

    const { rerender } = renderHook(() => useMutationSync())

    mockUseOnlineStatus.mockReturnValue(true)
    rerender()

    await waitFor(() => {
      expect(mockGlobalMutate).toHaveBeenCalledWith(
        expect.any(Function),
        undefined,
        { revalidate: true }
      )
      // The filter function should match ALL keys when no unsynced remain
      const filterFn = mockGlobalMutate.mock.calls[0][0] as (key: string) => boolean
      expect(filterFn("/api/bookings")).toBe(true)
      expect(filterFn("/api/routes/my-routes")).toBe(true)
    })
  })

  it("should skip revalidation for SWR keys with unsynced mutations after partial sync", async () => {
    mockUseOnlineStatus.mockReturnValue(false)
    mockProcessQueue.mockResolvedValue({ synced: 1, failed: 1, conflicts: 0, rateLimited: 0 })
    mockGetUnsyncedMutations.mockResolvedValue([
      { id: 1, method: "POST", url: "/api/bookings/manual", body: "{}", entityType: "manual-booking", entityId: "mb1", status: "failed", retryCount: 3, createdAt: Date.now() },
    ])

    const { rerender } = renderHook(() => useMutationSync())

    // Clear any leaked calls from previous tests before triggering sync
    mockGlobalMutate.mockClear()
    mockUseOnlineStatus.mockReturnValue(true)
    rerender()

    await waitFor(() => {
      expect(mockGlobalMutate).toHaveBeenCalled()
      const lastCall = mockGlobalMutate.mock.calls[mockGlobalMutate.mock.calls.length - 1]
      const filterFn = lastCall[0] as (key: string) => boolean
      // /api/bookings should be SKIPPED (affected by failed manual-booking mutation)
      expect(filterFn("/api/bookings")).toBe(false)
      // /api/routes/my-routes should be revalidated (not affected)
      expect(filterFn("/api/routes/my-routes")).toBe(true)
    })
  })

  it("should filter out affected keys when some mutations remain pending", async () => {
    mockUseOnlineStatus.mockReturnValue(false)
    mockProcessQueue.mockResolvedValue({ synced: 0, failed: 0, conflicts: 0, rateLimited: 1 })
    mockGetUnsyncedMutations.mockResolvedValue([
      { id: 2, method: "PATCH", url: "/api/routes/r1/stops/s1", body: "{}", entityType: "route-stop", entityId: "s1", status: "pending", retryCount: 0, createdAt: Date.now() },
      { id: 3, method: "DELETE", url: "/api/bookings/b1", body: "{}", entityType: "booking", entityId: "b1", status: "pending", retryCount: 0, createdAt: Date.now() },
    ])

    const { rerender } = renderHook(() => useMutationSync())

    mockGlobalMutate.mockClear()
    mockUseOnlineStatus.mockReturnValue(true)
    rerender()

    await waitFor(() => {
      expect(mockGlobalMutate).toHaveBeenCalled()
      const lastCall = mockGlobalMutate.mock.calls[mockGlobalMutate.mock.calls.length - 1]
      const filterFn = lastCall[0] as (key: string) => boolean
      // Both /api/bookings and /api/routes/my-routes should be skipped
      expect(filterFn("/api/bookings")).toBe(false)
      expect(filterFn("/api/routes/my-routes")).toBe(false)
      // Other keys should still revalidate
      expect(filterFn("/api/services")).toBe(true)
    })
  })

  it("should map /api/bookings/manual to /api/bookings SWR key", async () => {
    mockUseOnlineStatus.mockReturnValue(false)
    mockProcessQueue.mockResolvedValue({ synced: 0, failed: 1, conflicts: 0, rateLimited: 0 })
    mockGetUnsyncedMutations.mockResolvedValue([
      { id: 1, method: "POST", url: "/api/bookings/manual", body: "{}", entityType: "manual-booking", entityId: "mb1", status: "failed", retryCount: 3, createdAt: Date.now() },
    ])

    const { rerender } = renderHook(() => useMutationSync())

    mockGlobalMutate.mockClear()
    mockUseOnlineStatus.mockReturnValue(true)
    rerender()

    await waitFor(() => {
      expect(mockGlobalMutate).toHaveBeenCalled()
      const lastCall = mockGlobalMutate.mock.calls[mockGlobalMutate.mock.calls.length - 1]
      const filterFn = lastCall[0] as (key: string) => boolean
      expect(filterFn("/api/bookings")).toBe(false)
    })
  })

  it("should prevent concurrent syncs via module-level guard", async () => {
    // Make the first sync block until we explicitly resolve
    let resolveFirst!: () => void
    const blockingPromise = new Promise<void>((resolve) => {
      resolveFirst = resolve
    })
    mockProcessQueue.mockImplementation(async () => {
      await blockingPromise
      return { synced: 1, failed: 0, conflicts: 0, rateLimited: 0 }
    })

    const { result } = renderHook(() => useMutationSync())

    // Start first sync (it will block on the promise)
    let firstSync: Promise<void>
    act(() => {
      firstSync = result.current.triggerSync()
    })

    // Clear call count, then try second sync while first is still pending
    mockProcessQueue.mockClear()
    act(() => {
      result.current.triggerSync()
    })

    // Second call should have been blocked by the module-level guard
    expect(mockProcessQueue).toHaveBeenCalledTimes(0)

    // Cleanup: resolve blocking promise
    await act(async () => {
      resolveFirst()
      await firstSync!
    })
  })
})
