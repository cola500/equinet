import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"

// Mock the hooks
vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(),
}))

vi.mock("@/components/providers/FeatureFlagProvider", () => ({
  useFeatureFlag: vi.fn(),
}))

import { OfflineBanner } from "./OfflineBanner"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"

const mockUseOnlineStatus = vi.mocked(useOnlineStatus)
const mockUseFeatureFlag = vi.mocked(useFeatureFlag)

describe("OfflineBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUseFeatureFlag.mockReturnValue(true)
    mockUseOnlineStatus.mockReturnValue(true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders nothing when online", () => {
    mockUseOnlineStatus.mockReturnValue(true)
    const { container } = render(<OfflineBanner />)
    expect(container.textContent).toBe("")
  })

  it("renders nothing when feature flag is disabled", () => {
    mockUseFeatureFlag.mockReturnValue(false)
    mockUseOnlineStatus.mockReturnValue(false)
    const { container } = render(<OfflineBanner />)
    expect(container.textContent).toBe("")
  })

  it("shows offline banner when offline", () => {
    mockUseOnlineStatus.mockReturnValue(false)
    render(<OfflineBanner />)
    expect(screen.getByText("Du är offline")).toBeInTheDocument()
    expect(
      screen.getByText("Visar cachad data. Vissa funktioner kan vara begränsade.")
    ).toBeInTheDocument()
  })

  it("shows offline banner with amber styling", () => {
    mockUseOnlineStatus.mockReturnValue(false)
    render(<OfflineBanner />)
    const banner = screen.getByRole("status")
    expect(banner.className).toContain("bg-amber")
  })

  it("shows reconnected banner when coming back online", () => {
    mockUseOnlineStatus.mockReturnValue(false)
    const { rerender } = render(<OfflineBanner />)

    // Come back online
    mockUseOnlineStatus.mockReturnValue(true)
    rerender(<OfflineBanner />)

    expect(screen.getByText("Återansluten")).toBeInTheDocument()
  })

  it("hides reconnected banner after 3 seconds", () => {
    mockUseOnlineStatus.mockReturnValue(false)
    const { rerender } = render(<OfflineBanner />)

    mockUseOnlineStatus.mockReturnValue(true)
    rerender(<OfflineBanner />)

    expect(screen.getByText("Återansluten")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.queryByText("Återansluten")).not.toBeInTheDocument()
  })

  it("has accessible role and label", () => {
    mockUseOnlineStatus.mockReturnValue(false)
    render(<OfflineBanner />)
    expect(screen.getByRole("status")).toBeInTheDocument()
  })
})
