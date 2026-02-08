import { renderHook, act } from "@testing-library/react"
import { useBookingFlow, type SelectedService } from "./useBookingFlow"

// Mock next/navigation
const mockPush = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

// Mock sonner
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}))

const testService: SelectedService = {
  id: "svc-1",
  name: "Hovvård",
  price: 500,
  durationMinutes: 60,
}

const defaultOptions = {
  providerId: "prov-1",
  providerAddress: "Testvägen 1",
  providerCity: "Göteborg",
  providerBusinessName: "Test Hovslagare",
}

describe("useBookingFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it("starts closed with no service selected", () => {
    const { result } = renderHook(() => useBookingFlow(defaultOptions))
    expect(result.current.isOpen).toBe(false)
    expect(result.current.selectedService).toBeNull()
    expect(result.current.step).toBe("selectType")
  })

  it("opens with selected service and resets form", () => {
    const { result } = renderHook(() => useBookingFlow(defaultOptions))

    act(() => {
      result.current.openBooking(testService)
    })

    expect(result.current.isOpen).toBe(true)
    expect(result.current.selectedService).toEqual(testService)
    expect(result.current.bookingForm.bookingDate).toBe("")
    expect(result.current.bookingForm.startTime).toBe("")
    expect(result.current.isFlexibleBooking).toBe(false)
    expect(result.current.step).toBe("selectType")
  })

  it("closes the dialog", () => {
    const { result } = renderHook(() => useBookingFlow(defaultOptions))

    act(() => {
      result.current.openBooking(testService)
    })
    expect(result.current.isOpen).toBe(true)

    act(() => {
      result.current.close()
    })
    expect(result.current.isOpen).toBe(false)
  })

  it("updates form when a slot is selected", () => {
    const { result } = renderHook(() => useBookingFlow(defaultOptions))

    act(() => {
      result.current.openBooking(testService)
    })

    act(() => {
      result.current.handleSlotSelect("2026-03-15", "10:00", "11:00")
    })

    expect(result.current.bookingForm.bookingDate).toBe("2026-03-15")
    expect(result.current.bookingForm.startTime).toBe("10:00")
  })

  it("canSubmit is false without date/time for fixed booking", () => {
    const { result } = renderHook(() => useBookingFlow(defaultOptions))

    act(() => {
      result.current.openBooking(testService)
    })

    expect(result.current.canSubmit).toBe(false)
  })

  it("canSubmit is true after selecting a slot", () => {
    const { result } = renderHook(() => useBookingFlow(defaultOptions))

    act(() => {
      result.current.openBooking(testService)
    })

    act(() => {
      result.current.handleSlotSelect("2026-03-15", "10:00", "11:00")
    })

    expect(result.current.canSubmit).toBe(true)
  })

  it("canSubmit is true for flexible booking (no time required)", () => {
    const { result } = renderHook(() => useBookingFlow(defaultOptions))

    act(() => {
      result.current.openBooking(testService)
      result.current.setIsFlexibleBooking(true)
    })

    expect(result.current.canSubmit).toBe(true)
  })

  it("submits fixed booking successfully", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: "booking-1" }),
    })
    global.fetch = mockFetch

    const { result } = renderHook(() => useBookingFlow(defaultOptions))

    act(() => {
      result.current.openBooking(testService)
    })

    act(() => {
      result.current.handleSlotSelect("2026-03-15", "10:00", "11:00")
    })

    await act(async () => {
      await result.current.handleSubmitBooking()
    })

    expect(mockFetch).toHaveBeenCalledWith("/api/bookings", expect.objectContaining({
      method: "POST",
    }))
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.providerId).toBe("prov-1")
    expect(body.serviceId).toBe("svc-1")
    expect(body.bookingDate).toBe("2026-03-15")
    expect(body.startTime).toBe("10:00")
    expect(body.endTime).toBe("11:00")

    expect(mockToastSuccess).toHaveBeenCalledWith("Bokningsförfrågan skickad!")
    expect(result.current.isOpen).toBe(false)
    expect(mockPush).toHaveBeenCalledWith("/customer/bookings")
  })

  it("submits flexible booking successfully", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: "order-1" }),
    })
    global.fetch = mockFetch

    const { result } = renderHook(() => useBookingFlow(defaultOptions))

    act(() => {
      result.current.openBooking(testService)
      result.current.setIsFlexibleBooking(true)
    })

    await act(async () => {
      await result.current.handleSubmitBooking()
    })

    expect(mockFetch).toHaveBeenCalledWith("/api/route-orders", expect.objectContaining({
      method: "POST",
    }))
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.serviceType).toBe("Hovvård")
    expect(body.address).toBe("Testvägen 1")

    expect(mockToastSuccess).toHaveBeenCalled()
    expect(result.current.isOpen).toBe(false)
    expect(mockPush).toHaveBeenCalledWith("/customer/bookings")
  })

  it("shows error toast when no time selected for fixed booking", async () => {
    const { result } = renderHook(() => useBookingFlow(defaultOptions))

    act(() => {
      result.current.openBooking(testService)
    })

    await act(async () => {
      await result.current.handleSubmitBooking()
    })

    expect(mockToastError).toHaveBeenCalledWith("Du måste välja en tid i kalendern")
  })

  it("handles 409 conflict by staying open", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: "Tiden är redan bokad" }),
    })
    global.fetch = mockFetch

    const { result } = renderHook(() => useBookingFlow(defaultOptions))

    act(() => {
      result.current.openBooking(testService)
    })

    act(() => {
      result.current.handleSlotSelect("2026-03-15", "10:00", "11:00")
    })

    await act(async () => {
      await result.current.handleSubmitBooking()
    })

    expect(mockToastError).toHaveBeenCalledWith("Tiden är redan bokad")
    expect(result.current.isOpen).toBe(true)
    expect(result.current.step).toBe("selectTime")
  })

  it("handles server error gracefully", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Server error" }),
    })
    global.fetch = mockFetch

    const { result } = renderHook(() => useBookingFlow(defaultOptions))

    act(() => {
      result.current.openBooking(testService)
    })

    act(() => {
      result.current.handleSlotSelect("2026-03-15", "10:00", "11:00")
    })

    await act(async () => {
      await result.current.handleSubmitBooking()
    })

    expect(mockToastError).toHaveBeenCalledWith("Server error")
    expect(result.current.step).toBe("selectHorse")
  })
})
