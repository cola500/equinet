import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ isLoading: false, isProvider: true })),
}))

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(() => true),
}))

vi.mock("@/components/providers/FeatureFlagProvider", () => ({
  useFeatureFlag: vi.fn(() => true),
}))

vi.mock("@/components/layout/ProviderLayout", () => ({
  ProviderLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/hooks/useRouteOrders", () => ({
  useRouteOrders: () => ({ orders: [], error: null, isLoading: false }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => () => <div>map</div>,
}))

vi.mock("@/lib/route-optimizer", () => ({
  optimizeRoute: vi.fn(),
}))

vi.mock("@/lib/routing", () => ({
  getRoute: vi.fn(),
}))

import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import RoutePlanningPage from "./page"

describe("RoutePlanningPage offline", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders OfflineNotAvailable when offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    render(<RoutePlanningPage />)

    expect(screen.getByTestId("offline-not-available")).toBeInTheDocument()
  })
})
