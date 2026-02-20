import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { OfflineErrorState } from "./OfflineErrorState"

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(() => false),
}))

import { useOnlineStatus } from "@/hooks/useOnlineStatus"

describe("OfflineErrorState", () => {
  beforeEach(() => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders offline message", () => {
    render(<OfflineErrorState />)
    expect(screen.getByText("Du är offline")).toBeInTheDocument()
    expect(
      screen.getByText("Data kan inte hämtas utan internetanslutning.")
    ).toBeInTheDocument()
  })

  it("renders custom title and description", () => {
    render(
      <OfflineErrorState
        title="Ingen anslutning"
        description="Anpassat meddelande"
      />
    )
    expect(screen.getByText("Ingen anslutning")).toBeInTheDocument()
    expect(screen.getByText("Anpassat meddelande")).toBeInTheDocument()
  })

  it("calls onRetry when retry button is clicked", () => {
    const onRetry = vi.fn()
    render(<OfflineErrorState onRetry={onRetry} />)

    const retryButton = screen.getByRole("button", { name: /försök igen/i })
    fireEvent.click(retryButton)

    expect(onRetry).toHaveBeenCalledOnce()
  })
})
