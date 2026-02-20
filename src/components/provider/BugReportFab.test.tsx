import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BugReportFab } from "./BugReportFab"

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
    mockSubmitBugReport.mockResolvedValue("=== EQUINET BUGGRAPPORT ===")
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

    expect(await screen.findByPlaceholderText("Beskriv problemet...")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Skapa rapport" })).toBeInTheDocument()
  })
})
