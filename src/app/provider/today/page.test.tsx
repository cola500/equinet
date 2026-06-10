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

vi.mock("@/lib/routing", () => ({
  getRoute: vi.fn(),
}))

import useSWR from "swr"
import { getRoute } from "@/lib/routing"
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
      address: "Storgatan 1",
      city: "Alingsås",
      latitude: 57.7,
      longitude: 11.97,
      customer: { firstName: "Anna", lastName: "Svensson" },
    },
    {
      id: "b2",
      startTime: "11:00",
      endTime: "12:00",
      serviceType: "Tandvård",
      address: "Ekvägen 4",
      city: "Vårgårda",
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
    // Default: routing never resolves -> page stays on the Haversine estimate.
    // Routing-specific tests override this per case.
    vi.mocked(getRoute).mockReturnValue(new Promise(() => {}))
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
    // Full address = street + city joined
    expect(screen.getByText("Storgatan 1, Alingsås")).toBeInTheDocument()
    expect(screen.getByText("Tandvård")).toBeInTheDocument()
  })

  it("renders a navigation link per stop using coordinates, opening in a new tab", () => {
    mockSWR(sampleResponse)
    render(<TodayRoutePage />)

    const links = screen.getAllByRole("link", { name: /navigera/i })
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=57.7%2C11.97"
    )
    expect(links[0]).toHaveAttribute("target", "_blank")
    expect(links[0]).toHaveAttribute("rel", expect.stringContaining("noopener"))
  })

  it("falls back to the address for the navigation link when coordinates are missing", () => {
    mockSWR({
      date: "2026-06-07",
      startLocation: { lat: 57.71, lon: 11.98 },
      stops: [
        {
          id: "b3",
          startTime: "09:00",
          endTime: "10:00",
          serviceType: "Verkning",
          address: "Hagvägen 8",
          city: "Örebro",
          latitude: null,
          longitude: null,
          customer: { firstName: "Karin", lastName: "Lind" },
        },
      ],
    })
    render(<TodayRoutePage />)

    const link = screen.getByRole("link", { name: /navigera/i })
    expect(link).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=Hagv%C3%A4gen%208%2C%20%C3%96rebro"
    )
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

  it("uses the real driving distance when routing is available", async () => {
    // 54 km / 75 min driving route
    vi.mocked(getRoute).mockResolvedValue({
      coordinates: [],
      distance: 54000,
      duration: 4500,
    })
    mockSWR(sampleResponse)
    render(<TodayRoutePage />)

    expect(await screen.findByText(/Körsträcka:/)).toBeInTheDocument()
    expect(screen.getByText(/54 km/)).toBeInTheDocument()
    expect(screen.getByText(/75 min/)).toBeInTheDocument()
    // The driving label must NOT be the fågelväg estimate
    expect(screen.queryByText(/fågelväg/)).not.toBeInTheDocument()
  })

  it("falls back to the estimated distance when routing fails", async () => {
    vi.mocked(getRoute).mockRejectedValue(new Error("OSRM down"))
    mockSWR(sampleResponse)
    render(<TodayRoutePage />)

    expect(await screen.findByText(/Uppskattad sträcka/)).toBeInTheDocument()
    expect(screen.getByText(/fågelväg/)).toBeInTheDocument()
    expect(screen.queryByText(/Körsträcka:/)).not.toBeInTheDocument()
  })

  it("calls routing with start + stops + return to start in order", async () => {
    vi.mocked(getRoute).mockResolvedValue({ coordinates: [], distance: 1000, duration: 600 })
    mockSWR(sampleResponse)
    render(<TodayRoutePage />)

    await screen.findByText(/Körsträcka:/)
    const path = vi.mocked(getRoute).mock.calls[0][0]
    // [start, stop1, stop2, start] -> round trip from provider position
    expect(path[0]).toEqual([57.71, 11.98])
    expect(path[1]).toEqual([57.7, 11.97])
    expect(path[2]).toEqual([57.8, 12.1])
    expect(path[path.length - 1]).toEqual([57.71, 11.98])
  })
})
