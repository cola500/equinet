import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { OnboardingWelcome } from "./OnboardingWelcome"
import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock localStorage (same pattern as OnboardingChecklist tests)
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    get length() { return Object.keys(store).length },
    key: vi.fn(),
  }
})()
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
})

const defaultStatus = {
  profileComplete: false,
  hasServices: false,
  hasAvailability: false,
  hasServiceArea: false,
}

describe("OnboardingWelcome", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  it("renders welcome heading and progress", () => {
    render(<OnboardingWelcome status={defaultStatus} />)

    expect(screen.getByText("Välkommen till Equinet!")).toBeInTheDocument()
    expect(screen.getByText("0 av 4 klara")).toBeInTheDocument()
  })

  it("shows all 4 steps with CTA buttons", () => {
    render(<OnboardingWelcome status={defaultStatus} />)

    expect(screen.getByText("Fyll i företagsinformation")).toBeInTheDocument()
    expect(screen.getByText("Lägg till minst en tjänst")).toBeInTheDocument()
    expect(screen.getByText("Ställ in tillgänglighet")).toBeInTheDocument()
    expect(screen.getByText("Lägg till serviceområde")).toBeInTheDocument()
  })

  it("shows correct progress when some steps are complete", () => {
    render(
      <OnboardingWelcome
        status={{ ...defaultStatus, profileComplete: true, hasServices: true }}
      />
    )

    expect(screen.getByText("2 av 4 klara")).toBeInTheDocument()
  })

  it("shows green checkmarks for completed steps", () => {
    render(
      <OnboardingWelcome
        status={{ ...defaultStatus, profileComplete: true }}
      />
    )

    // The completed step should have an "Redigera" link, not "Fyll i profil"
    const profileStep = screen.getByText("Fyll i företagsinformation").closest("[data-testid]")
    expect(profileStep).toHaveAttribute("data-testid", "step-profileComplete-done")
  })

  it("shows incomplete marker for pending steps", () => {
    render(<OnboardingWelcome status={defaultStatus} />)

    const profileStep = screen.getByText("Fyll i företagsinformation").closest("[data-testid]")
    expect(profileStep).toHaveAttribute("data-testid", "step-profileComplete-pending")
  })

  it("navigates to correct href for each step", () => {
    render(<OnboardingWelcome status={defaultStatus} />)

    const links = screen.getAllByRole("link")
    const hrefs = links.map((l) => l.getAttribute("href"))

    expect(hrefs).toContain("/provider/profile")
    expect(hrefs).toContain("/provider/services")
    expect(hrefs).toContain("/provider/profile?section=availability")
    expect(hrefs).toContain("/provider/profile?section=location")
  })

  it("calls onDismiss and saves to localStorage when dismiss clicked", async () => {
    const onDismiss = vi.fn()
    const user = userEvent.setup()

    render(<OnboardingWelcome status={defaultStatus} onDismiss={onDismiss} />)

    await user.click(screen.getByText("Visa dashboard ändå"))

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "equinet_onboarding_dismissed",
      expect.any(String)
    )
    expect(onDismiss).toHaveBeenCalled()
  })

  it("returns null when dismissed via localStorage (within 7 days)", async () => {
    localStorageMock.getItem.mockImplementation((key: string) =>
      key === "equinet_onboarding_dismissed" ? String(Date.now()) : null
    )

    const { container } = render(<OnboardingWelcome status={defaultStatus} />)

    await waitFor(() => {
      expect(container.innerHTML).toBe("")
    })
  })

  it("shows when dismiss has expired (older than 7 days)", () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
    localStorageMock.getItem.mockImplementation((key: string) =>
      key === "equinet_onboarding_dismissed" ? String(eightDaysAgo) : null
    )

    render(<OnboardingWelcome status={defaultStatus} />)

    expect(screen.getByText("Välkommen till Equinet!")).toBeInTheDocument()
  })

  it("shows progress bar with correct width", () => {
    render(
      <OnboardingWelcome
        status={{ ...defaultStatus, profileComplete: true, hasServices: true }}
      />
    )

    const progressBar = screen.getByRole("progressbar", { name: "Onboarding-framsteg" })
    expect(progressBar).toHaveAttribute("aria-valuenow", "2")
    expect(progressBar).toHaveAttribute("aria-valuemax", "4")
  })
})
