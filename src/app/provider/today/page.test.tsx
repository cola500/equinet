import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(() => true),
}))

vi.mock("@/components/layout/ProviderLayout", () => ({
  ProviderLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => () => <div data-testid="route-map">map</div>,
}))

vi.mock("swr", () => ({
  __esModule: true,
  default: vi.fn(),
}))

import useSWR from "swr"
import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import TodayRoutePage from "./page"

const mockSWR = (data: unknown, opts: { isLoading?: boolean; error?: unknown } = {}) => {
  vi.mocked(useSWR).mockReturnValue({
    data,
    error: opts.error,
    isLoading: opts.isLoading ?? false,
    mutate: vi.fn(),
    isValidating: false,
  } as never)
}

const sampleResponse = {
  date: "2026-06-07",
  startLocation: { lat: 57.71, lon: 11.98 },
  stops: [
    {
      id: "b1",
      startTime: "08:00",
      endTime: "09:00",
      serviceType: "Hovslagning",
      address: "Storgatan 1, Alingsås",
      latitude: 57.7,
      longitude: 11.97,
      customer: { firstName: "Anna", lastName: "Svensson" },
    },
    {
      id: "b2",
      startTime: "11:00",
      endTime: "12:00",
      serviceType: "Tandvård",
      address: "Ekvägen 4, Vårgårda",
      latitude: 57.8,
      longitude: 12.1,
      customer: { firstName: "Erik", lastName: "Berg" },
    },
  ],
}

describe("TodayRoutePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOnlineStatus).mockReturnValue(true)
  })

  it("renders the page title", () => {
    mockSWR(sampleResponse)
    render(<TodayRoutePage />)
    expect(screen.getByRole("heading", { name: "Dagens rutt" })).toBeInTheDocument()
  })

  it("renders each stop with customer name, time, address and service", () => {
    mockSWR(sampleResponse)
    render(<TodayRoutePage />)

    expect(screen.getByText("Anna Svensson")).toBeInTheDocument()
    expect(screen.getByText("Erik Berg")).toBeInTheDocument()
    expect(screen.getByText("08:00–09:00")).toBeInTheDocument()
    expect(screen.getByText("Storgatan 1, Alingsås")).toBeInTheDocument()
    expect(screen.getByText("Tandvård")).toBeInTheDocument()
  })

  it("renders the map when there are stops", () => {
    mockSWR(sampleResponse)
    render(<TodayRoutePage />)
    expect(screen.getByTestId("route-map")).toBeInTheDocument()
  })

  it("shows the stop count summary", () => {
    mockSWR(sampleResponse)
    render(<TodayRoutePage />)
    expect(screen.getByText(/2 stopp/)).toBeInTheDocument()
  })

  it("shows an empty state when there are no stops", () => {
    mockSWR({ date: "2026-06-07", startLocation: null, stops: [] })
    render(<TodayRoutePage />)
    expect(screen.getByText(/Inga bokningar/i)).toBeInTheDocument()
  })

  it("renders an offline state when offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    mockSWR(undefined)
    render(<TodayRoutePage />)
    expect(screen.getByTestId("offline-not-available")).toBeInTheDocument()
  })
})
