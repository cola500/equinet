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
  { href: "/provider/dashboard", label: "Översikt", icon: Home },
  { href: "/provider/calendar", label: "Kalender", icon: Calendar },
  { href: "/provider/bookings", label: "Bokningar", icon: ClipboardList },
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

  it("should block navigation when offline and show toast", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)

    render(<BottomTabBar tabs={mockTabs} moreItems={mockMoreItems} />)

    const calendarLink = screen.getByText("Kalender").closest("a")
    fireEvent.click(calendarLink!)

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
