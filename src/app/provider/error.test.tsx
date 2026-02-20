import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// Mock useOnlineStatus before importing component
let mockIsOnline = true
vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => mockIsOnline,
}))

import ProviderError from "./error"

describe("ProviderError (error boundary)", () => {
  const mockReset = vi.fn()
  const testError = new Error("Test error message")

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsOnline = true
  })

  describe("when offline", () => {
    beforeEach(() => {
      mockIsOnline = false
    })

    it("renders offline UI with WifiOff messaging", () => {
      render(<ProviderError error={testError} reset={mockReset} />)

      expect(
        screen.getByText("Ingen internetanslutning")
      ).toBeInTheDocument()
      expect(
        screen.getByText(
          "Sidan kunde inte laddas. Kontrollera din internetanslutning och försök igen."
        )
      ).toBeInTheDocument()
    })

    it("shows retry button that calls reset", async () => {
      const user = userEvent.setup()
      render(<ProviderError error={testError} reset={mockReset} />)

      const retryButton = screen.getByRole("button", {
        name: /försök igen/i,
      })
      await user.click(retryButton)

      expect(mockReset).toHaveBeenCalledOnce()
    })
  })

  describe("when online (non-offline error)", () => {
    it("renders generic error UI", () => {
      render(<ProviderError error={testError} reset={mockReset} />)

      expect(screen.getByText("Något gick fel")).toBeInTheDocument()
      expect(
        screen.getByText(
          "Ett oväntat fel uppstod. Försök igen eller gå tillbaka till översikten."
        )
      ).toBeInTheDocument()
    })

    it("shows retry button that calls reset", async () => {
      const user = userEvent.setup()
      render(<ProviderError error={testError} reset={mockReset} />)

      const retryButton = screen.getByRole("button", {
        name: /försök igen/i,
      })
      await user.click(retryButton)

      expect(mockReset).toHaveBeenCalledOnce()
    })

    it("logs the error to console", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      render(<ProviderError error={testError} reset={mockReset} />)

      expect(consoleSpy).toHaveBeenCalledWith("Provider error:", testError)
      consoleSpy.mockRestore()
    })
  })

  describe("when offline, does NOT log error", () => {
    it("suppresses console.error for offline errors", () => {
      mockIsOnline = false
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      render(<ProviderError error={testError} reset={mockReset} />)

      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})
