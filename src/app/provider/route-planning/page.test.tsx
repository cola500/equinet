import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

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
  useRouteOrders: vi.fn(() => ({ orders: [], error: null, isLoading: false })),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => () => <div>map</div>,
}))

vi.mock("@/lib/route-optimizer", () => ({
  optimizeRoute: vi.fn(),
  MAX_OPTIMIZE_ORDERS: 100,
}))

vi.mock("@/lib/routing", () => ({
  getRoute: vi.fn(),
}))

import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useRouteOrders } from "@/hooks/useRouteOrders"
import { optimizeRoute } from "@/lib/route-optimizer"
import { getRoute } from "@/lib/routing"
import { toast } from "sonner"
import RoutePlanningPage from "./page"

function makeOrder(id: string, coords: { latitude: number | null; longitude: number | null }) {
  return {
    id,
    serviceType: "Verkning",
    address: `Gatan ${id}, Örebro`,
    priority: "normal",
    numberOfHorses: 1,
    dateFrom: "2026-11-03T00:00:00.000Z",
    dateTo: "2026-11-14T00:00:00.000Z",
    specialInstructions: null,
    ...coords,
  }
}

function renderWithOrders(orders: ReturnType<typeof makeOrder>[]) {
  vi.mocked(useRouteOrders).mockReturnValue({ orders, error: null, isLoading: false } as never)
  render(<RoutePlanningPage />)
  fireEvent.click(screen.getByRole("button", { name: "Välj alla" }))
  fireEvent.click(screen.getAllByRole("button", { name: /Optimera rutt/ })[0])
}

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

describe("RoutePlanningPage optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOnlineStatus).mockReturnValue(true)
  })

  it("explains that positions are needed when fewer than 2 selected orders have one", () => {
    renderWithOrders([
      makeOrder("a", { latitude: 59.27, longitude: 15.21 }),
      makeOrder("b", { latitude: null, longitude: null }),
    ])

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("adress med position"))
    expect(optimizeRoute).not.toHaveBeenCalled()
  })

  it("stops before calling the API when more orders are selected than allowed", () => {
    const orders = Array.from({ length: 101 }, (_, i) =>
      makeOrder(`o${i}`, { latitude: 59 + i / 1000, longitude: 15 }),
    )

    renderWithOrders(orders)

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("högst 100"))
    expect(optimizeRoute).not.toHaveBeenCalled()
  })

  it("never shows NaN when the road distance is zero", async () => {
    vi.mocked(optimizeRoute).mockResolvedValue({
      route: [1, 0], num_stops: 2, total_distance_km: 0, baseline_distance_km: 0, improvement_percent: 0,
    })
    vi.mocked(getRoute).mockResolvedValue({ coordinates: [], distance: 0, duration: 0 })

    renderWithOrders([
      makeOrder("a", { latitude: 59.27, longitude: 15.21 }),
      makeOrder("b", { latitude: 59.27, longitude: 15.21 }),
    ])

    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(String(vi.mocked(toast.success).mock.calls[0][0])).not.toContain("NaN")
  })
})
