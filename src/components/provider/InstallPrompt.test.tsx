import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/components/providers/FeatureFlagProvider", () => ({
  useFeatureFlag: vi.fn(),
}))

import { InstallPrompt } from "./InstallPrompt"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"

const mockUseFeatureFlag = vi.mocked(useFeatureFlag)

describe("InstallPrompt", () => {
  let mockLocalStorage: Record<string, string>

  beforeEach(() => {
    mockLocalStorage = {}
    mockUseFeatureFlag.mockReturnValue(true)

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key: string) => mockLocalStorage[key] ?? null
    )
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      (key: string, value: string) => {
        mockLocalStorage[key] = value
      }
    )

    // Default: not in standalone mode
    Object.defineProperty(window, "matchMedia", {
      writable: true,
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

    // Default: not iOS
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (Linux; Android 12)",
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders nothing when feature flag is disabled", () => {
    mockUseFeatureFlag.mockReturnValue(false)
    const { container } = render(<InstallPrompt />)
    expect(container.textContent).toBe("")
  })

  it("renders nothing when already in standalone mode", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(display-mode: standalone)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    const { container } = render(<InstallPrompt />)
    expect(container.textContent).toBe("")
  })

  it("renders nothing when previously dismissed", () => {
    mockLocalStorage["equinet-install-dismissed"] = "true"
    const { container } = render(<InstallPrompt />)
    expect(container.textContent).toBe("")
  })

  it("shows iOS instructions on iOS devices", () => {
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      writable: true,
      configurable: true,
    })
    render(<InstallPrompt />)
    expect(
      screen.getByText("Lägg till på hemskärmen:", { exact: false })
    ).toBeInTheDocument()
  })

  it("dismiss button persists to localStorage", async () => {
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      writable: true,
      configurable: true,
    })
    const user = userEvent.setup()
    render(<InstallPrompt />)

    const dismissButton = screen.getByRole("button", {
      name: /stäng/i,
    })
    await user.click(dismissButton)

    expect(mockLocalStorage["equinet-install-dismissed"]).toBe("true")
  })
})
