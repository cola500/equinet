import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useOfflineGuard } from "./useOfflineGuard"
import { toast } from "sonner"

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock("./useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(() => true),
}))

vi.mock("@/components/providers/FeatureFlagProvider", () => ({
  useFeatureFlag: vi.fn(() => true),
}))

const mockQueueMutation = vi.fn(async () => 1)
const mockGetPendingMutationsByEntity = vi.fn(async () => [])
vi.mock("@/lib/offline/mutation-queue", () => ({
  queueMutation: (...args: unknown[]) => mockQueueMutation(...args),
  getPendingMutationsByEntity: (...args: unknown[]) => mockGetPendingMutationsByEntity(...args),
}))

import { useOnlineStatus } from "./useOnlineStatus"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"

describe("useOfflineGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOnlineStatus).mockReturnValue(true)
    vi.mocked(useFeatureFlag).mockReturnValue(true)
    mockQueueMutation.mockResolvedValue(1)
    mockGetPendingMutationsByEntity.mockResolvedValue([])
  })

  // -- Existing behavior (backward compat) --

  it("should return isOnline true when online", () => {
    const { result } = renderHook(() => useOfflineGuard())
    expect(result.current.isOnline).toBe(true)
  })

  it("should return isOnline false when offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    const { result } = renderHook(() => useOfflineGuard())
    expect(result.current.isOnline).toBe(false)
  })

  it("should execute action when online", async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useOfflineGuard())

    await act(async () => {
      await result.current.guardMutation(action)
    })

    expect(action).toHaveBeenCalledOnce()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("should block action and show toast when offline (no offlineOptions)", async () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    const action = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useOfflineGuard())

    await act(async () => {
      await result.current.guardMutation(action)
    })

    expect(action).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(
      "Du är offline. Denna åtgärd kräver internetanslutning."
    )
  })

  it("should return action result when online", async () => {
    const action = vi.fn().mockResolvedValue("result")
    const { result } = renderHook(() => useOfflineGuard())

    let returnValue: unknown
    await act(async () => {
      returnValue = await result.current.guardMutation(action)
    })

    expect(returnValue).toBe("result")
  })

  // -- New offline queueing behavior --

  it("should queue mutation when offline with offlineOptions", async () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    const action = vi.fn().mockResolvedValue(undefined)
    const optimisticUpdate = vi.fn()
    const { result } = renderHook(() => useOfflineGuard())

    await act(async () => {
      await result.current.guardMutation(action, {
        method: "PUT",
        url: "/api/bookings/abc",
        body: JSON.stringify({ status: "completed" }),
        entityType: "booking",
        entityId: "abc",
        optimisticUpdate,
      })
    })

    expect(action).not.toHaveBeenCalled()
    expect(mockQueueMutation).toHaveBeenCalledWith({
      method: "PUT",
      url: "/api/bookings/abc",
      body: JSON.stringify({ status: "completed" }),
      entityType: "booking",
      entityId: "abc",
    })
    expect(optimisticUpdate).toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining("sparas offline")
    )
  })

  it("should still block when offline with offlineOptions but feature flag is off", async () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    vi.mocked(useFeatureFlag).mockReturnValue(false)
    const action = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useOfflineGuard())

    await act(async () => {
      await result.current.guardMutation(action, {
        method: "PUT",
        url: "/api/bookings/abc",
        body: JSON.stringify({ status: "completed" }),
        entityType: "booking",
        entityId: "abc",
      })
    })

    expect(action).not.toHaveBeenCalled()
    expect(mockQueueMutation).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
  })

  it("should deduplicate: not queue if identical mutation already pending", async () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    mockGetPendingMutationsByEntity.mockResolvedValue([
      { id: 1, method: "PUT", url: "/api/bookings/abc", body: JSON.stringify({ status: "completed" }), entityType: "booking", entityId: "abc", createdAt: Date.now(), status: "pending", retryCount: 0 },
    ])
    const action = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useOfflineGuard())

    await act(async () => {
      await result.current.guardMutation(action, {
        method: "PUT",
        url: "/api/bookings/abc",
        body: JSON.stringify({ status: "completed" }),
        entityType: "booking",
        entityId: "abc",
      })
    })

    expect(mockQueueMutation).not.toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining("redan sparad")
    )
  })

  it("should queue POST mutation when offline", async () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    const action = vi.fn().mockResolvedValue(undefined)
    const optimisticUpdate = vi.fn()
    const { result } = renderHook(() => useOfflineGuard())

    await act(async () => {
      await result.current.guardMutation(action, {
        method: "POST",
        url: "/api/bookings/manual",
        body: JSON.stringify({ service: "hoof-trim" }),
        entityType: "manual-booking",
        entityId: "temp-123",
        optimisticUpdate,
      })
    })

    expect(action).not.toHaveBeenCalled()
    expect(mockQueueMutation).toHaveBeenCalledWith({
      method: "POST",
      url: "/api/bookings/manual",
      body: JSON.stringify({ service: "hoof-trim" }),
      entityType: "manual-booking",
      entityId: "temp-123",
    })
    expect(optimisticUpdate).toHaveBeenCalled()
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining("sparas offline")
    )
  })

  it("should queue DELETE mutation when offline", async () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    const action = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useOfflineGuard())

    await act(async () => {
      await result.current.guardMutation(action, {
        method: "DELETE",
        url: "/api/providers/p1/availability-exceptions/2026-03-01",
        body: "",
        entityType: "availability-exception",
        entityId: "exception:2026-03-01",
      })
    })

    expect(action).not.toHaveBeenCalled()
    expect(mockQueueMutation).toHaveBeenCalledWith({
      method: "DELETE",
      url: "/api/providers/p1/availability-exceptions/2026-03-01",
      body: "",
      entityType: "availability-exception",
      entityId: "exception:2026-03-01",
    })
  })

  it("should execute action normally when online even with offlineOptions", async () => {
    const action = vi.fn().mockResolvedValue("ok")
    const { result } = renderHook(() => useOfflineGuard())

    let returnValue: unknown
    await act(async () => {
      returnValue = await result.current.guardMutation(action, {
        method: "PUT",
        url: "/api/bookings/abc",
        body: JSON.stringify({ status: "completed" }),
        entityType: "booking",
        entityId: "abc",
      })
    })

    expect(action).toHaveBeenCalled()
    expect(mockQueueMutation).not.toHaveBeenCalled()
    expect(returnValue).toBe("ok")
  })
})
