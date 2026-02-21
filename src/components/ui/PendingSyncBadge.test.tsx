import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { PendingSyncBadge } from "./PendingSyncBadge"

vi.mock("@/hooks/usePendingMutation", () => ({
  usePendingMutation: vi.fn(() => ({ hasPending: false, count: 0 })),
}))

import { usePendingMutation } from "@/hooks/usePendingMutation"

describe("PendingSyncBadge", () => {
  it("should render nothing when no pending mutations", () => {
    vi.mocked(usePendingMutation).mockReturnValue({ hasPending: false, count: 0 })
    const { container } = render(<PendingSyncBadge entityId="abc" />)
    expect(container.firstChild).toBeNull()
  })

  it("should render amber badge when pending mutations exist", () => {
    vi.mocked(usePendingMutation).mockReturnValue({ hasPending: true, count: 1 })
    render(<PendingSyncBadge entityId="abc" />)
    expect(screen.getByText("Väntar på synk")).toBeInTheDocument()
  })
})
