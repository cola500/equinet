import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { useWeekAvailability } from "./useWeekAvailability"

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe("useWeekAvailability", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("fetches availability for 7 days starting from given date", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          date: "2026-01-01",
          isClosed: false,
          openingTime: "09:00",
          closingTime: "17:00",
          bookedSlots: [],
        }),
    })

    const { result } = renderHook(() =>
      useWeekAvailability("provider-1", new Date("2026-01-05")) // Monday
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // Should have called fetch 7 times (Mon-Sun)
    expect(mockFetch).toHaveBeenCalledTimes(7)

    // Verify dates are correct (Mon-Sun)
    const calls = mockFetch.mock.calls
    expect(calls[0][0]).toContain("date=2026-01-05") // Monday
    expect(calls[6][0]).toContain("date=2026-01-11") // Sunday
  })

  it("returns availability data for each day", async () => {
    mockFetch.mockImplementation((url: string) => {
      const date = url.match(/date=(\d{4}-\d{2}-\d{2})/)?.[1]
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            date,
            isClosed: date === "2026-01-11", // Sunday closed
            openingTime: date === "2026-01-11" ? null : "09:00",
            closingTime: date === "2026-01-11" ? null : "17:00",
            bookedSlots: [],
          }),
      })
    })

    const { result } = renderHook(() =>
      useWeekAvailability("provider-1", new Date("2026-01-05"))
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.weekData).toHaveLength(7)
    expect(result.current.weekData[0].date).toBe("2026-01-05")
    expect(result.current.weekData[0].isClosed).toBe(false)
    expect(result.current.weekData[6].isClosed).toBe(true) // Sunday
  })

  it("handles fetch errors gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"))

    const { result } = renderHook(() =>
      useWeekAvailability("provider-1", new Date("2026-01-05"))
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).toBe("Kunde inte hämta tillgänglighet")
    expect(result.current.weekData).toEqual([])
  })

  it("handles API error response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    })

    const { result } = renderHook(() =>
      useWeekAvailability("provider-1", new Date("2026-01-05"))
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).toBe("Kunde inte hämta tillgänglighet")
  })

  it("refetches when weekStart changes", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          date: "2026-01-01",
          isClosed: false,
          openingTime: "09:00",
          closingTime: "17:00",
          bookedSlots: [],
        }),
    })

    const { result, rerender } = renderHook(
      ({ providerId, weekStart }) => useWeekAvailability(providerId, weekStart),
      {
        initialProps: {
          providerId: "provider-1",
          weekStart: new Date("2026-01-05"),
        },
      }
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(mockFetch).toHaveBeenCalledTimes(7)

    // Change week
    rerender({ providerId: "provider-1", weekStart: new Date("2026-01-12") })

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(14))
  })

  it("does not fetch when providerId is empty", async () => {
    const { result } = renderHook(() =>
      useWeekAvailability("", new Date("2026-01-05"))
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.weekData).toEqual([])
  })
})
