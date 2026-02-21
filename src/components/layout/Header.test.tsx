import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { Header } from "./Header"

const mockUseAuth = vi.fn()

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}))

vi.mock("@/components/notification/NotificationBell", () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}))

vi.mock("./CustomerNav", () => ({
  CustomerNav: () => <nav data-testid="customer-nav" />,
}))

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows login buttons when not authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isProvider: false,
      isCustomer: false,
      isAdmin: false,
    })

    render(<Header />)

    expect(screen.getByText("Logga in")).toBeInTheDocument()
    expect(screen.getByText("Kom igång")).toBeInTheDocument()
  })

  it("shows user menu when authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: { name: "Test User", email: "test@test.com" },
      isAuthenticated: true,
      isLoading: false,
      isProvider: true,
      isCustomer: false,
      isAdmin: false,
    })

    render(<Header />)

    expect(screen.getByText("Test User")).toBeInTheDocument()
    expect(screen.queryByText("Logga in")).not.toBeInTheDocument()
  })

  it("shows neither login buttons nor user menu while loading", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      isProvider: false,
      isCustomer: false,
      isAdmin: false,
    })

    render(<Header />)

    // Logo should always be visible
    expect(screen.getByText("Equinet")).toBeInTheDocument()

    // Neither login buttons nor user dropdown should show
    expect(screen.queryByText("Logga in")).not.toBeInTheDocument()
    expect(screen.queryByText("Kom igång")).not.toBeInTheDocument()
    expect(screen.queryByText("Börja")).not.toBeInTheDocument()
    expect(screen.queryByTestId("notification-bell")).not.toBeInTheDocument()
  })
})
