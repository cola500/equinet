export interface Payment {
  id: string
  status: string
  amount: number
  currency: string
  paidAt: string | null
  invoiceNumber: string | null
  invoiceUrl: string | null
}

export interface Booking {
  id: string
  bookingDate: string
  startTime: string
  endTime: string
  status: string
  cancellationMessage?: string
  horseName?: string
  horse?: {
    id: string
    name: string
    breed?: string | null
    gender?: string | null
  } | null
  customerNotes?: string
  rescheduleCount: number
  bookingSeriesId?: string | null
  routeOrderId?: string | null
  service: {
    name: string
    price: number
    durationMinutes: number
  }
  provider: {
    businessName: string
    rescheduleEnabled: boolean
    rescheduleWindowHours: number
    maxReschedules: number
    rescheduleRequiresApproval: boolean
    user: {
      firstName: string
      lastName: string
    }
  }
  payment?: Payment | null
  review?: {
    id: string
    rating: number
    comment: string | null
    reply: string | null
    repliedAt: string | null
  } | null
  type: "fixed"
}

export interface RouteOrder {
  id: string
  serviceType: string
  address: string
  numberOfHorses: number
  dateFrom: string
  dateTo: string
  priority: string
  specialInstructions?: string
  status: string
  createdAt: string
  routeStops?: Array<{
    route: {
      routeName: string
      routeDate: string
      provider: {
        businessName: string
        user: {
          firstName: string
          lastName: string
        }
      }
    }
    estimatedArrival?: string
  }>
  type: "flexible"
}

export type CombinedBooking = Booking | RouteOrder
