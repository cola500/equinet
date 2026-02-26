import useSWR from "swr"

export interface RouteOrderData {
  id: string
  serviceType: string
  address: string
  latitude: number | null
  longitude: number | null
  numberOfHorses: number
  dateFrom: string
  dateTo: string
  priority: string
  status: string
  specialInstructions: string | null
  contactPhone: string | null
  announcementType: string | null
  createdAt: string
  customer: {
    firstName: string
    lastName: string
    phone: string | null
  } | null
  provider: {
    businessName: string
  } | null
  distanceKm: number | null
}

interface RouteOrderFilters {
  serviceType?: string
  priority?: string
}

/**
 * SWR hook for available route orders (/api/route-orders/available).
 * Automatically refetches when filters change.
 */
export function useRouteOrders(filters: RouteOrderFilters, enabled: boolean) {
  const params = new URLSearchParams()
  if (filters.serviceType && filters.serviceType !== "all")
    params.append("serviceType", filters.serviceType)
  if (filters.priority && filters.priority !== "all")
    params.append("priority", filters.priority)

  const query = params.toString()
  const key = enabled ? `/api/route-orders/available${query ? `?${query}` : ""}` : null

  const { data, error, isLoading, mutate } = useSWR<RouteOrderData[]>(key)

  return {
    orders: data ?? [],
    error,
    isLoading,
    mutate,
  }
}
