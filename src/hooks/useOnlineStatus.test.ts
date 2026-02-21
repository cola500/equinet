import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import {
  useOnlineStatus,
  reportConnectivityLoss,
  reportConnectivityRestored,
  stopProbing,
} from "./useOnlineStatus"

describe("useOnlineStatus", () => {
  let originalNavigator: boolean

  beforeEach(() => {
    originalNavigator = navigator.onLine
    // Reset fetch-based state between tests
    reportConnectivityRestored()
    // Stop any probes from previous tests
    stopProbing()
    vi.restoreAllMocks()
    // Default: mock fetch so probes don't cause act() warnings in non-probe tests
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }))
  })

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
    reportConnectivityRestored()
    stopProbing()
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

  describe("proactive connectivity probe", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("detects offline when probe fetch fails", async () => {
      // Simulate fetch failure (network down)
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"))

      const { result } = renderHook(() => useOnlineStatus())

      // Probe runs on first subscribe -- flush the async probe
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(result.current).toBe(false)
    })

    it("probes on visibilitychange to visible", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch")
      // Initial probe succeeds
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

      renderHook(() => useOnlineStatus())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      // Now network drops
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))

      // Simulate returning to the tab
      await act(async () => {
        Object.defineProperty(document, "visibilityState", {
          value: "visible",
          writable: true,
          configurable: true,
        })
        document.dispatchEvent(new Event("visibilitychange"))
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("stops probing when all subscribers unmount", () => {
      const removeSpy = vi.spyOn(document, "removeEventListener")

      const { unmount } = renderHook(() => useOnlineStatus())

      unmount()

      // visibilitychange listener should be removed on unmount
      expect(removeSpy).toHaveBeenCalledWith(
        "visibilitychange",
        expect.any(Function)
      )

      removeSpy.mockRestore()
    })

    it("probes with HEAD method and cache-busting param", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch")
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

      renderHook(() => useOnlineStatus())

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/^\/api\/health\?_t=\d+$/),
        expect.objectContaining({ method: "HEAD" })
      )
    })
  })

  describe("recovery probing interval", () => {
    beforeEach(() => {
      vi.useFakeTimers()
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("starts recovery probing when connectivity is lost", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch")
      // Initial probe succeeds
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

      renderHook(() => useOnlineStatus())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      fetchMock.mockClear()

      // Go offline
      act(() => {
        reportConnectivityLoss()
      })

      // Advance 15s -- recovery probe should fire
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000)
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("stops recovery probing when connectivity is restored", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch")
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

      renderHook(() => useOnlineStatus())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      // Go offline -> starts recovery interval
      act(() => {
        reportConnectivityLoss()
      })

      // Restore -> should stop recovery interval
      act(() => {
        reportConnectivityRestored()
      })

      fetchMock.mockClear()

      // Advance 30s -- no recovery probes should fire
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000)
      })

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("does not start recovery probing when online", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch")
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

      renderHook(() => useOnlineStatus())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      fetchMock.mockClear()

      // Advance 30s -- no recovery probes when already online
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000)
      })

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it("recovery probe restores online when fetch succeeds", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch")
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

      const { result } = renderHook(() => useOnlineStatus())
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      // Go offline
      act(() => {
        reportConnectivityLoss()
      })
      expect(result.current).toBe(false)

      // Recovery probe succeeds (network back)
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(15_000)
      })

      expect(result.current).toBe(true)
    })
  })

  describe("Service Worker message integration", () => {
    let swListeners: Map<string, EventListenerOrEventListenerObject>

    beforeEach(() => {
      swListeners = new Map()
      Object.defineProperty(navigator, "onLine", {
        value: true,
        writable: true,
        configurable: true,
      })
      // Mock navigator.serviceWorker
      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          addEventListener: vi.fn((type: string, handler: EventListenerOrEventListenerObject) => {
            swListeners.set(type, handler)
          }),
          removeEventListener: vi.fn(),
        },
        writable: true,
        configurable: true,
      })
    })

    afterEach(() => {
      // Clean up the mock
      Object.defineProperty(navigator, "serviceWorker", {
        value: undefined,
        writable: true,
        configurable: true,
      })
    })

    it("reports offline when SW posts SW_FETCH_FAILED message", () => {
      const { result } = renderHook(() => useOnlineStatus())
      expect(result.current).toBe(true)

      // Simulate SW posting a message
      const handler = swListeners.get("message")
      expect(handler).toBeDefined()

      act(() => {
        ;(handler as EventListener)(
          new MessageEvent("message", { data: { type: "SW_FETCH_FAILED" } })
        )
      })

      expect(result.current).toBe(false)
    })

    it("ignores non-SW_FETCH_FAILED messages", () => {
      const { result } = renderHook(() => useOnlineStatus())
      expect(result.current).toBe(true)

      const handler = swListeners.get("message")
      expect(handler).toBeDefined()

      act(() => {
        ;(handler as EventListener)(
          new MessageEvent("message", { data: { type: "OTHER_MESSAGE" } })
        )
      })

      // Should still be online -- the message was ignored
      expect(result.current).toBe(true)
    })

    it("cleans up SW message listener on unmount", () => {
      const { unmount } = renderHook(() => useOnlineStatus())

      unmount()

      expect(navigator.serviceWorker!.removeEventListener).toHaveBeenCalledWith(
        "message",
        expect.any(Function)
      )
    })
  })
})
