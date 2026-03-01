import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { usePendingMutation } from "./usePendingMutation"

const mockGetActiveMutationsByEntity = vi.fn(async () => [])
vi.mock("@/lib/offline/mutation-queue", () => ({
  getActiveMutationsByEntity: (...args: unknown[]) =>
    mockGetActiveMutationsByEntity(...args),
}))

vi.mock("@/components/providers/FeatureFlagProvider", () => ({
  useFeatureFlag: vi.fn(() => true),
}))

beforeEach(() => {
  mockGetActiveMutationsByEntity.mockResolvedValue([])
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("usePendingMutation", () => {
  it("should return hasPending=false when no pending mutations", async () => {
    const { result } = renderHook(() => usePendingMutation("abc"))

    await waitFor(() => {
      expect(result.current.hasPending).toBe(false)
      expect(result.current.count).toBe(0)
    })
  })

  it("should return hasPending=true when entity has pending mutations", async () => {
    mockGetActiveMutationsByEntity.mockResolvedValue([
      { id: 1, entityId: "abc", status: "pending" },
    ])

    const { result } = renderHook(() => usePendingMutation("abc"))

    await waitFor(() => {
      expect(result.current.hasPending).toBe(true)
      expect(result.current.count).toBe(1)
    })
  })

  it("should refresh on mutation-queued event", async () => {
    const { result } = renderHook(() => usePendingMutation("abc"))

    await waitFor(() => {
      expect(result.current.hasPending).toBe(false)
    })

    mockGetActiveMutationsByEntity.mockResolvedValue([
      { id: 1, entityId: "abc", status: "pending" },
    ])
    act(() => {
      window.dispatchEvent(new CustomEvent("mutation-queued"))
    })

    await waitFor(() => {
      expect(result.current.hasPending).toBe(true)
    })
  })

  it("should return hasConflict when entity has conflict mutations", async () => {
    mockGetActiveMutationsByEntity.mockResolvedValue([
      { id: 1, entityId: "abc", status: "conflict" },
    ])

    const { result } = renderHook(() => usePendingMutation("abc"))

    await waitFor(() => {
      expect(result.current.hasConflict).toBe(true)
      expect(result.current.hasFailed).toBe(false)
    })
  })

  it("should return hasFailed when entity has failed mutations", async () => {
    mockGetActiveMutationsByEntity.mockResolvedValue([
      { id: 1, entityId: "abc", status: "failed" },
    ])

    const { result } = renderHook(() => usePendingMutation("abc"))

    await waitFor(() => {
      expect(result.current.hasFailed).toBe(true)
      expect(result.current.hasConflict).toBe(false)
    })
  })

  it("should refresh on mutation-synced event", async () => {
    mockGetActiveMutationsByEntity.mockResolvedValue([
      { id: 1, entityId: "abc", status: "pending" },
    ])

    const { result } = renderHook(() => usePendingMutation("abc"))

    await waitFor(() => {
      expect(result.current.hasPending).toBe(true)
    })

    mockGetActiveMutationsByEntity.mockResolvedValue([])
    act(() => {
      window.dispatchEvent(new CustomEvent("mutation-synced"))
    })

    await waitFor(() => {
      expect(result.current.hasPending).toBe(false)
    })
  })
})
