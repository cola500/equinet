import useSWR from "swr"
import { useFeatureFlag } from "@/components/providers/FeatureFlagProvider"
import type { DueForServiceResult } from "@/domain/due-for-service/DueForServiceCalculator"

interface DueForServiceResponse {
  items: DueForServiceResult[]
}

/**
 * SWR hook for customer due-for-service status.
 * Only fetches when the due_for_service feature flag is enabled.
 */
export function useDueForService() {
  const enabled = useFeatureFlag("due_for_service")

  const { data, error, isLoading } = useSWR<DueForServiceResponse>(
    enabled ? "/api/customer/due-for-service" : null
  )

  return {
    items: data?.items ?? [],
    error,
    isLoading: enabled ? isLoading : false,
  }
}
