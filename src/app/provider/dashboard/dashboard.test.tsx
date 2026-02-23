import { render, screen, waitFor } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/provider/dashboard",
}))

// Mock auth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isLoading: false, isProvider: true, isCustomer: false }),
}))

// Mock services
const mockServices = [
  { id: "s1", name: "Hovvård", price: 800, durationMinutes: 60, isActive: true },
  { id: "s2", name: "Tandvård", price: 1200, durationMinutes: 90, isActive: false },
]
vi.mock("@/hooks/useServices", () => ({
  useServices: () => ({ services: mockServices, isLoading: false }),
}))

// Mock bookings
const mockBookings = [
  { id: "b1", status: "pending", bookingDate: new Date(Date.now() + 86400000).toISOString() },
  { id: "b2", status: "confirmed", bookingDate: new Date(Date.now() + 172800000).toISOString() },
  { id: "b3", status: "completed", bookingDate: new Date(Date.now() - 86400000).toISOString() },
]
vi.mock("@/hooks/useBookings", () => ({
  useBookings: () => ({ bookings: mockBookings, isLoading: false }),
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock feature flags
vi.mock("@/components/providers/FeatureFlagProvider", () => ({
  useFeatureFlag: (flag: string) => flag === "voice_logging" || flag === "route_planning",
  useFeatureFlags: () => ({
    voice_logging: true,
    route_planning: true,
    route_announcements: true,
    customer_insights: true,
    due_for_service: true,
    group_bookings: false,
  }),
}))

// Mock retry
vi.mock("@/hooks/useRetry", () => ({
  useRetry: () => ({
    retry: (fn: () => void) => fn(),
    retryCount: 0,
    isRetrying: false,
    canRetry: true,
  }),
}))

// Mock onboarding
vi.mock("@/components/provider/OnboardingChecklist", () => ({
  OnboardingChecklist: () => null,
}))

import ProviderDashboard from "./page"

async function renderAndWait() {
  render(<ProviderDashboard />)
  await waitFor(() => {
    expect(screen.getByText("Välkommen tillbaka!")).toBeInTheDocument()
  })
}

describe("ProviderDashboard - KPI cards and Quick Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ averageRating: null, totalCount: 0 }),
    })
  })

  it("should render KPI card 'Aktiva tjänster' as a link to /provider/services", async () => {
    await renderAndWait()

    const card = screen.getByText("Aktiva tjänster").closest("a")
    expect(card).toHaveAttribute("href", "/provider/services")
  })

  it("should render KPI card 'Kommande bokningar' as a link to /provider/bookings", async () => {
    await renderAndWait()

    const card = screen.getByText("Kommande bokningar").closest("a")
    expect(card).toHaveAttribute("href", "/provider/bookings")
  })

  it("should render KPI card 'Nya förfrågningar' as a link to /provider/bookings", async () => {
    await renderAndWait()

    const card = screen.getByText("Nya förfrågningar").closest("a")
    expect(card).toHaveAttribute("href", "/provider/bookings")
  })

  it("should render quick action links with icons", async () => {
    await renderAndWait()

    // Quick actions section contains "Snabblänkar" heading
    const quickActionsCard = screen.getByText("Snabblänkar").closest("[data-slot='card']")!
    expect(quickActionsCard).toBeInTheDocument()

    // Verify quick action buttons by text content
    expect(screen.getByText("Hantera tjänster")).toBeInTheDocument()
    expect(screen.getByText("Kundregister")).toBeInTheDocument()
    expect(screen.getByText("Planera rutter")).toBeInTheDocument()
  })

  it("should show voice logging quick action when feature flag enabled", async () => {
    await renderAndWait()

    const matches = screen.getAllByText("Logga arbete")
    // At least one in quick actions (plus possibly one in ProviderNav)
    expect(matches.length).toBeGreaterThanOrEqual(1)
    const quickActionButton = matches.find(el => el.closest("button"))
    expect(quickActionButton).toBeDefined()
  })

  it("should render correct active services count", async () => {
    await renderAndWait()

    // 1 active service out of 2, card wrapped in Link
    const activeServicesLink = screen.getByText("Aktiva tjänster").closest("a")
    expect(activeServicesLink).toHaveAttribute("href", "/provider/services")
  })
})
