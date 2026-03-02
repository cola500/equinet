import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { StaleDataBanner } from "./StaleDataBanner"

vi.mock("@/components/providers/FeatureFlagProvider", () => ({
  useFeatureFlag: vi.fn(() => true),
}))

describe("StaleDataBanner", () => {
  it("renders nothing when not stale", () => {
    const { container } = render(<StaleDataBanner isStale={false} />)
    expect(container.textContent).toBe("")
  })

  it("shows warning banner when data is stale", () => {
    render(<StaleDataBanner isStale={true} />)
    expect(screen.getByText(/inaktuell/i)).toBeInTheDocument()
  })

  it("has accessible role", () => {
    render(<StaleDataBanner isStale={true} />)
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("uses amber styling for stale warning", () => {
    render(<StaleDataBanner isStale={true} />)
    const banner = screen.getByRole("status")
    expect(banner.className).toContain("amber")
  })
})
