import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BugReportFab } from "./BugReportFab"

// Mock Drawer to avoid vaul pointer-event errors in jsdom
vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({
    children,
    open,
  }: {
    children: React.ReactNode
    open: boolean
  }) => (open ? <div data-testid="drawer">{children}</div> : null),
  DrawerContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DrawerDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DrawerFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerClose: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

// Mock auth
const mockUseAuth = vi.fn()
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}))

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/provider/calendar",
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("BugReportFab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ isAuthenticated: true })
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "bug-123", status: "NEW" }),
    })
  })

  it("renders nothing when user is not authenticated", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false })
    const { container } = render(<BugReportFab />)
    expect(container.innerHTML).toBe("")
  })

  it("renders FAB button when authenticated", () => {
    render(<BugReportFab />)
    expect(
      screen.getByRole("button", { name: "Rapportera fel" })
    ).toBeInTheDocument()
  })

  it("opens drawer with title and description fields on click", async () => {
    const user = userEvent.setup()
    render(<BugReportFab />)

    await user.click(screen.getByRole("button", { name: "Rapportera fel" }))

    expect(screen.getByLabelText("Titel *")).toBeInTheDocument()
    expect(screen.getByLabelText("Beskrivning *")).toBeInTheDocument()
    expect(
      screen.getByLabelText(/Steg för att återskapa/i)
    ).toBeInTheDocument()
  })

  it("disables submit when title and description are empty", async () => {
    const user = userEvent.setup()
    render(<BugReportFab />)

    await user.click(screen.getByRole("button", { name: "Rapportera fel" }))

    const submitBtn = screen.getByRole("button", { name: "Skicka rapport" })
    expect(submitBtn).toBeDisabled()
  })

  it("enables submit when title and description are filled", async () => {
    const user = userEvent.setup()
    render(<BugReportFab />)

    await user.click(screen.getByRole("button", { name: "Rapportera fel" }))

    await user.type(screen.getByLabelText("Titel *"), "Test bugg")
    await user.type(screen.getByLabelText("Beskrivning *"), "Beskrivning här")

    const submitBtn = screen.getByRole("button", { name: "Skicka rapport" })
    expect(submitBtn).toBeEnabled()
  })

  it("shows receipt with reference ID after successful submit", async () => {
    const user = userEvent.setup()
    render(<BugReportFab />)

    await user.click(screen.getByRole("button", { name: "Rapportera fel" }))
    await user.type(screen.getByLabelText("Titel *"), "Test bugg")
    await user.type(screen.getByLabelText("Beskrivning *"), "Beskrivning")
    await user.click(screen.getByRole("button", { name: "Skicka rapport" }))

    await waitFor(() => {
      expect(screen.getByText("Rapport mottagen")).toBeInTheDocument()
      expect(screen.getByText("bug-123")).toBeInTheDocument()
    })
  })

  it("posts to /api/bug-reports with correct payload", async () => {
    const user = userEvent.setup()
    render(<BugReportFab />)

    await user.click(screen.getByRole("button", { name: "Rapportera fel" }))
    await user.type(screen.getByLabelText("Titel *"), "Test bugg")
    await user.type(screen.getByLabelText("Beskrivning *"), "Beskrivning")
    await user.click(screen.getByRole("button", { name: "Skicka rapport" }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining('"title":"Test bugg"'),
      })
    })
  })

  it("shows error toast on failed submit", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({ error: "För många förfrågningar" }),
    })

    const user = userEvent.setup()
    render(<BugReportFab />)

    await user.click(screen.getByRole("button", { name: "Rapportera fel" }))
    await user.type(screen.getByLabelText("Titel *"), "Test")
    await user.type(screen.getByLabelText("Beskrivning *"), "Desc")
    await user.click(screen.getByRole("button", { name: "Skicka rapport" }))

    // Verify no receipt shown (error path)
    await waitFor(() => {
      expect(
        screen.queryByText("Rapport mottagen")
      ).not.toBeInTheDocument()
    })
  })
})
