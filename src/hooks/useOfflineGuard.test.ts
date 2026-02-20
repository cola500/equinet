import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useOfflineGuard } from "./useOfflineGuard"
import { toast } from "sonner"

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}))

vi.mock("./useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(() => true),
}))

import { useOnlineStatus } from "./useOnlineStatus"

describe("useOfflineGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOnlineStatus).mockReturnValue(true)
  })

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

  it("should block action and show toast when offline", async () => {
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

    let returnValue: any
    await act(async () => {
      returnValue = await result.current.guardMutation(action)
    })

    expect(returnValue).toBe("result")
  })
})
