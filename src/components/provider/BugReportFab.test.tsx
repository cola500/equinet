import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BugReportFab } from "./BugReportFab"

// Mock Drawer to avoid vaul pointer-event errors in jsdom
vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="drawer">{children}</div> : null,
  DrawerContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DrawerDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DrawerFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DrawerClose: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock feature flags
const mockUseFeatureFlag = vi.fn()
const mockUseFeatureFlags = vi.fn()
vi.mock("@/components/providers/FeatureFlagProvider", () => ({
  useFeatureFlag: (key: string) => mockUseFeatureFlag(key),
  useFeatureFlags: () => mockUseFeatureFlags(),
}))

// Mock online status
const mockUseOnlineStatus = vi.fn()
vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}))

// Mock auth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}))

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/provider/calendar",
}))

// Mock debug-logger
vi.mock("@/lib/offline/debug-logger", () => ({
  getDebugLogs: vi.fn().mockResolvedValue([]),
}))

// Mock submitBugReport
const mockSubmitBugReport = vi.fn()
vi.mock("@/lib/offline/bug-report", () => ({
  submitBugReport: (...args: unknown[]) => mockSubmitBugReport(...args),
}))

describe("BugReportFab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseFeatureFlag.mockReturnValue(true)
    mockUseFeatureFlags.mockReturnValue({ offline_mode: true })
    mockUseOnlineStatus.mockReturnValue(true)
    mockSubmitBugReport.mockResolvedValue("=== EQUINET BUGGRAPPORT ===\nTest rapport")
    // Default: no navigator.share
    Object.defineProperty(navigator, "share", {
      value: undefined,
      writable: true,
      configurable: true,
    })
    // jsdom lacks matchMedia
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it("renders nothing when offline_mode flag is false", () => {
    mockUseFeatureFlag.mockReturnValue(false)

    const { container } = render(<BugReportFab />)

    expect(container.innerHTML).toBe("")
  })

  it("renders FAB button when flag is true", () => {
    render(<BugReportFab />)

    expect(screen.getByRole("button", { name: "Rapportera fel" })).toBeInTheDocument()
  })

  it("FAB has accessible label", () => {
    render(<BugReportFab />)

    const button = screen.getByRole("button", { name: "Rapportera fel" })
    expect(button).toBeInTheDocument()
  })

  it("click opens drawer with textarea and submit button", async () => {
    const user = userEvent.setup()
    render(<BugReportFab />)

    await user.click(screen.getByRole("button", { name: "Rapportera fel" }))

    expect(screen.getByPlaceholderText("Beskriv problemet...")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Skapa rapport" })).toBeInTheDocument()
  })

  it("calls navigator.share() when available after submit", async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "share", {
      value: mockShare,
      writable: true,
      configurable: true,
    })

    const user = userEvent.setup()
    render(<BugReportFab />)

    await user.click(screen.getByRole("button", { name: "Rapportera fel" }))
    await user.type(screen.getByPlaceholderText("Beskriv problemet..."), "Test bugg")
    await user.click(screen.getByRole("button", { name: "Skapa rapport" }))

    await waitFor(() => {
      expect(mockShare).toHaveBeenCalledWith({
        title: "Equinet buggrapport",
        text: expect.stringContaining("EQUINET BUGGRAPPORT"),
      })
    })
  })

  it("shows textarea fallback when navigator.share is not available", async () => {
    const user = userEvent.setup()
    render(<BugReportFab />)

    await user.click(screen.getByRole("button", { name: "Rapportera fel" }))
    await user.click(screen.getByRole("button", { name: "Skapa rapport" }))

    // Should show the report text in a readonly textarea
    const reportArea = await screen.findByRole("textbox", { name: /buggrapport/i })
    expect(reportArea).toBeInTheDocument()
    expect(reportArea).toHaveAttribute("readOnly")
    expect(reportArea).toHaveValue("=== EQUINET BUGGRAPPORT ===\nTest rapport")

    // Should show instruction text
    expect(screen.getByText(/markera texten/i)).toBeInTheDocument()
  })

  it("handles AbortError from share without showing error", async () => {
    const abortError = new Error("Share cancelled")
    abortError.name = "AbortError"
    const mockShare = vi.fn().mockRejectedValue(abortError)
    Object.defineProperty(navigator, "share", {
      value: mockShare,
      writable: true,
      configurable: true,
    })

    const user = userEvent.setup()
    render(<BugReportFab />)

    await user.click(screen.getByRole("button", { name: "Rapportera fel" }))
    await user.click(screen.getByRole("button", { name: "Skapa rapport" }))

    await waitFor(() => {
      expect(mockShare).toHaveBeenCalled()
    })

    // Should NOT show the textarea fallback (AbortError = user cancelled)
    expect(screen.queryByRole("textbox", { name: /buggrapport/i })).not.toBeInTheDocument()
  })
})
