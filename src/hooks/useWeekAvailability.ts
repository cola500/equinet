"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format, addDays, startOfWeek } from "date-fns"

export interface BookedSlot {
  startTime: string
  endTime: string
  serviceName: string
}

export interface SlotWithReason {
  startTime: string
  endTime: string
  isAvailable: boolean
  unavailableReason?: "booked" | "travel-time" | "past"
}

export interface DayAvailability {
  date: string // YYYY-MM-DD
  dayOfWeek: number
  isClosed: boolean
  openingTime: string | null
  closingTime: string | null
  bookedSlots: BookedSlot[]
  slots?: SlotWithReason[] // New: pre-calculated slots from API
}

export interface CustomerLocation {
  latitude: number
  longitude: number
}

interface UseWeekAvailabilityOptions {
  customerLocation?: CustomerLocation
  serviceDurationMinutes?: number
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
 * @param options - Optional: customerLocation and serviceDurationMinutes for travel time calculation
 * @returns Week availability data with loading/error states
 */
export function useWeekAvailability(
  providerId: string,
  weekStart: Date,
  options?: UseWeekAvailabilityOptions
): UseWeekAvailabilityResult {
  const [weekData, setWeekData] = useState<DayAvailability[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Normalize date to string to prevent infinite loops from Date object references
  const weekStartStr = useMemo(() => {
    const monday = startOfWeek(weekStart, { weekStartsOn: 1 })
    return format(monday, "yyyy-MM-dd")
  }, [weekStart])

  // Memoize options to prevent unnecessary refetches
  const customerLat = options?.customerLocation?.latitude
  const customerLng = options?.customerLocation?.longitude
  const serviceDuration = options?.serviceDurationMinutes

  const fetchWeekAvailability = useCallback(async () => {
    if (!providerId) {
      setWeekData([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Parse the normalized Monday date
      const monday = new Date(weekStartStr)

      // Build query params
      const buildUrl = (dateStr: string) => {
        const params = new URLSearchParams({ date: dateStr })

        if (customerLat !== undefined && customerLng !== undefined) {
          params.set("lat", customerLat.toString())
          params.set("lng", customerLng.toString())
        }

        if (serviceDuration !== undefined) {
          params.set("serviceDuration", serviceDuration.toString())
        }

        return `/api/providers/${providerId}/availability?${params.toString()}`
      }

      // Fetch all 7 days in parallel
      const promises = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(monday, i)
        const dateStr = format(date, "yyyy-MM-dd")
        return fetch(buildUrl(dateStr))
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
  }, [providerId, weekStartStr, customerLat, customerLng, serviceDuration])

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
