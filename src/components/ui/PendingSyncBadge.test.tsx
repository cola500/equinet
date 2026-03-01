import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { PendingSyncBadge } from "./PendingSyncBadge"

vi.mock("@/hooks/usePendingMutation", () => ({
  usePendingMutation: vi.fn(() => ({ hasPending: false, count: 0, hasConflict: false, hasFailed: false })),
}))

import { usePendingMutation } from "@/hooks/usePendingMutation"

describe("PendingSyncBadge", () => {
  it("should render nothing when no pending mutations", () => {
    vi.mocked(usePendingMutation).mockReturnValue({ hasPending: false, count: 0, hasConflict: false, hasFailed: false })
    const { container } = render(<PendingSyncBadge entityId="abc" />)
    expect(container.firstChild).toBeNull()
  })

  it("should render amber badge when pending mutations exist", () => {
    vi.mocked(usePendingMutation).mockReturnValue({ hasPending: true, count: 1, hasConflict: false, hasFailed: false })
    render(<PendingSyncBadge entityId="abc" />)
    expect(screen.getByText("Sparad lokalt")).toBeInTheDocument()
  })

  it("should show red badge when mutation has conflict status", () => {
    vi.mocked(usePendingMutation).mockReturnValue({ hasPending: true, count: 1, hasConflict: true, hasFailed: false })
    render(<PendingSyncBadge entityId="abc" />)
    const badge = screen.getByText("Synkkonflikt")
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain("bg-red")
  })

  it("should show red badge when mutation has failed status", () => {
    vi.mocked(usePendingMutation).mockReturnValue({ hasPending: true, count: 1, hasConflict: false, hasFailed: true })
    render(<PendingSyncBadge entityId="abc" />)
    const badge = screen.getByText("Synk misslyckades")
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain("bg-red")
  })
})
