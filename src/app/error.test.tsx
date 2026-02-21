import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// No mocks needed -- the component is self-contained (no external imports)

import GlobalError from "./error"

describe("GlobalError (error boundary)", () => {
  const mockReset = vi.fn()
  const testError = new Error("Test error message")
  let originalOnLine: boolean

  beforeEach(() => {
    vi.clearAllMocks()
    originalOnLine = navigator.onLine
    sessionStorage.clear()
  })

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      writable: true,
      configurable: true,
    })
  })

  function setOnlineStatus(online: boolean) {
    Object.defineProperty(navigator, "onLine", {
      value: online,
      writable: true,
      configurable: true,
    })
  }

  describe("renders without external chunk dependencies", () => {
    it("renders with only React (no lucide-react, no @/components, no @/hooks)", () => {
      render(<GlobalError error={testError} reset={mockReset} />)
      expect(screen.getByText("Något gick fel")).toBeInTheDocument()
    })
  })

  describe("when offline", () => {
    beforeEach(() => {
      setOnlineStatus(false)
    })

    it("renders offline UI with WifiOff messaging", () => {
      render(<GlobalError error={testError} reset={mockReset} />)

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
      render(<GlobalError error={testError} reset={mockReset} />)

      const retryButton = screen.getByRole("button", {
        name: /försök igen/i,
      })
      await user.click(retryButton)

      expect(mockReset).toHaveBeenCalledOnce()
    })
  })

  describe("when online (non-offline error)", () => {
    beforeEach(() => {
      setOnlineStatus(true)
    })

    it("renders generic error UI", () => {
      render(<GlobalError error={testError} reset={mockReset} />)

      expect(screen.getByText("Något gick fel")).toBeInTheDocument()
      expect(
        screen.getByText(
          "Ett oväntat fel uppstod. Försök igen eller gå tillbaka till startsidan."
        )
      ).toBeInTheDocument()
    })

    it("shows retry button that calls reset", async () => {
      const user = userEvent.setup()
      render(<GlobalError error={testError} reset={mockReset} />)

      const retryButton = screen.getByRole("button", {
        name: /försök igen/i,
      })
      await user.click(retryButton)

      expect(mockReset).toHaveBeenCalledOnce()
    })

    it("logs the error to console", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      render(<GlobalError error={testError} reset={mockReset} />)

      expect(consoleSpy).toHaveBeenCalledWith("Application error:", testError)
      consoleSpy.mockRestore()
    })
  })

  describe("when offline, does NOT log error", () => {
    it("suppresses console.error for offline errors", () => {
      setOnlineStatus(false)
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      render(<GlobalError error={testError} reset={mockReset} />)

      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe("ChunkLoadError detection", () => {
    it("reloads page on ChunkLoadError", () => {
      setOnlineStatus(true)
      const reloadMock = vi.fn()
      Object.defineProperty(window, "location", {
        value: { ...window.location, reload: reloadMock },
        writable: true,
        configurable: true,
      })

      const chunkError = new Error(
        "Loading chunk 6619 failed (error: .../app/error-abc123.js)"
      )
      render(<GlobalError error={chunkError} reset={mockReset} />)

      expect(reloadMock).toHaveBeenCalledOnce()
    })

    it("limits reload to once via sessionStorage", () => {
      setOnlineStatus(true)
      const reloadMock = vi.fn()
      Object.defineProperty(window, "location", {
        value: { ...window.location, reload: reloadMock },
        writable: true,
        configurable: true,
      })

      sessionStorage.setItem("chunk-reload-attempted", "1")

      const chunkError = new Error("Loading chunk 1234 failed")
      render(<GlobalError error={chunkError} reset={mockReset} />)

      expect(reloadMock).not.toHaveBeenCalled()
    })
  })

  describe("online/offline event switching", () => {
    it("switches to offline UI when offline event fires", () => {
      setOnlineStatus(true)
      render(<GlobalError error={testError} reset={mockReset} />)

      expect(screen.getByText("Något gick fel")).toBeInTheDocument()

      act(() => {
        setOnlineStatus(false)
        window.dispatchEvent(new Event("offline"))
      })

      expect(screen.getByText("Ingen internetanslutning")).toBeInTheDocument()
    })
  })
})
