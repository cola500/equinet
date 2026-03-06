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

vi.mock("@/components/loading/InsightsChartSkeleton", () => ({
  InsightsChartSkeleton: () => <div>skeleton</div>,
}))

vi.mock("@/components/provider/InsightsCharts", () => ({
  InsightsCharts: () => <div>charts</div>,
}))

vi.mock("@/components/ui/error-state", () => ({
  ErrorState: () => <div>error</div>,
}))

vi.mock("@/hooks/useRetry", () => ({
  useRetry: () => ({ retry: vi.fn(), retryCount: 0, isRetrying: false, canRetry: true }),
}))

import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import ProviderInsightsPage from "./page"

describe("ProviderInsightsPage offline", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders OfflineNotAvailable when offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    render(<ProviderInsightsPage />)

    expect(screen.getByTestId("offline-not-available")).toBeInTheDocument()
    expect(screen.getByText("Ej tillgänglig offline")).toBeInTheDocument()
  })
})
