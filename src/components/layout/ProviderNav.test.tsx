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

// Mock BottomTabBar since it's tested separately — capture props to assert mobile nav
const { mockBottomTabBar } = vi.hoisted(() => ({
  mockBottomTabBar: { props: null as { tabs: { href: string }[]; moreItems: { href: string }[] } | null },
}))
vi.mock("./BottomTabBar", () => ({
  BottomTabBar: (props: { tabs: { href: string }[]; moreItems: { href: string }[] }) => {
    mockBottomTabBar.props = props
    return null
  },
}))

import { usePathname } from "next/navigation"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useFeatureFlags } from "@/components/providers/FeatureFlagProvider"

// Reset module-level guard between tests
async function resetRscCacheGuard() {
  const mod = await import("./ProviderNav")
  mod._resetRscCacheWarmed()
}

describe("ProviderNav", () => {
  const originalLocation = window.location

  beforeEach(async () => {
    vi.clearAllMocks()
    mockPrefetch.mockClear()
    vi.mocked(useOnlineStatus).mockReturnValue(true)
    vi.mocked(usePathname).mockReturnValue("/provider/dashboard")
    vi.mocked(useFeatureFlags).mockReturnValue({})
    // Reset module-level guard
    await resetRscCacheGuard()
    // Mock window.location for hard navigation tests
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, href: "http://localhost/provider/dashboard" },
    })
    // Reset global fetch mock
    vi.restoreAllMocks()
  })

  afterEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    })
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

  it("should hard navigate to offlineSafe link when offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    vi.mocked(usePathname).mockReturnValue("/provider/dashboard")

    render(<ProviderNav />)

    const calendarLink = screen.getByText("Kalender").closest("a")!
    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true })
    Object.defineProperty(clickEvent, "preventDefault", { value: vi.fn() })

    calendarLink.dispatchEvent(clickEvent)

    // Should hard navigate instead of RSC navigation
    expect(window.location.href).toBe("/provider/calendar")
    // Should NOT show error toast
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("should warm RSC cache with raw fetch when offline_mode is enabled", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(""))
    vi.mocked(useFeatureFlags).mockReturnValue({ offline_mode: true })

    render(<ProviderNav />)

    // Wait for useEffect to fire
    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })

    // Should fetch each offlineSafe path with RSC header (without Next-Router-Prefetch)
    const rscCalls = fetchSpy.mock.calls.filter(
      (call) => {
        const init = call[1] as RequestInit | undefined
        return init?.headers && (init.headers as Record<string, string>)["RSC"] === "1"
      }
    )
    expect(rscCalls.length).toBeGreaterThanOrEqual(3)

    // Verify headers do NOT include Next-Router-Prefetch
    for (const call of rscCalls) {
      const headers = (call[1] as RequestInit).headers as Record<string, string>
      expect(headers["Next-Router-Prefetch"]).toBeUndefined()
    }
  })

  it("should only warm RSC cache once per session (module-level guard)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(""))
    vi.mocked(useFeatureFlags).mockReturnValue({ offline_mode: true })

    const { unmount } = render(<ProviderNav />)

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })

    unmount()

    // Re-render -- should NOT fetch again
    fetchSpy.mockClear()
    render(<ProviderNav />)

    // Give useEffect time to fire (it shouldn't fetch again)
    await new Promise((r) => setTimeout(r, 50))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  describe("mobile bottom tab bar (Slice 1)", () => {
    it("demo mode: shows exactly 4 primary tabs (Kalender, Kunder, Tjänster, Meddelanden)", () => {
      vi.mocked(useFeatureFlags).mockReturnValue({ demo_mode: true, messaging: true })

      render(<ProviderNav />)

      // Shared DEMO_PRIMARY_PATHS — same set/order as desktop top-nav.
      expect(mockBottomTabBar.props?.tabs.map((t) => t.href)).toEqual([
        "/provider/calendar",
        "/provider/customers",
        "/provider/services",
        "/provider/messages",
      ])
    })

    it("demo mode: Mer drawer holds the 5 moved items (Översikt, Bokningar, Insikter, Profil, Hjälp)", () => {
      vi.mocked(useFeatureFlags).mockReturnValue({ demo_mode: true, messaging: true, help_center: true })

      render(<ProviderNav />)

      // Shared DEMO_MORE_PATHS — same set/order as desktop "Mer".
      expect(mockBottomTabBar.props?.moreItems.map((i) => i.href)).toEqual([
        "/provider/dashboard",
        "/provider/bookings",
        "/provider/insights",
        "/provider/profile",
        "/provider/help",
      ])
    })

    it("non-demo mode: mobile tabs unchanged (providerTabs)", () => {
      vi.mocked(useFeatureFlags).mockReturnValue({ messaging: true })

      render(<ProviderNav />)

      expect(mockBottomTabBar.props?.tabs.map((t) => t.href)).toEqual([
        "/provider/dashboard",
        "/provider/calendar",
        "/provider/bookings",
        "/provider/messages",
      ])
    })
  })
})
