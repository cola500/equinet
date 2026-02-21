import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { BottomTabBar, type TabItem, type MoreMenuItem } from "./BottomTabBar"
import { toast } from "sonner"
import { Home, Calendar, ClipboardList, Wrench, User } from "lucide-react"

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}))

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/provider/dashboard"),
}))

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(() => true),
}))

import { usePathname } from "next/navigation"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"

const mockTabs: TabItem[] = [
  { href: "/provider/dashboard", label: "Översikt", icon: Home, offlineSafe: true },
  { href: "/provider/calendar", label: "Kalender", icon: Calendar, offlineSafe: true },
  { href: "/provider/bookings", label: "Bokningar", icon: ClipboardList, offlineSafe: true },
]

const mockMoreItems: MoreMenuItem[] = [
  { href: "/provider/services", label: "Mina tjänster", icon: Wrench },
  { href: "/provider/profile", label: "Min profil", icon: User },
]

describe("BottomTabBar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOnlineStatus).mockReturnValue(true)
    vi.mocked(usePathname).mockReturnValue("/provider/dashboard")
  })

  it("should render all tab links when online", () => {
    render(<BottomTabBar tabs={mockTabs} moreItems={mockMoreItems} />)

    expect(screen.getByText("Översikt")).toBeInTheDocument()
    expect(screen.getByText("Kalender")).toBeInTheDocument()
    expect(screen.getByText("Bokningar")).toBeInTheDocument()
    expect(screen.getByText("Mer")).toBeInTheDocument()
  })

  it("should allow navigation when online", () => {
    render(<BottomTabBar tabs={mockTabs} moreItems={mockMoreItems} />)

    const calendarLink = screen.getByText("Kalender").closest("a")
    expect(calendarLink).toHaveAttribute("href", "/provider/calendar")

    fireEvent.click(calendarLink!)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("should block navigation to non-offlineSafe tab when offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)

    const tabsWithUnsafe: TabItem[] = [
      { href: "/provider/dashboard", label: "Översikt", icon: Home, offlineSafe: true },
      { href: "/provider/settings", label: "Inställningar", icon: Wrench },
    ]

    render(<BottomTabBar tabs={tabsWithUnsafe} moreItems={mockMoreItems} />)

    const settingsLink = screen.getByText("Inställningar").closest("a")
    fireEvent.click(settingsLink!)

    expect(toast.error).toHaveBeenCalledWith(
      "Du är offline. Navigering kräver internetanslutning."
    )
  })

  it("should allow navigation to offlineSafe tab when offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)

    render(<BottomTabBar tabs={mockTabs} moreItems={mockMoreItems} />)

    const calendarLink = screen.getByText("Kalender").closest("a")
    fireEvent.click(calendarLink!)

    // offlineSafe tabs should NOT be blocked
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("should block navigation to non-offlineSafe more item when offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)

    render(<BottomTabBar tabs={mockTabs} moreItems={mockMoreItems} />)

    // Open the drawer first
    fireEvent.click(screen.getByText("Mer"))

    const servicesLink = screen.getByText("Mina tjänster").closest("a")
    fireEvent.click(servicesLink!)

    expect(toast.error).toHaveBeenCalledWith(
      "Du är offline. Navigering kräver internetanslutning."
    )
  })

  it("should allow click on active tab when offline (no navigation occurs)", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    vi.mocked(usePathname).mockReturnValue("/provider/dashboard")

    render(<BottomTabBar tabs={mockTabs} moreItems={mockMoreItems} />)

    // Click the currently active tab
    const dashboardLink = screen.getByText("Översikt").closest("a")
    fireEvent.click(dashboardLink!)

    // Should NOT show toast -- user is already on this page
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("should allow click on tab with matching prefix when offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    vi.mocked(usePathname).mockReturnValue("/provider/dashboard/details")

    const tabsWithPrefix: TabItem[] = [
      { href: "/provider/dashboard", label: "Översikt", icon: Home, matchPrefix: "/provider/dashboard" },
    ]

    render(<BottomTabBar tabs={tabsWithPrefix} moreItems={[]} />)

    const dashboardLink = screen.getByText("Översikt").closest("a")
    fireEvent.click(dashboardLink!)

    expect(toast.error).not.toHaveBeenCalled()
  })
})
