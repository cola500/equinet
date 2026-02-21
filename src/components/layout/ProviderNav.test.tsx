import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ProviderNav } from "./ProviderNav"
import { toast } from "sonner"

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}))

const mockPrefetch = vi.fn()

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/provider/dashboard"),
  useRouter: vi.fn(() => ({ prefetch: mockPrefetch })),
}))

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(() => true),
}))

vi.mock("@/components/providers/FeatureFlagProvider", () => ({
  useFeatureFlags: vi.fn(() => ({})),
}))

// Mock BottomTabBar since it's tested separately
vi.mock("./BottomTabBar", () => ({
  BottomTabBar: () => null,
}))

import { usePathname } from "next/navigation"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useFeatureFlags } from "@/components/providers/FeatureFlagProvider"

describe("ProviderNav", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrefetch.mockClear()
    vi.mocked(useOnlineStatus).mockReturnValue(true)
    vi.mocked(usePathname).mockReturnValue("/provider/dashboard")
    vi.mocked(useFeatureFlags).mockReturnValue({})
  })

  it("should render desktop nav links when online", () => {
    render(<ProviderNav />)

    expect(screen.getByText("Översikt")).toBeInTheDocument()
    expect(screen.getByText("Kalender")).toBeInTheDocument()
    expect(screen.getByText("Bokningar")).toBeInTheDocument()
  })

  it("should allow navigation when online", () => {
    render(<ProviderNav />)

    const calendarLink = screen.getByText("Kalender")
    fireEvent.click(calendarLink)

    expect(toast.error).not.toHaveBeenCalled()
  })

  it("should block navigation to non-offlineSafe link when offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)

    render(<ProviderNav />)

    const servicesLink = screen.getByText("Mina tjänster")
    fireEvent.click(servicesLink)

    expect(toast.error).toHaveBeenCalledWith(
      "Du är offline. Navigering kräver internetanslutning."
    )
  })

  it("should allow navigation to cached tabs (dashboard, kalender, bokningar) when offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)

    render(<ProviderNav />)

    // Kalender is offlineSafe -- should NOT be blocked
    const calendarLink = screen.getByText("Kalender")
    fireEvent.click(calendarLink)
    expect(toast.error).not.toHaveBeenCalled()

    // Bokningar is offlineSafe -- should NOT be blocked
    const bookingsLink = screen.getByText("Bokningar")
    fireEvent.click(bookingsLink)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("should allow click on active page link when offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    vi.mocked(usePathname).mockReturnValue("/provider/dashboard")

    render(<ProviderNav />)

    const dashboardLink = screen.getByText("Översikt")
    fireEvent.click(dashboardLink)

    expect(toast.error).not.toHaveBeenCalled()
  })

  it("should prefetch main tabs when offline_mode is enabled", () => {
    vi.mocked(useFeatureFlags).mockReturnValue({ offline_mode: true })

    render(<ProviderNav />)

    expect(mockPrefetch).toHaveBeenCalledWith("/provider/dashboard")
    expect(mockPrefetch).toHaveBeenCalledWith("/provider/calendar")
    expect(mockPrefetch).toHaveBeenCalledWith("/provider/bookings")
    expect(mockPrefetch).toHaveBeenCalledTimes(3)
  })

  it("should NOT prefetch when offline_mode is disabled", () => {
    vi.mocked(useFeatureFlags).mockReturnValue({})

    render(<ProviderNav />)

    expect(mockPrefetch).not.toHaveBeenCalled()
  })
})
