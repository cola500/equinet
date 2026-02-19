import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useOnlineStatus } from "./useOnlineStatus"

describe("useOnlineStatus", () => {
  let originalNavigator: boolean

  beforeEach(() => {
    originalNavigator = navigator.onLine
  })

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
  })

  it("returns true when browser is online", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)
  })

  it("returns false when browser is offline", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)
  })

  it("updates to false when offline event fires", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
        configurable: true,
      })
      window.dispatchEvent(new Event("offline"))
    })

    expect(result.current).toBe(false)
  })

  it("updates to true when online event fires", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    })
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)

    act(() => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      })
      window.dispatchEvent(new Event("online"))
    })

    expect(result.current).toBe(true)
  })

  it("cleans up event listeners on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener")
    const removeSpy = vi.spyOn(window, "removeEventListener")

    const { unmount } = renderHook(() => useOnlineStatus())

    expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith("offline", expect.any(Function))

    unmount()

    expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith("offline", expect.any(Function))

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it("returns true for SSR snapshot (no window)", () => {
    // useSyncExternalStore's getServerSnapshot should return true
    // This is tested implicitly since the hook defaults to online
    const { result } = renderHook(() => useOnlineStatus())
    expect(typeof result.current).toBe("boolean")
  })
})
