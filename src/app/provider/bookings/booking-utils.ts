/**
 * Utility functions for provider booking list:
 * sorting (pending first) and filtering.
 */

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled"

export type BookingFilter = "all" | BookingStatus

export interface BookingSortable {
  status: string
  bookingDate: string
}

/**
 * Sorts bookings with pending first, then by date descending.
 * In non-"all" views, only sorts by date descending.
 */
export function sortBookings<T extends BookingSortable>(
  bookings: T[],
  filter: BookingFilter
): T[] {
  return [...bookings].sort((a, b) => {
    // In "all" view: pending bookings come first
    if (filter === "all") {
      const aIsPending = a.status === "pending" ? 0 : 1
      const bIsPending = b.status === "pending" ? 0 : 1
      if (aIsPending !== bIsPending) return aIsPending - bIsPending
    }

    // Within same group: newest booking date first
    return new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime()
  })
}

/**
 * Filters bookings by status.
 * "all" returns everything except cancelled.
 */
export function filterBookings<T extends BookingSortable>(
  bookings: T[],
  filter: BookingFilter
): T[] {
  if (filter === "all") {
    return bookings.filter((b) => b.status !== "cancelled")
  }
  return bookings.filter((b) => b.status === filter)
}

/**
 * Counts bookings per status.
 */
export function countByStatus<T extends BookingSortable>(
  bookings: T[]
): Record<BookingFilter, number> {
  const counts = { all: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 }
  for (const b of bookings) {
    const status = b.status as BookingStatus
    if (status in counts) {
      counts[status]++
    }
    if (status !== "cancelled") {
      counts.all++
    }
  }
  return counts
}
