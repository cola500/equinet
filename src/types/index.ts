// Type definitions for Equinet

export type UserType = 'provider' | 'customer'

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

export interface User {
  id: string
  email: string
  passwordHash: string
  userType: UserType
  firstName: string
  lastName: string
  phone?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Provider {
  id: string
  userId: string
  businessName: string
  description?: string | null
  address?: string | null
  city?: string | null
  postalCode?: string | null
  serviceArea?: string | null
  profileImageUrl?: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Service {
  id: string
  providerId: string
  name: string
  description?: string | null
  price: number
  durationMinutes: number
  isActive: boolean
  createdAt: Date
}

export interface Availability {
  id: string
  providerId: string
  dayOfWeek: number // 0-6
  startTime: string
  endTime: string
  isActive: boolean
}

export interface Booking {
  id: string
  customerId: string
  providerId: string
  serviceId: string
  bookingDate: Date
  startTime: string
  endTime: string
  status: BookingStatus
  customerNotes?: string | null
  horseName?: string | null
  horseInfo?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Notification {
  id: string
  userId: string
  type: string
  message: string
  isRead: boolean
  createdAt: Date
}

// Extended types with relations
export interface ProviderWithServices extends Provider {
  services: Service[]
  availability: Availability[]
}

export interface BookingWithDetails extends Booking {
  customer: User
  provider: Provider
  service: Service
}

// Calendar-related types
export interface CalendarPayment {
  id: string
  status: string
  amount: number
  invoiceNumber: string | null
}

export interface CalendarCustomer {
  firstName: string
  lastName: string
  email: string
  phone?: string
}

export interface CalendarService {
  name: string
  price: number
}

export interface CalendarBooking {
  id: string
  bookingDate: string
  startTime: string
  endTime: string
  status: string
  horseName?: string
  horseInfo?: string
  customerNotes?: string
  service: CalendarService
  customer: CalendarCustomer
  payment?: CalendarPayment | null
}
