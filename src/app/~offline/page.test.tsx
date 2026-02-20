import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import OfflinePage from "./page"

// Mock lucide-react (only external dependency allowed on offline page)
vi.mock("lucide-react", () => ({
  WifiOff: (props: Record<string, unknown>) => <svg data-testid="wifi-off-icon" {...props} />,
}))

describe("~offline page", () => {
  it("renders without providers or layout wrappers", () => {
    render(<OfflinePage />)
    expect(screen.getByText("Ingen internetanslutning")).toBeInTheDocument()
  })

  it("shows retry button that reloads the page", () => {
    const reloadMock = vi.fn()
    Object.defineProperty(window, "location", {
      value: { reload: reloadMock },
      writable: true,
    })

    render(<OfflinePage />)
    const button = screen.getByRole("button", { name: /försök igen/i })
    fireEvent.click(button)
    expect(reloadMock).toHaveBeenCalled()
  })

  it("shows WifiOff icon", () => {
    render(<OfflinePage />)
    expect(screen.getByTestId("wifi-off-icon")).toBeInTheDocument()
  })
})
