import useSWR from "swr"
import type { DueForServiceResult } from "@/domain/due-for-service/DueForServiceCalculator"

interface DueForServiceResponse {
  items: DueForServiceResult[]
}

export function useDueForService() {
  const { data, error, isLoading } = useSWR<DueForServiceResponse>("/api/customer/due-for-service")

  return {
    items: data?.items ?? [],
    error,
    isLoading,
  }
}
