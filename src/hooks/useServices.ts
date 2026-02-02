import useSWR from "swr"

interface ServiceData {
  id: string
  name: string
  description?: string | null
  price: number
  durationMinutes: number
  isActive: boolean
  recommendedIntervalWeeks?: number | null
}

/**
 * SWR hook for the current provider's services (/api/services).
 * Shared cache key means navigating between pages reuses cached data.
 */
export function useServices() {
  const { data, error, isLoading, mutate } = useSWR<ServiceData[]>("/api/services")
  return {
    services: data ?? [],
    error,
    isLoading,
    mutate,
  }
}
