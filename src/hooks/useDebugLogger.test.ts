import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook } from "@testing-library/react"

// Mock dependencies before importing hook
const mockDebugLog = vi.fn()
vi.mock("@/lib/offline/debug-logger", () => ({
  debugLog: (...args: unknown[]) => mockDebugLog(...args),
}))

let mockFeatureFlag = true
vi.mock("@/components/providers/FeatureFlagProvider", () => ({
  useFeatureFlag: () => mockFeatureFlag,
}))

let mockIsOnline = true
vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => mockIsOnline,
}))

let mockAuthStatus = "authenticated"
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: mockAuthStatus === "authenticated", isLoading: mockAuthStatus === "loading" }),
}))

let mockPathname = "/provider/dashboard"
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}))

import { useDebugLogger } from "./useDebugLogger"

describe("useDebugLogger", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFeatureFlag = true
    mockIsOnline = true
    mockAuthStatus = "authenticated"
    mockPathname = "/provider/dashboard"
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("logs init message at mount", () => {
    renderHook(() => useDebugLogger())

    expect(mockDebugLog).toHaveBeenCalledWith(
      "general",
      "info",
      expect.stringContaining("Debug logger initialized"),
      expect.any(Object)
    )
  })

  it("logs navigation on pathname change", () => {
    const { rerender } = renderHook(() => useDebugLogger())
    vi.clearAllMocks()

    mockPathname = "/provider/calendar"
    rerender()

    expect(mockDebugLog).toHaveBeenCalledWith(
      "navigation",
      "info",
      "Navigated to /provider/calendar"
    )
  })

  it("logs online/offline transitions but not initial state", () => {
    const { rerender } = renderHook(() => useDebugLogger())
    // Clear init calls
    vi.clearAllMocks()

    // Go offline
    mockIsOnline = false
    rerender()

    expect(mockDebugLog).toHaveBeenCalledWith("network", "warn", "Went offline")

    vi.clearAllMocks()

    // Go back online
    mockIsOnline = true
    rerender()

    expect(mockDebugLog).toHaveBeenCalledWith("network", "info", "Went online")
  })

  it("logs auth state changes but not initial state", () => {
    const { rerender } = renderHook(() => useDebugLogger())
    vi.clearAllMocks()

    mockAuthStatus = "unauthenticated"
    rerender()

    expect(mockDebugLog).toHaveBeenCalledWith(
      "auth",
      "warn",
      "Auth state changed",
      expect.objectContaining({ isAuthenticated: false })
    )
  })

  it("does nothing when offline_mode feature flag is off", () => {
    mockFeatureFlag = false
    renderHook(() => useDebugLogger())

    expect(mockDebugLog).not.toHaveBeenCalled()
  })
})
