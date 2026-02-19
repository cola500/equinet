import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { CustomerBookingCalendar } from "./CustomerBookingCalendar"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("CustomerBookingCalendar", () => {
  // Dynamically calculate a Monday that is always in the future
  // so that slots like 09:00 are never filtered out as "past"
  const getNextMonday = () => {
    const d = new Date()
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7))
    return d.toISOString().slice(0, 10)
  }
  const FUTURE_MONDAY = getNextMonday()

  beforeEach(() => {
    mockFetch.mockReset()
  })

  const mockAvailabilityResponse = (date: string, isClosed = false) => ({
    date,
    isClosed,
    openingTime: isClosed ? null : "09:00",
    closingTime: isClosed ? null : "17:00",
    bookedSlots: [],
  })

  it("renders week navigation header", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAvailabilityResponse(FUTURE_MONDAY)),
    })

    render(
      <CustomerBookingCalendar
        providerId="provider-1"
        serviceDurationMinutes={30}
        onSlotSelect={() => {}}
        initialDate={new Date(FUTURE_MONDAY)}
      />
    )

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText(/laddar/i)).not.toBeInTheDocument()
    })

    // Should show week navigation
    expect(screen.getByText(/vecka/i)).toBeInTheDocument()
    expect(screen.getByText(/föregående/i)).toBeInTheDocument()
    expect(screen.getByText(/nästa/i)).toBeInTheDocument()
  })

  it("shows loading state while fetching", () => {
    mockFetch.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    render(
      <CustomerBookingCalendar
        providerId="provider-1"
        serviceDurationMinutes={30}
        onSlotSelect={() => {}}
      />
    )

    expect(screen.getByText(/laddar/i)).toBeInTheDocument()
  })

  it("renders 7 day columns when data is loaded", async () => {
    mockFetch.mockImplementation((url: string) => {
      const date = url.match(/date=(\d{4}-\d{2}-\d{2})/)?.[1] || FUTURE_MONDAY
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockAvailabilityResponse(date)),
      })
    })

    render(
      <CustomerBookingCalendar
        providerId="provider-1"
        serviceDurationMinutes={30}
        onSlotSelect={() => {}}
        initialDate={new Date(FUTURE_MONDAY)}
      />
    )

    await waitFor(() => {
      expect(screen.queryByText(/laddar/i)).not.toBeInTheDocument()
    })

    // Should show day names for a week (checking getAllByText since mobile view also shows them)
    const dayNames = ["mån", "tis", "ons", "tor", "fre", "lör", "sön"]
    dayNames.forEach((day) => {
      expect(screen.getAllByText(new RegExp(day, "i")).length).toBeGreaterThan(0)
    })
  })

  it("calls onSlotSelect when clicking a slot", async () => {
    mockFetch.mockImplementation((url: string) => {
      const date = url.match(/date=(\d{4}-\d{2}-\d{2})/)?.[1] || FUTURE_MONDAY
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockAvailabilityResponse(date)),
      })
    })

    const onSlotSelect = vi.fn()
    render(
      <CustomerBookingCalendar
        providerId="provider-1"
        serviceDurationMinutes={30}
        onSlotSelect={onSlotSelect}
        initialDate={new Date(FUTURE_MONDAY)}
      />
    )

    await waitFor(() => {
      expect(screen.queryByText(/laddar/i)).not.toBeInTheDocument()
    })

    // Click on first available slot (09:00)
    const slotButtons = screen.getAllByText("09:00")
    fireEvent.click(slotButtons[0])

    expect(onSlotSelect).toHaveBeenCalledWith(
      expect.any(String), // date
      "09:00", // startTime
      "09:30" // endTime (30 min duration)
    )
  })

  it("navigates to next week when clicking Nästa", async () => {
    mockFetch.mockImplementation((url: string) => {
      const date = url.match(/date=(\d{4}-\d{2}-\d{2})/)?.[1] || FUTURE_MONDAY
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockAvailabilityResponse(date)),
      })
    })

    render(
      <CustomerBookingCalendar
        providerId="provider-1"
        serviceDurationMinutes={30}
        onSlotSelect={() => {}}
        initialDate={new Date(FUTURE_MONDAY)}
      />
    )

    await waitFor(() => {
      expect(screen.queryByText(/laddar/i)).not.toBeInTheDocument()
    })

    const initialCallCount = mockFetch.mock.calls.length

    fireEvent.click(screen.getByText(/nästa/i))

    await waitFor(() => {
      // Should have fetched another 7 days
      expect(mockFetch.mock.calls.length).toBe(initialCallCount + 7)
    })
  })

  it("shows error message when fetch fails", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"))

    render(
      <CustomerBookingCalendar
        providerId="provider-1"
        serviceDurationMinutes={30}
        onSlotSelect={() => {}}
      />
    )

    await waitFor(() => {
      expect(
        screen.getByText(/kunde inte hämta tillgänglighet/i)
      ).toBeInTheDocument()
    })
  })

  describe("dateRange prop", () => {
    it("marks days outside dateRange as closed", async () => {
      // The range: FUTURE_MONDAY to FUTURE_MONDAY+2 (3 days)
      const dateFrom = FUTURE_MONDAY
      const dateParts = dateFrom.split("-").map(Number)
      const dateToObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2] + 2)
      const dateTo = dateToObj.toISOString().slice(0, 10)

      mockFetch.mockImplementation((url: string) => {
        const date = url.match(/date=(\d{4}-\d{2}-\d{2})/)?.[1] || FUTURE_MONDAY
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAvailabilityResponse(date)),
        })
      })

      render(
        <CustomerBookingCalendar
          providerId="provider-1"
          serviceDurationMinutes={30}
          onSlotSelect={() => {}}
          initialDate={new Date(FUTURE_MONDAY)}
          dateRange={{ from: dateFrom, to: dateTo }}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText(/laddar/i)).not.toBeInTheDocument()
      })

      // Days outside range should show "Stängt" or "Ej i ditt område"
      // At least some days should be outside (4 of 7 days are outside range)
      const closedTexts = screen.getAllByText(/Stängt|Ej i ditt område/i)
      expect(closedTexts.length).toBeGreaterThanOrEqual(1)
    })

    it("does not restrict days when dateRange is not provided", async () => {
      mockFetch.mockImplementation((url: string) => {
        const date = url.match(/date=(\d{4}-\d{2}-\d{2})/)?.[1] || FUTURE_MONDAY
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAvailabilityResponse(date)),
        })
      })

      render(
        <CustomerBookingCalendar
          providerId="provider-1"
          serviceDurationMinutes={30}
          onSlotSelect={() => {}}
          initialDate={new Date(FUTURE_MONDAY)}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText(/laddar/i)).not.toBeInTheDocument()
      })

      // All 7 days should have slots (none should say "Stängt")
      expect(screen.queryByText("Stängt")).not.toBeInTheDocument()
    })

    it("shows info banner when dateRange is provided", async () => {
      mockFetch.mockImplementation((url: string) => {
        const date = url.match(/date=(\d{4}-\d{2}-\d{2})/)?.[1] || FUTURE_MONDAY
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAvailabilityResponse(date)),
        })
      })

      render(
        <CustomerBookingCalendar
          providerId="provider-1"
          serviceDurationMinutes={30}
          onSlotSelect={() => {}}
          initialDate={new Date(FUTURE_MONDAY)}
          dateRange={{ from: "2026-03-01", to: "2026-03-05" }}
        />
      )

      await waitFor(() => {
        expect(screen.queryByText(/laddar/i)).not.toBeInTheDocument()
      })

      expect(screen.getByText(/besöker ditt område/i)).toBeInTheDocument()
    })
  })

  it("shows closed days correctly", async () => {
    // Sunday of the same week as FUTURE_MONDAY (+6 days)
    const sundayDate = new Date(FUTURE_MONDAY)
    sundayDate.setDate(sundayDate.getDate() + 6)
    const FUTURE_SUNDAY = sundayDate.toISOString().slice(0, 10)
    mockFetch.mockImplementation((url: string) => {
      const date = url.match(/date=(\d{4}-\d{2}-\d{2})/)?.[1] || FUTURE_MONDAY
      // Make Sunday closed
      const isClosed = date === FUTURE_SUNDAY
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockAvailabilityResponse(date, isClosed)),
      })
    })

    render(
      <CustomerBookingCalendar
        providerId="provider-1"
        serviceDurationMinutes={30}
        onSlotSelect={() => {}}
        initialDate={new Date(FUTURE_MONDAY)}
      />
    )

    await waitFor(() => {
      expect(screen.queryByText(/laddar/i)).not.toBeInTheDocument()
    })

    expect(screen.getByText("Stängt")).toBeInTheDocument()
  })
})
