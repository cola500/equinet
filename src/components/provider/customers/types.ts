export interface CustomerHorse {
  id: string
  name: string
  breed?: string | null
  birthYear?: number | null
  color?: string | null
  gender?: string | null
  specialNeeds?: string | null
  registrationNumber?: string | null
  microchipNumber?: string | null
}

export interface Customer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  bookingCount: number
  noShowCount: number
  lastBookingDate: string | null
  horses: CustomerHorse[]
  isManuallyAdded?: boolean
}

export interface CustomerNote {
  id: string
  providerId: string
  customerId: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface HorseFormData {
  name: string
  breed: string
  birthYear: string
  color: string
  gender: string
  specialNeeds: string
  registrationNumber: string
  microchipNumber: string
}

export const emptyHorseForm: HorseFormData = {
  name: "",
  breed: "",
  birthYear: "",
  color: "",
  gender: "",
  specialNeeds: "",
  registrationNumber: "",
  microchipNumber: "",
}
