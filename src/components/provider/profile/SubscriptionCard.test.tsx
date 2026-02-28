import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SubscriptionCard } from "./SubscriptionCard"
import type { SubscriptionStatus } from "./SubscriptionCard"

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe("SubscriptionCard", () => {
  const defaultProps = {
    guardMutation: async (fn: () => Promise<void>) => fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe("loading state", () => {
    it("shows skeleton while loading", () => {
      render(<SubscriptionCard {...defaultProps} status={undefined} isLoading={true} />)
      expect(screen.getByTestId("subscription-skeleton")).toBeInTheDocument()
    })
  })

  describe("no subscription", () => {
    it("shows activation prompt when no subscription", () => {
      render(<SubscriptionCard {...defaultProps} status={null} isLoading={false} />)
      expect(screen.getByText("Prenumeration")).toBeInTheDocument()
      expect(screen.getByText(/Aktivera din prenumeration/)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Välj plan/i })).toBeInTheDocument()
    })

    it("calls checkout API when clicking choose plan", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ checkoutUrl: "https://mock-checkout.example.com" }),
      })

      // Mock window.location.href
      const originalLocation = window.location
      Object.defineProperty(window, "location", {
        writable: true,
        value: { ...originalLocation, href: "" },
      })

      render(<SubscriptionCard {...defaultProps} status={null} isLoading={false} />)
      const button = screen.getByRole("button", { name: /Välj plan/i })
      await userEvent.click(button)

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/provider/subscription/checkout",
        expect.objectContaining({
          method: "POST",
        })
      )

      // Restore
      Object.defineProperty(window, "location", {
        writable: true,
        value: originalLocation,
      })
    })
  })

  describe("active subscription", () => {
    const activeStatus: SubscriptionStatus = {
      status: "active",
      planId: "basic",
      currentPeriodEnd: "2026-04-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    }

    it("shows active badge and plan info", () => {
      render(<SubscriptionCard {...defaultProps} status={activeStatus} isLoading={false} />)
      expect(screen.getByText("Aktiv")).toBeInTheDocument()
      expect(screen.getByText(/Basic/i)).toBeInTheDocument()
      expect(screen.getByText(/1 april 2026/)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Hantera prenumeration/i })).toBeInTheDocument()
    })
  })

  describe("past_due subscription", () => {
    const pastDueStatus: SubscriptionStatus = {
      status: "past_due",
      planId: "basic",
      currentPeriodEnd: "2026-04-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    }

    it("shows warning badge and update payment prompt", () => {
      render(<SubscriptionCard {...defaultProps} status={pastDueStatus} isLoading={false} />)
      expect(screen.getByText("Betalning saknas")).toBeInTheDocument()
      expect(screen.getByText(/Det gick inte att dra pengar/)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Uppdatera betalning/i })).toBeInTheDocument()
    })
  })

  describe("canceling subscription", () => {
    const cancelingStatus: SubscriptionStatus = {
      status: "active",
      planId: "basic",
      currentPeriodEnd: "2026-04-01T00:00:00.000Z",
      cancelAtPeriodEnd: true,
    }

    it("shows canceling badge and reactivation prompt", () => {
      render(<SubscriptionCard {...defaultProps} status={cancelingStatus} isLoading={false} />)
      expect(screen.getByText("Avslutas")).toBeInTheDocument()
      expect(screen.getByText(/Aktiv till 1 april 2026/)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Återaktivera/i })).toBeInTheDocument()
    })
  })
})
