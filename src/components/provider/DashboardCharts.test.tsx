import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

// Mock recharts to avoid canvas issues in tests
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}))

import { DashboardCharts } from "./DashboardCharts"

const mockBookingTrend = [
  { week: "v.1", completed: 3, cancelled: 1 },
  { week: "v.2", completed: 5, cancelled: 0 },
  { week: "v.3", completed: 2, cancelled: 2 },
]

const mockRevenueTrend = [
  { month: "jan", revenue: 8000 },
  { month: "feb", revenue: 12500 },
  { month: "mar", revenue: 9800 },
]

describe("DashboardCharts", () => {
  it("should show loading skeleton when isLoading is true", () => {
    render(
      <DashboardCharts
        bookingTrend={[]}
        revenueTrend={[]}
        isLoading={true}
      />
    )

    const skeletons = screen.getAllByTestId("chart-skeleton")
    expect(skeletons).toHaveLength(2)
  })

  it("should render both chart cards when data is provided", () => {
    render(
      <DashboardCharts
        bookingTrend={mockBookingTrend}
        revenueTrend={mockRevenueTrend}
        isLoading={false}
      />
    )

    expect(screen.getByText("Bokningar per vecka")).toBeInTheDocument()
    expect(screen.getByText("Intäkter per månad")).toBeInTheDocument()
  })

  it("should render line chart for booking trend", () => {
    render(
      <DashboardCharts
        bookingTrend={mockBookingTrend}
        revenueTrend={mockRevenueTrend}
        isLoading={false}
      />
    )

    expect(screen.getByTestId("line-chart")).toBeInTheDocument()
  })

  it("should render bar chart for revenue trend", () => {
    render(
      <DashboardCharts
        bookingTrend={mockBookingTrend}
        revenueTrend={mockRevenueTrend}
        isLoading={false}
      />
    )

    expect(screen.getByTestId("bar-chart")).toBeInTheDocument()
  })

  it("should show chart descriptions", () => {
    render(
      <DashboardCharts
        bookingTrend={mockBookingTrend}
        revenueTrend={mockRevenueTrend}
        isLoading={false}
      />
    )

    expect(screen.getByText("Genomförda och avbokade, senaste 8 veckorna")).toBeInTheDocument()
    expect(screen.getByText("Totala intäkter, senaste 6 månaderna")).toBeInTheDocument()
  })
})
