import useSWR from "swr"
import { AvailabilityDay } from "@/types"

/**
 * SWR hook for a provider's availability schedule.
 * Fills in missing days with sensible defaults (09:00-17:00, open).
 */
export function useAvailabilitySchedule(providerId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<AvailabilityDay[]>(
    providerId ? `/api/providers/${providerId}/availability-schedule` : null
  )

  // Build complete 7-day schedule, filling in defaults for missing days
  const availability: AvailabilityDay[] = data
    ? Array.from({ length: 7 }, (_, dayOfWeek) => {
        const existing = data.find((item) => item.dayOfWeek === dayOfWeek)
        if (existing) {
          return {
            dayOfWeek: existing.dayOfWeek,
            startTime: existing.startTime,
            endTime: existing.endTime,
            isClosed: existing.isClosed,
          }
        }
        return {
          dayOfWeek,
          startTime: "09:00",
          endTime: "17:00",
          isClosed: false,
        }
      })
    : []

  return { availability, error, isLoading, mutate }
}
