"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format, addDays, startOfWeek } from "date-fns"

export interface BookedSlot {
  startTime: string
  endTime: string
  serviceName: string
}

export interface DayAvailability {
  date: string // YYYY-MM-DD
  dayOfWeek: number
  isClosed: boolean
  openingTime: string | null
  closingTime: string | null
  bookedSlots: BookedSlot[]
}

interface UseWeekAvailabilityResult {
  weekData: DayAvailability[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Hook to fetch 7 days of availability for a provider
 *
 * @param providerId - The provider's ID
 * @param weekStart - The start date of the week (any date, will normalize to Monday)
 * @returns Week availability data with loading/error states
 */
export function useWeekAvailability(
  providerId: string,
  weekStart: Date
): UseWeekAvailabilityResult {
  const [weekData, setWeekData] = useState<DayAvailability[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Normalize date to string to prevent infinite loops from Date object references
  const weekStartStr = useMemo(() => {
    const monday = startOfWeek(weekStart, { weekStartsOn: 1 })
    return format(monday, "yyyy-MM-dd")
  }, [weekStart])

  const fetchWeekAvailability = useCallback(async () => {
    if (!providerId) {
      setWeekData([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Parse the normalized Monday date
      const monday = new Date(weekStartStr)

      // Fetch all 7 days in parallel
      const promises = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(monday, i)
        const dateStr = format(date, "yyyy-MM-dd")
        return fetch(
          `/api/providers/${providerId}/availability?date=${dateStr}`
        )
      })

      const responses = await Promise.all(promises)

      // Check for any failed responses
      const failedResponse = responses.find((r) => !r.ok)
      if (failedResponse) {
        throw new Error(`API returned ${failedResponse.status}`)
      }

      // Parse all responses
      const data = await Promise.all(responses.map((r) => r.json()))
      setWeekData(data)
    } catch (err) {
      console.error("Error fetching week availability:", err)
      setError("Kunde inte hämta tillgänglighet")
      setWeekData([])
    } finally {
      setIsLoading(false)
    }
  }, [providerId, weekStartStr])

  useEffect(() => {
    fetchWeekAvailability()
  }, [fetchWeekAvailability])

  return {
    weekData,
    isLoading,
    error,
    refetch: fetchWeekAvailability,
  }
}
