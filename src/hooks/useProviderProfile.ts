import useSWR from "swr"

interface ProviderProfileData {
  id: string
  businessName: string
  description?: string | null
  address?: string | null
  city?: string | null
  postalCode?: string | null
  serviceArea?: string | null
  latitude?: number | null
  longitude?: number | null
  serviceAreaKm?: number | null
  profileImageUrl?: string | null
  isVerified?: boolean
  rescheduleEnabled?: boolean
  rescheduleWindowHours?: number
  maxReschedules?: number
  rescheduleRequiresApproval?: boolean
  user: {
    firstName: string
    lastName: string
    email: string
    phone?: string | null
  }
}

/**
 * SWR hook for the provider profile (/api/provider/profile).
 * Used by calendar, profile, dashboard, reviews, etc.
 */
export function useProviderProfile() {
  const { data, error, isLoading, mutate } = useSWR<ProviderProfileData>("/api/provider/profile")
  return {
    profile: data ?? null,
    providerId: data?.id ?? null,
    error,
    isLoading,
    mutate,
  }
}
