import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CustomerOnboardingChecklist } from "./CustomerOnboardingChecklist"
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

describe("CustomerOnboardingChecklist", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    // Reset getItem to default (mockReturnValue persists across clearAllMocks)
    localStorageMock.getItem.mockImplementation(() => null)
  })

  it("should show nothing while loading", () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    const { container } = render(<CustomerOnboardingChecklist />)
    expect(container.innerHTML).toBe("")
  })

  it("should show nothing when allComplete is true", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        profileComplete: true,
        hasHorses: true,
        hasBookings: true,
        hasReviews: true,
        allComplete: true,
      }),
    })

    const { container } = render(<CustomerOnboardingChecklist />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    // Wait a tick for state to settle
    await waitFor(() => {
      expect(container.querySelector("[data-testid='customer-onboarding']")).toBeNull()
    })
  })

  it("should show nothing when dismissed via localStorage", async () => {
    localStorageMock.getItem.mockImplementation(() => "true")
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        profileComplete: false,
        hasHorses: false,
        hasBookings: false,
        hasReviews: false,
        allComplete: false,
      }),
    })

    const { container } = render(<CustomerOnboardingChecklist />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    expect(container.querySelector("[data-testid='customer-onboarding']")).toBeNull()
  })

  it("should render checklist with incomplete steps", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        profileComplete: true,
        hasHorses: false,
        hasBookings: false,
        hasReviews: false,
        allComplete: false,
      }),
    })

    render(<CustomerOnboardingChecklist />)
    await waitFor(() => {
      expect(screen.getByText("Kom igång")).toBeInTheDocument()
    })

    expect(screen.getByText("1 av 4 klara")).toBeInTheDocument()
    expect(screen.getByText("Fyll i din profil")).toBeInTheDocument()
    expect(screen.getByText("Lägg till en häst")).toBeInTheDocument()
    expect(screen.getByText("Gör din första bokning")).toBeInTheDocument()
    expect(screen.getByText("Lämna en recension")).toBeInTheDocument()
  })

  it("should show completed count correctly", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        profileComplete: true,
        hasHorses: true,
        hasBookings: true,
        hasReviews: false,
        allComplete: false,
      }),
    })

    render(<CustomerOnboardingChecklist />)
    await waitFor(() => {
      expect(screen.getByText("3 av 4 klara")).toBeInTheDocument()
    })
  })

  it("should dismiss checklist when X clicked", async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        profileComplete: false,
        hasHorses: false,
        hasBookings: false,
        hasReviews: false,
        allComplete: false,
      }),
    })

    render(<CustomerOnboardingChecklist />)
    await waitFor(() => {
      expect(screen.getByText("Kom igång")).toBeInTheDocument()
    })

    await user.click(screen.getByLabelText("Dölj checklistan"))

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "equinet_customer_onboarding_dismissed",
      "true"
    )
    expect(screen.queryByText("Kom igång")).not.toBeInTheDocument()
  })

  it("should show nothing when fetch fails", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"))

    const { container } = render(<CustomerOnboardingChecklist />)
    await waitFor(() => expect(mockFetch).toHaveBeenCalled())

    await waitFor(() => {
      expect(container.querySelector("[data-testid='customer-onboarding']")).toBeNull()
    })
  })
})
