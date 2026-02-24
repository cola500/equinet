export interface ProviderProfile {
  id: string
  businessName: string
  description?: string
  address?: string
  city?: string
  postalCode?: string
  serviceArea?: string
  latitude?: number | null
  longitude?: number | null
  serviceAreaKm?: number | null
  profileImageUrl?: string | null
  acceptingNewCustomers: boolean
  rescheduleEnabled: boolean
  rescheduleWindowHours: number
  maxReschedules: number
  rescheduleRequiresApproval: boolean
  recurringEnabled: boolean
  maxSeriesOccurrences: number
  user: {
    firstName: string
    lastName: string
    email: string
    phone?: string
  }
}
