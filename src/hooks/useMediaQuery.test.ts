import { renderHook, act } from "@testing-library/react"
import { useMediaQuery, useIsMobile } from "./useMediaQuery"

describe("useMediaQuery", () => {
  let listeners: ((e: MediaQueryListEvent) => void)[] = []
  let currentMatches = false

  beforeEach(() => {
    listeners = []
    currentMatches = false

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn((query: string) => ({
        matches: currentMatches,
        media: query,
        addEventListener: (_event: string, handler: (e: MediaQueryListEvent) => void) => {
          listeners.push(handler)
        },
        removeEventListener: (_event: string, handler: (e: MediaQueryListEvent) => void) => {
          listeners = listeners.filter((l) => l !== handler)
        },
      })),
    })
  })

  it("returns false initially (SSR-safe default)", () => {
    currentMatches = false
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"))
    expect(result.current).toBe(false)
  })

  it("returns true when media query matches on mount", () => {
    currentMatches = true
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"))
    expect(result.current).toBe(true)
  })

  it("updates when media query changes", () => {
    currentMatches = false
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"))
    expect(result.current).toBe(false)

    act(() => {
      listeners.forEach((l) => l({ matches: true } as MediaQueryListEvent))
    })
    expect(result.current).toBe(true)

    act(() => {
      listeners.forEach((l) => l({ matches: false } as MediaQueryListEvent))
    })
    expect(result.current).toBe(false)
  })

  it("cleans up listener on unmount", () => {
    const { unmount } = renderHook(() => useMediaQuery("(max-width: 767px)"))
    expect(listeners).toHaveLength(1)

    unmount()
    expect(listeners).toHaveLength(0)
  })
})

describe("useIsMobile", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn((query: string) => ({
        matches: query === "(max-width: 767px)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
  })

  it("returns true for mobile viewport", () => {
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })
})
