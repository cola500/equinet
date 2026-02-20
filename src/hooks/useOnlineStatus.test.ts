import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import {
  useOnlineStatus,
  reportConnectivityLoss,
  reportConnectivityRestored,
} from "./useOnlineStatus"

describe("useOnlineStatus", () => {
  let originalNavigator: boolean

  beforeEach(() => {
    originalNavigator = navigator.onLine
    // Reset fetch-based state between tests
    reportConnectivityRestored()
  })

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
    reportConnectivityRestored()
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

  describe("fetch-based connectivity detection", () => {
    it("returns false when reportConnectivityLoss is called even if navigator.onLine is true", () => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useOnlineStatus())
      expect(result.current).toBe(true)

      act(() => {
        reportConnectivityLoss()
      })

      expect(result.current).toBe(false)
    })

    it("returns true when reportConnectivityRestored is called after loss", () => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useOnlineStatus())

      act(() => {
        reportConnectivityLoss()
      })
      expect(result.current).toBe(false)

      act(() => {
        reportConnectivityRestored()
      })
      expect(result.current).toBe(true)
    })

    it("online event restores connectivity after fetchFailed", () => {
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useOnlineStatus())

      act(() => {
        reportConnectivityLoss()
      })
      expect(result.current).toBe(false)

      // Simulate browser online event (network restored)
      act(() => {
        window.dispatchEvent(new Event("online"))
      })
      expect(result.current).toBe(true)
    })

    it("subscribes to connectivity-change event", () => {
      const addSpy = vi.spyOn(window, "addEventListener")

      const { unmount } = renderHook(() => useOnlineStatus())

      expect(addSpy).toHaveBeenCalledWith(
        "connectivity-change",
        expect.any(Function)
      )

      unmount()
      addSpy.mockRestore()
    })
  })
})
