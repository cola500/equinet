import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock next/navigation
const mockReplace = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/provider/calendar",
}))

// Mock auth
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isLoading: false, isProvider: true }),
}))

// Mock media query
vi.mock("@/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
}))

// Mock bookings
const mockBooking = {
  id: "booking-1",
  status: "confirmed",
  bookingDate: new Date().toISOString(),
  startTime: "10:00",
  endTime: "11:00",
  serviceName: "Hovvård",
  customerName: "Test Kund",
}
vi.mock("@/hooks/useBookings", () => ({
  useBookings: () => ({ bookings: [mockBooking], mutate: vi.fn() }),
}))

// Mock services
vi.mock("@/hooks/useServices", () => ({
  useServices: () => ({ services: [], isLoading: false }),
}))

// Mock provider profile
vi.mock("@/hooks/useProviderProfile", () => ({
  useProviderProfile: () => ({ providerId: "provider-1" }),
}))

// Mock feature flags
vi.mock("@/components/providers/FeatureFlagProvider", () => ({
  useFeatureFlag: () => false,
}))

// Mock offline guard (mutable per test)
const mockGuardMutation = vi.fn((fn: () => unknown) => fn())
let mockIsOnline = true
vi.mock("@/hooks/useOfflineGuard", () => ({
  useOfflineGuard: () => ({ isOnline: mockIsOnline, guardMutation: mockGuardMutation }),
}))

// Mock fetch for availability/exceptions
const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
global.fetch = mockFetch

// Mock calendar sub-components to simplify rendering
vi.mock("@/components/layout/ProviderLayout", () => ({
  ProviderLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/calendar/CalendarHeader", () => ({
  CalendarHeader: () => null,
}))

vi.mock("@/components/calendar/WeekCalendar", () => ({
  WeekCalendar: ({ onBookingClick, bookings }: { onBookingClick: (b: unknown) => void; bookings: unknown[] }) => (
    <button data-testid="booking-click" onClick={() => onBookingClick(bookings?.[0] || { id: "booking-1" })}>
      Klicka bokning
    </button>
  ),
}))

vi.mock("@/components/calendar/MonthCalendar", () => ({
  MonthCalendar: () => null,
}))

// Track onOpenChange calls to verify dialog close behavior
const mockOnOpenChange = vi.fn()
vi.mock("@/components/calendar/BookingDetailDialog", () => ({
  BookingDetailDialog: ({ onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
    // Expose onOpenChange so tests can simulate dialog close
    mockOnOpenChange.mockImplementation(onOpenChange)
    return <div data-testid="booking-dialog" />
  },
}))

vi.mock("@/components/calendar/AvailabilityEditDialog", () => ({
  AvailabilityEditDialog: () => null,
}))

vi.mock("@/components/calendar/DayExceptionDialog", () => ({
  DayExceptionDialog: () => null,
}))

vi.mock("@/components/calendar/ManualBookingDialog", () => ({
  ManualBookingDialog: () => null,
}))

vi.mock("@/components/calendar/PendingBookingsBanner", () => ({
  PendingBookingsBanner: () => null,
}))

import { act } from "react"
import ProviderCalendarPage from "./page"

describe("ProviderCalendarPage - offline booking dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsOnline = true
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] })
  })

  it("skips router.replace on booking click when offline", async () => {
    mockIsOnline = false
    const user = userEvent.setup()

    render(<ProviderCalendarPage />)

    await user.click(screen.getByTestId("booking-click"))

    // router.replace should NOT be called when offline
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("skips router.replace on dialog close when offline", async () => {
    mockIsOnline = false
    const user = userEvent.setup()

    render(<ProviderCalendarPage />)

    // Open dialog first
    await user.click(screen.getByTestId("booking-click"))

    // Simulate dialog close via onOpenChange(false)
    act(() => {
      mockOnOpenChange(false)
    })

    // router.replace should NOT be called when offline
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("calls router.replace on booking click when online", async () => {
    mockIsOnline = true
    const user = userEvent.setup()

    render(<ProviderCalendarPage />)

    await user.click(screen.getByTestId("booking-click"))

    // router.replace SHOULD be called when online
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("bookingId=booking-1"),
      { scroll: false }
    )
  })

  it("calls router.replace on dialog close when online", async () => {
    mockIsOnline = true
    const user = userEvent.setup()

    render(<ProviderCalendarPage />)

    // Open dialog first
    await user.click(screen.getByTestId("booking-click"))
    mockReplace.mockClear()

    // Simulate dialog close via onOpenChange(false)
    act(() => {
      mockOnOpenChange(false)
    })

    // router.replace SHOULD be called when online (URL cleanup)
    expect(mockReplace).toHaveBeenCalledWith(
      "/provider/calendar",
      { scroll: false }
    )
  })
})
