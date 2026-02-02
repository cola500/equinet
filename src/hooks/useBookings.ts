import useSWR from "swr"

/**
 * SWR hook for the current user's bookings (/api/bookings).
 * Returns the raw API response as a generic array -- pages cast
 * to their own Booking interface when they need extra fields.
 */
export function useBookings() {
  const { data, error, isLoading, mutate } = useSWR<Record<string, unknown>[]>("/api/bookings")
  return {
    bookings: data ?? [],
    error,
    isLoading,
    mutate,
  }
}
