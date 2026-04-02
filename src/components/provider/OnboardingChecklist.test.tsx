import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { OnboardingChecklist } from "./OnboardingChecklist"
import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()
Object.defineProperty(window, "localStorage", { value: localStorageMock })

function mockOnboardingResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      profileComplete: false,
      hasServices: false,
      hasAvailability: false,
      hasServiceArea: false,
      allComplete: false,
      ...overrides,
    }),
  }
}

describe("OnboardingChecklist", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    localStorageMock.getItem.mockImplementation(() => null)
  })

  it("shows nothing while loading", () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    const { container } = render(<OnboardingChecklist />)
    expect(container.innerHTML).toBe("")
  })

  it("shows 4 checklist steps with correct labels", async () => {
    mockFetch.mockResolvedValue(mockOnboardingResponse())

    render(<OnboardingChecklist />)
    await waitFor(() => {
      expect(screen.getByText("Kom igång")).toBeInTheDocument()
    })

    expect(screen.getByText("Fyll i företagsinformation")).toBeInTheDocument()
    expect(screen.getByText("Lägg till minst en tjänst")).toBeInTheDocument()
    expect(screen.getByText("Ställ in tillgänglighet")).toBeInTheDocument()
    expect(screen.getByText("Lägg till serviceområde")).toBeInTheDocument()
  })

  it("shows correct completed count", async () => {
    mockFetch.mockResolvedValue(mockOnboardingResponse({
      profileComplete: true,
      hasServices: true,
    }))

    render(<OnboardingChecklist />)
    await waitFor(() => {
      expect(screen.getByText("2 av 4 klara")).toBeInTheDocument()
    })
  })

  it("hides when allComplete is true", async () => {
    mockFetch.mockResolvedValue(mockOnboardingResponse({
      profileComplete: true,
      hasServices: true,
      hasAvailability: true,
      hasServiceArea: true,
      allComplete: true,
    }))

    const { container } = render(<OnboardingChecklist />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    await waitFor(() => {
      expect(container.innerHTML).toBe("")
    })
  })

  it("hides when dismissed via localStorage (within 7 days)", async () => {
    localStorageMock.getItem.mockImplementation(() => String(Date.now()))
    mockFetch.mockResolvedValue(mockOnboardingResponse())

    const { container } = render(<OnboardingChecklist />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    await waitFor(() => {
      expect(container.innerHTML).toBe("")
    })
  })

  it("shows again when dismiss has expired (older than 7 days)", async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
    localStorageMock.getItem.mockImplementation(() => String(eightDaysAgo))
    mockFetch.mockResolvedValue(mockOnboardingResponse())

    render(<OnboardingChecklist />)
    await waitFor(() => {
      expect(screen.getByText("Kom igång")).toBeInTheDocument()
    })
  })

  it("dismisses when X button clicked", async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue(mockOnboardingResponse())

    render(<OnboardingChecklist />)
    await waitFor(() => {
      expect(screen.getByText("Kom igång")).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText("Dölj checklistan"))

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "equinet_onboarding_dismissed",
      expect.any(String)
    )
    expect(screen.queryByText("Kom igång")).not.toBeInTheDocument()
  })

  it("shows nothing when fetch fails", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"))

    const { container } = render(<OnboardingChecklist />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    await waitFor(() => {
      expect(container.innerHTML).toBe("")
    })
  })

  it("does not reference isActive step", async () => {
    mockFetch.mockResolvedValue(mockOnboardingResponse())

    render(<OnboardingChecklist />)
    await waitFor(() => {
      expect(screen.getByText("Kom igång")).toBeInTheDocument()
    })

    expect(screen.queryByText("Aktivera bokningar")).not.toBeInTheDocument()
  })

  it("uses query params not hash links for profile sections", async () => {
    mockFetch.mockResolvedValue(mockOnboardingResponse())

    render(<OnboardingChecklist />)
    await waitFor(() => {
      expect(screen.getByText("Kom igång")).toBeInTheDocument()
    })

    const availabilityLink = screen.getByText("Ställ in tillgänglighet").closest("a")
    const locationLink = screen.getByText("Lägg till serviceområde").closest("a")

    expect(availabilityLink?.getAttribute("href")).toBe("/provider/profile?section=availability")
    expect(locationLink?.getAttribute("href")).toBe("/provider/profile?section=location")
  })
})
