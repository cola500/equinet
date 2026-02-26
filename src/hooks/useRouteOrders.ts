import useSWR from "swr"

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

  const { data, error, isLoading, mutate } = useSWR<Record<string, unknown>[]>(key)

  return {
    orders: (data ?? []) as any[],
    error,
    isLoading,
    mutate,
  }
}
