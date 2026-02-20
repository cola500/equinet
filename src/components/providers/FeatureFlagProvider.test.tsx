import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import {
  FeatureFlagProvider,
  useFeatureFlag,
  FEATURE_FLAGS_CHANGED_EVENT,
} from "./FeatureFlagProvider"

import { useRef } from "react"

// Test component that consumes the hook
function TestConsumer({ flagKey }: { flagKey: string }) {
  const value = useFeatureFlag(flagKey)
  return <div data-testid="flag-value">{String(value)}</div>
}

// Test component that tracks render count
function RenderCountConsumer({ flagKey }: { flagKey: string }) {
  const renderCount = useRef(0)
  renderCount.current += 1
  const value = useFeatureFlag(flagKey)
  return (
    <div>
      <span data-testid="render-count">{renderCount.current}</span>
      <span data-testid="flag-value-counted">{String(value)}</span>
    </div>
  )
}

describe("FeatureFlagProvider", () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ flags: { voice_logging: true, group_bookings: true } }),
    })
    global.fetch = fetchSpy
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("does NOT fetch at mount when initialFlags are provided", () => {
    render(
      <FeatureFlagProvider initialFlags={{ voice_logging: true }}>
        <TestConsumer flagKey="voice_logging" />
      </FeatureFlagProvider>
    )

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("does NOT fetch on pathname change", async () => {
    // The old implementation had a useEffect on pathname that refetched.
    // After optimization, navigations should NOT trigger fetches.
    render(
      <FeatureFlagProvider initialFlags={{ voice_logging: true }}>
        <TestConsumer flagKey="voice_logging" />
      </FeatureFlagProvider>
    )

    // Advance past any potential debounce/effect
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("fetches on focus if >30s since last fetch", async () => {
    render(
      <FeatureFlagProvider initialFlags={{ voice_logging: false }}>
        <TestConsumer flagKey="voice_logging" />
      </FeatureFlagProvider>
    )

    // Advance past staleness threshold
    await act(async () => {
      vi.advanceTimersByTime(31_000)
    })

    // Trigger focus
    await act(async () => {
      window.dispatchEvent(new Event("focus"))
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("does NOT fetch on focus if <30s since last fetch", async () => {
    render(
      <FeatureFlagProvider initialFlags={{ voice_logging: true }}>
        <TestConsumer flagKey="voice_logging" />
      </FeatureFlagProvider>
    )

    // Only 10s -- still fresh
    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })

    await act(async () => {
      window.dispatchEvent(new Event("focus"))
    })

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("fetches on custom event regardless of staleness", async () => {
    render(
      <FeatureFlagProvider initialFlags={{ voice_logging: true }}>
        <TestConsumer flagKey="voice_logging" />
      </FeatureFlagProvider>
    )

    // No time has passed, but custom event should always trigger
    await act(async () => {
      window.dispatchEvent(new Event(FEATURE_FLAGS_CHANGED_EVENT))
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it("polls every 60s", async () => {
    render(
      <FeatureFlagProvider initialFlags={{ voice_logging: true }}>
        <TestConsumer flagKey="voice_logging" />
      </FeatureFlagProvider>
    )

    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })

    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("does not re-render children when polled flags are identical", async () => {
    const initialFlags = { voice_logging: true, group_bookings: false }

    // Mock fetch returns identical flags
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ flags: { voice_logging: true, group_bookings: false } }),
    })

    render(
      <FeatureFlagProvider initialFlags={initialFlags}>
        <RenderCountConsumer flagKey="voice_logging" />
      </FeatureFlagProvider>
    )

    // Initial render = 1
    expect(screen.getByTestId("render-count").textContent).toBe("1")

    // Trigger polling (60s interval)
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    // Should still be 1 -- no re-render since flags are identical
    expect(screen.getByTestId("render-count").textContent).toBe("1")
  })

  it("re-renders children when polled flags actually change", async () => {
    const initialFlags = { voice_logging: false, group_bookings: false }

    // Mock fetch returns DIFFERENT flags
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ flags: { voice_logging: true, group_bookings: false } }),
    })

    render(
      <FeatureFlagProvider initialFlags={initialFlags}>
        <RenderCountConsumer flagKey="voice_logging" />
      </FeatureFlagProvider>
    )

    expect(screen.getByTestId("render-count").textContent).toBe("1")
    expect(screen.getByTestId("flag-value-counted").textContent).toBe("false")

    // Trigger polling
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    // Should re-render because voice_logging changed false -> true
    expect(screen.getByTestId("render-count").textContent).toBe("2")
    expect(screen.getByTestId("flag-value-counted").textContent).toBe("true")
  })

  it("updates when a flag is removed from API response", async () => {
    const initialFlags = { voice_logging: true, group_bookings: true }

    // API response no longer includes group_bookings
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ flags: { voice_logging: true } }),
    })

    render(
      <FeatureFlagProvider initialFlags={initialFlags}>
        <RenderCountConsumer flagKey="group_bookings" />
      </FeatureFlagProvider>
    )

    expect(screen.getByTestId("flag-value-counted").textContent).toBe("true")

    // Trigger polling
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    // group_bookings was removed from API response -> should be false now
    expect(screen.getByTestId("flag-value-counted").textContent).toBe("false")
    // Should have re-rendered
    expect(screen.getByTestId("render-count").textContent).toBe("2")
  })

  it("does not poll when offline", async () => {
    // Set offline
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    })

    render(
      <FeatureFlagProvider initialFlags={{ voice_logging: true }}>
        <TestConsumer flagKey="voice_logging" />
      </FeatureFlagProvider>
    )

    // Advance past polling interval
    await act(async () => {
      vi.advanceTimersByTime(120_000)
    })

    // Should NOT have fetched since we're offline
    expect(fetchSpy).not.toHaveBeenCalled()

    // Restore online
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    })
  })

  it("does not fetch on focus when offline", async () => {
    // Set offline
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    })

    render(
      <FeatureFlagProvider initialFlags={{ voice_logging: false }}>
        <TestConsumer flagKey="voice_logging" />
      </FeatureFlagProvider>
    )

    // Advance past staleness threshold
    await act(async () => {
      vi.advanceTimersByTime(31_000)
    })

    // Trigger focus
    await act(async () => {
      window.dispatchEvent(new Event("focus"))
    })

    // Should NOT fetch since we're offline
    expect(fetchSpy).not.toHaveBeenCalled()

    // Restore online
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    })
  })

  describe("useFeatureFlag", () => {
    it("returns correct value from initial flags", () => {
      render(
        <FeatureFlagProvider
          initialFlags={{ voice_logging: true, group_bookings: false }}
        >
          <TestConsumer flagKey="group_bookings" />
        </FeatureFlagProvider>
      )

      expect(screen.getByTestId("flag-value").textContent).toBe("false")
    })

    it("returns false for unknown flags", () => {
      render(
        <FeatureFlagProvider initialFlags={{ voice_logging: true }}>
          <TestConsumer flagKey="nonexistent_flag" />
        </FeatureFlagProvider>
      )

      expect(screen.getByTestId("flag-value").textContent).toBe("false")
    })
  })
})
