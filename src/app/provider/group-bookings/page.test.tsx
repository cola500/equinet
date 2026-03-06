import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ isLoading: false, isProvider: true })),
}))

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(() => true),
}))

vi.mock("@/components/layout/ProviderLayout", () => ({
  ProviderLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/loading/GenericListSkeleton", () => ({
  GenericListSkeleton: () => <div>skeleton</div>,
}))

vi.mock("@/lib/geo/distance", () => ({
  calculateDistance: vi.fn(() => 0),
}))

import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import ProviderGroupBookingsPage from "./page"

describe("ProviderGroupBookingsPage offline", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders OfflineNotAvailable when offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    render(<ProviderGroupBookingsPage />)

    expect(screen.getByTestId("offline-not-available")).toBeInTheDocument()
  })
})
