import { useState, useMemo } from "react"
import type { CombinedBooking } from "@/components/customer/bookings/types"

export type BookingFilter = "all" | "upcoming" | "past"

export function useBookingFilters(bookings: CombinedBooking[]) {
  const [filter, setFilter] = useState<BookingFilter>("upcoming")

  const filteredBookings = useMemo(() => {
    const now = new Date()

    return bookings.filter((booking) => {
      if (booking.type === "fixed") {
        const bookingDate = new Date(booking.bookingDate)
        if (filter === "upcoming") {
          return (
            bookingDate >= now &&
            (booking.status === "pending" || booking.status === "confirmed")
          )
        } else if (filter === "past") {
          return (
            bookingDate < now ||
            booking.status === "completed" ||
            booking.status === "cancelled"
          )
        }
      } else {
        // Flexible booking (RouteOrder)
        const dateTo = new Date(booking.dateTo)
        if (filter === "upcoming") {
          return (
            dateTo >= now &&
            (booking.status === "pending" || booking.status === "in_route")
          )
        } else if (filter === "past") {
          return (
            dateTo < now ||
            booking.status === "completed" ||
            booking.status === "cancelled"
          )
        }
      }
      return true // "all" filter
    })
  }, [bookings, filter])

  return { filter, setFilter, filteredBookings }
}
