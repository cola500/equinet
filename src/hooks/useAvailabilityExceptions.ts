import useSWR from "swr"
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } from "date-fns"
import { AvailabilityException } from "@/types"

/**
 * SWR hook for a provider's availability exceptions.
 * Fetches exceptions covering the full month range (including overflow weeks).
 * Automatically refetches when the currentDate changes.
 */
export function useAvailabilityExceptions(
  providerId: string | null,
  currentDate: Date
) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const rangeStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const rangeEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const from = format(rangeStart, "yyyy-MM-dd")
  const to = format(rangeEnd, "yyyy-MM-dd")

  const { data, error, isLoading, mutate } = useSWR<AvailabilityException[]>(
    providerId
      ? `/api/providers/${providerId}/availability-exceptions?from=${from}&to=${to}`
      : null
  )

  return {
    exceptions: data ?? [],
    error,
    isLoading,
    mutate,
  }
}
