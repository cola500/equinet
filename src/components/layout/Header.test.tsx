import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Header } from "./Header"

const mockUseAuth = vi.fn()
const mockIsDemoMode = vi.fn(() => false)
const mockSignOut = vi.fn().mockResolvedValue({ error: null })
const mockClearServiceWorkerUserCaches = vi.fn().mockResolvedValue(undefined)

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signOut: mockSignOut } }),
}))

vi.mock("@/lib/native-bridge", () => ({
  notifyNativeLogout: vi.fn(),
}))

vi.mock("@/lib/sw-client", () => ({
  clearServiceWorkerUserCaches: () => mockClearServiceWorkerUserCaches(),
}))

vi.mock("@/lib/demo-session", () => ({
  clearDemoSessionCookie: vi.fn(),
}))

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
  SESSION_STORAGE_KEY: "equinet-auth-cache",
}))

vi.mock("@/lib/demo-mode", () => ({
  isDemoMode: () => mockIsDemoMode(),
}))

vi.mock("@/components/providers/FeatureFlagProvider", () => ({
  useFeatureFlag: () => false,
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
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => <div onClick={onClick}>{children}</div>,
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
    expect(screen.getByText("Registrera gratis")).toBeInTheDocument()
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

  it("shows CustomerNav for an authenticated customer in demo mode", () => {
    // Demo now has a loginable customer persona (Lisa). She must keep her
    // navigation — the nav must not be gated behind !demo.
    mockIsDemoMode.mockReturnValue(true)
    mockUseAuth.mockReturnValue({
      user: { name: "Lisa Andersson", email: "lisa@test.com" },
      isAuthenticated: true,
      isLoading: false,
      isProvider: false,
      isCustomer: true,
      isAdmin: false,
      isStableOwner: false,
    })

    render(<Header />)

    expect(screen.getByTestId("customer-nav")).toBeInTheDocument()
  })

  it("clears service worker user caches on logout, before navigating away", async () => {
    const user = userEvent.setup()
    const originalLocation = window.location
    // jsdom throws "Not implemented: navigation" on a real href assignment.
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, href: "" },
    })

    mockUseAuth.mockReturnValue({
      user: { name: "Erik Järnfot", email: "erik@test.com" },
      isAuthenticated: true,
      isLoading: false,
      isProvider: true,
      isCustomer: false,
      isAdmin: false,
    })

    render(<Header />)
    await user.click(screen.getByText("Logga ut"))

    expect(mockSignOut).toHaveBeenCalled()
    expect(mockClearServiceWorkerUserCaches).toHaveBeenCalled()
    expect(window.location.href).toBe("/")

    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    })
  })

  it("clears the previous user's cached auth data from sessionStorage on logout", async () => {
    const user = userEvent.setup()
    const originalLocation = window.location
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, href: "" },
    })

    // Simulate what useAuth caches while a user is authenticated (see
    // src/hooks/useAuth.ts) -- this is what a NEXT session on the same
    // browser/tab must never see after the current user logs out.
    sessionStorage.setItem(
      "equinet-auth-cache",
      JSON.stringify({
        user: { id: "u1", email: "erik@test.com", name: "Erik Järnfot", userType: "provider" },
        isProvider: true,
        isCustomer: false,
        isAdmin: false,
        isStableOwner: false,
        providerId: "p1",
        stableId: null,
      })
    )

    mockUseAuth.mockReturnValue({
      user: { name: "Erik Järnfot", email: "erik@test.com" },
      isAuthenticated: true,
      isLoading: false,
      isProvider: true,
      isCustomer: false,
      isAdmin: false,
    })

    render(<Header />)
    await user.click(screen.getByText("Logga ut"))

    expect(sessionStorage.getItem("equinet-auth-cache")).toBeNull()

    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    })
  })
})
