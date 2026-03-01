import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"

// Mock the hooks
vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(),
}))

vi.mock("@/components/providers/FeatureFlagProvider", () => ({
  useFeatureFlag: vi.fn(),
}))

vi.mock("@/hooks/useMutationSync", () => ({
  useMutationSync: vi.fn(() => ({
    pendingCount: 0,
    isSyncing: false,
    lastSyncResult: null,
  })),
}))

import { OfflineBanner } from "./OfflineBanner"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import { useMutationSync } from "@/hooks/useMutationSync"

const mockUseOnlineStatus = vi.mocked(useOnlineStatus)
const mockUseFeatureFlag = vi.mocked(useFeatureFlag)
const mockUseMutationSync = vi.mocked(useMutationSync)

describe("OfflineBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockUseFeatureFlag.mockReturnValue(true)
    mockUseOnlineStatus.mockReturnValue(true)
    mockUseMutationSync.mockReturnValue({
      pendingCount: 0,
      isSyncing: false,
      lastSyncResult: null,
      triggerSync: vi.fn(),
    })
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

  // -- New: Pending mutation count --

  it("shows pending count when offline with pending mutations", () => {
    mockUseOnlineStatus.mockReturnValue(false)
    mockUseMutationSync.mockReturnValue({
      pendingCount: 3,
      isSyncing: false,
      lastSyncResult: null,
      triggerSync: vi.fn(),
    })
    render(<OfflineBanner />)
    expect(screen.getByText(/3 ändringar väntar/)).toBeInTheDocument()
  })

  it("shows syncing state when reconnected and syncing", () => {
    mockUseOnlineStatus.mockReturnValue(false)
    const { rerender } = render(<OfflineBanner />)

    mockUseOnlineStatus.mockReturnValue(true)
    mockUseMutationSync.mockReturnValue({
      pendingCount: 2,
      isSyncing: true,
      lastSyncResult: null,
      triggerSync: vi.fn(),
    })
    rerender(<OfflineBanner />)

    expect(screen.getByText(/synkar/i)).toBeInTheDocument()
  })

  it("shows success message after sync completes", () => {
    mockUseOnlineStatus.mockReturnValue(false)
    const { rerender } = render(<OfflineBanner />)

    mockUseOnlineStatus.mockReturnValue(true)
    mockUseMutationSync.mockReturnValue({
      pendingCount: 0,
      isSyncing: false,
      lastSyncResult: { synced: 3, failed: 0, conflicts: 0 },
      triggerSync: vi.fn(),
    })
    rerender(<OfflineBanner />)

    expect(screen.getByText(/synkade/i)).toBeInTheDocument()
  })

  it("shows persistent error banner when sync has failures", () => {
    mockUseOnlineStatus.mockReturnValue(false)
    const { rerender } = render(<OfflineBanner />)

    // Come back online, sync completed with failures
    mockUseOnlineStatus.mockReturnValue(true)
    mockUseMutationSync.mockReturnValue({
      pendingCount: 2,
      isSyncing: false,
      lastSyncResult: { synced: 1, failed: 2, conflicts: 0 },
      triggerSync: vi.fn(),
    })
    rerender(<OfflineBanner />)

    // Wait for reconnected banner to dismiss
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    // Error banner should persist
    expect(screen.getByText(/kunde inte synkas/)).toBeInTheDocument()
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("shows persistent error banner when sync has conflicts", () => {
    mockUseOnlineStatus.mockReturnValue(false)
    const { rerender } = render(<OfflineBanner />)

    mockUseOnlineStatus.mockReturnValue(true)
    mockUseMutationSync.mockReturnValue({
      pendingCount: 1,
      isSyncing: false,
      lastSyncResult: { synced: 0, failed: 0, conflicts: 1 },
      triggerSync: vi.fn(),
    })
    rerender(<OfflineBanner />)

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByText(/kunde inte synkas/)).toBeInTheDocument()
  })

  it("shows correct count in error banner for single failure", () => {
    mockUseOnlineStatus.mockReturnValue(false)
    const { rerender } = render(<OfflineBanner />)

    mockUseOnlineStatus.mockReturnValue(true)
    mockUseMutationSync.mockReturnValue({
      pendingCount: 1,
      isSyncing: false,
      lastSyncResult: { synced: 0, failed: 1, conflicts: 0 },
      triggerSync: vi.fn(),
    })
    rerender(<OfflineBanner />)

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByText(/1 ändring kunde inte synkas/)).toBeInTheDocument()
  })

  it("shows no pending info when offline with zero pending", () => {
    mockUseOnlineStatus.mockReturnValue(false)
    mockUseMutationSync.mockReturnValue({
      pendingCount: 0,
      isSyncing: false,
      lastSyncResult: null,
      triggerSync: vi.fn(),
    })
    render(<OfflineBanner />)
    expect(screen.queryByText(/ändringar väntar/)).not.toBeInTheDocument()
  })
})
