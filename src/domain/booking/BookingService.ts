/**
 * BookingService - Domain service for booking operations
 *
 * Encapsulates booking business logic:
 * - Time validation (via TimeSlot value object)
 * - Service/Provider validation
 * - Self-booking prevention
 * - Overlap detection (via repository)
 *
 * API layer calls this service; service calls repositories.
 */
import { Result } from '@/domain/shared/types/Result'
import { TimeSlot } from '@/domain/shared/TimeSlot'
import { Location } from '@/domain/shared/Location'
import {
  IBookingRepository,
  BookingWithRelations,
  CreateBookingData,
  BookingWithCustomerLocation,
} from '@/infrastructure/persistence/booking/IBookingRepository'
import { PrismaBookingRepository } from '@/infrastructure/persistence/booking/PrismaBookingRepository'
import { TravelTimeService, BookingWithLocation } from './TravelTimeService'
import { BookingStatus } from './BookingStatus'
import { prisma } from '@/lib/prisma'

/**
 * DTO for creating a booking
 */
export interface CreateBookingDTO {
  customerId: string
  providerId: string
  serviceId: string
  bookingDate: Date
  startTime: string
  endTime?: string // Optional - calculated from service duration if missing
  routeOrderId?: string
  horseId?: string
  horseName?: string
  horseInfo?: string
  customerNotes?: string
}

/**
 * DTO for creating a manual booking (provider creates on behalf of customer)
 */
export interface CreateManualBookingDTO {
  providerId: string
  serviceId: string
  bookingDate: Date
  startTime: string
  endTime?: string
  // Either existing customer...
  customerId?: string
  // ...or new manual customer
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  // Horse
  horseId?: string
  horseName?: string
  horseInfo?: string
  customerNotes?: string
}

/**
 * Service info needed for booking validation
 */
export interface ServiceInfo {
  id: string
  providerId: string
  durationMinutes: number
  isActive: boolean
}

/**
 * Provider info needed for booking validation
 */
export interface ProviderInfo {
  id: string
  userId: string
  isActive: boolean
  acceptingNewCustomers?: boolean
  /** Provider's home location (fallback for travel time calculation) */
  latitude?: number | null
  longitude?: number | null
}

/**
 * Customer info needed for travel time validation
 */
export interface CustomerLocationInfo {
  latitude?: number | null
  longitude?: number | null
  address?: string | null
}

/**
 * Booking errors - explicit error types for clear error handling
 */
/**
 * DTO for rescheduling a booking
 */
export interface RescheduleBookingDTO {
  bookingId: string
  customerId: string       // From session
  newBookingDate: string   // "YYYY-MM-DD"
  newStartTime: string     // "HH:MM"
}

export type BookingError =
  | { type: 'INVALID_TIMES'; message: string }
  | { type: 'OVERLAP'; message: string }
  | { type: 'INSUFFICIENT_TRAVEL_TIME'; message: string; requiredMinutes: number; actualMinutes: number }
  | { type: 'INACTIVE_SERVICE' }
  | { type: 'INACTIVE_PROVIDER' }
  | { type: 'SELF_BOOKING' }
  | { type: 'SERVICE_PROVIDER_MISMATCH' }
  | { type: 'INVALID_ROUTE_ORDER'; message: string }
  | { type: 'INVALID_STATUS_TRANSITION'; message: string; from: string; to: string }
  | { type: 'BOOKING_NOT_FOUND' }
  | { type: 'INVALID_CUSTOMER_DATA'; message: string }
  | { type: 'GHOST_USER_CREATION_FAILED'; message: string }
  | { type: 'PROVIDER_CLOSED'; message: string }
  | { type: 'NEW_CUSTOMER_NOT_ACCEPTED' }
  | { type: 'RESCHEDULE_DISABLED' }
  | { type: 'RESCHEDULE_WINDOW_PASSED'; hoursRequired: number }
  | { type: 'MAX_RESCHEDULES_REACHED'; max: number }
  | { type: 'INACTIVE_SERVICE_FOR_RESCHEDULE' }

/**
 * Route order info for validation
 */
export interface RouteOrderInfo {
  dateFrom: Date
  dateTo: Date
  status: string
  providerId: string
}

/**
 * Availability exception info for closed-day validation
 */
export interface AvailabilityExceptionInfo {
  isClosed: boolean
  reason?: string | null
  startTime?: string | null
  endTime?: string | null
}

/**
 * Provider reschedule settings
 */
export interface ProviderRescheduleInfo {
  rescheduleEnabled: boolean
  rescheduleWindowHours: number
  maxReschedules: number
  rescheduleRequiresApproval: boolean
}

/**
 * Dependencies for BookingService
 *
 * Using interfaces for dependency injection and testability.
 */
export interface BookingServiceDeps {
  bookingRepository: IBookingRepository
  getService: (id: string) => Promise<ServiceInfo | null>
  getProvider: (id: string) => Promise<ProviderInfo | null>
  getRouteOrder?: (id: string) => Promise<RouteOrderInfo | null>
  /** Check if provider has an availability exception for a date */
  getAvailabilityException?: (providerId: string, date: Date) => Promise<AvailabilityExceptionInfo | null>
  /** Get customer location for travel time calculation */
  getCustomerLocation?: (customerId: string) => Promise<CustomerLocationInfo | null>
  /** Travel time service instance (optional - for travel time validation) */
  travelTimeService?: TravelTimeService
  /** Create ghost user for manual bookings (optional - only needed for manual booking flow) */
  createGhostUser?: (data: { name: string; phone?: string; email?: string }) => Promise<string>
  /** Check if customer has at least one completed booking with provider */
  hasCompletedBookingWith?: (providerId: string, customerId: string) => Promise<boolean>
  /** Get provider reschedule settings */
  getProviderRescheduleSettings?: (providerId: string) => Promise<ProviderRescheduleInfo | null>
}

/**
 * DTO for updating booking status
 */
export interface UpdateStatusDTO {
  bookingId: string
  newStatus: string
  /** Provider ID if the actor is a provider */
  providerId?: string
  /** Customer ID if the actor is a customer */
  customerId?: string
  /** Optional message from whoever cancels the booking */
  cancellationMessage?: string
}

// Statuses that only providers can set (customers can only cancel)
const PROVIDER_ONLY_STATUSES = ['confirmed', 'completed', 'no_show']

export class BookingService {
  constructor(private readonly deps: BookingServiceDeps) {}

  /**
   * Create a new booking with full validation
   *
   * @param dto - Booking data
   * @returns Result with created booking or error
   */
  async createBooking(
    dto: CreateBookingDTO
  ): Promise<Result<BookingWithRelations, BookingError>> {
    // 1. Get and validate service
    const service = await this.deps.getService(dto.serviceId)

    if (!service) {
      return Result.fail({ type: 'INACTIVE_SERVICE' })
    }

    if (!service.isActive) {
      return Result.fail({ type: 'INACTIVE_SERVICE' })
    }

    if (service.providerId !== dto.providerId) {
      return Result.fail({ type: 'SERVICE_PROVIDER_MISMATCH' })
    }

    // 2. Get and validate provider
    const provider = await this.deps.getProvider(dto.providerId)

    if (!provider) {
      return Result.fail({ type: 'INACTIVE_PROVIDER' })
    }

    if (!provider.isActive) {
      return Result.fail({ type: 'INACTIVE_PROVIDER' })
    }

    // 3. Prevent self-booking
    if (provider.userId === dto.customerId) {
      return Result.fail({ type: 'SELF_BOOKING' })
    }

    // 3b. Check if provider accepts new customers
    if (provider.acceptingNewCustomers === false) {
      const isExistingCustomer = this.deps.hasCompletedBookingWith
        ? await this.deps.hasCompletedBookingWith(dto.providerId, dto.customerId)
        : false
      if (!isExistingCustomer) {
        return Result.fail({ type: 'NEW_CUSTOMER_NOT_ACCEPTED' })
      }
    }

    // 4. Check if provider has closed this day
    const closedDayCheck = await this.validateClosedDay(dto.providerId, dto.bookingDate)
    if (closedDayCheck.isFailure) {
      return Result.fail(closedDayCheck.error)
    }

    // 5. Calculate end time if not provided
    const endTime = dto.endTime || this.calculateEndTime(dto.startTime, service.durationMinutes)

    // 6. Validate times using TimeSlot value object
    const timeSlotResult = TimeSlot.create(dto.startTime, endTime)

    if (timeSlotResult.isFailure) {
      return Result.fail({ type: 'INVALID_TIMES', message: timeSlotResult.error })
    }

    // 7. Validate route order if provided
    if (dto.routeOrderId && this.deps.getRouteOrder) {
      const routeOrderValidation = await this.validateRouteOrder(
        dto.routeOrderId,
        dto.providerId,
        dto.bookingDate
      )

      if (routeOrderValidation.isFailure) {
        return Result.fail(routeOrderValidation.error)
      }
    }

    // 8. Validate travel time if service is configured
    let travelTimeMinutes: number | undefined
    if (this.deps.travelTimeService && this.deps.getCustomerLocation) {
      const travelValidation = await this.validateTravelTime(
        dto.customerId,
        dto.providerId,
        dto.bookingDate,
        timeSlotResult.value.startTime,
        timeSlotResult.value.endTime,
        provider
      )

      if (travelValidation.isFailure) {
        return Result.fail(travelValidation.error)
      }

      travelTimeMinutes = travelValidation.value
    }

    // 9. Create booking with atomic overlap check
    const bookingData: CreateBookingData = {
      customerId: dto.customerId,
      providerId: dto.providerId,
      serviceId: dto.serviceId,
      bookingDate: dto.bookingDate,
      startTime: timeSlotResult.value.startTime,
      endTime: timeSlotResult.value.endTime,
      routeOrderId: dto.routeOrderId,
      horseId: dto.horseId,
      horseName: dto.horseName,
      horseInfo: dto.horseInfo,
      customerNotes: dto.customerNotes,
      travelTimeMinutes,
    }

    const booking = await this.deps.bookingRepository.createWithOverlapCheck(bookingData)

    if (!booking) {
      return Result.fail({
        type: 'OVERLAP',
        message: 'Leverantören är redan bokad under den valda tiden',
      })
    }

    return Result.ok(booking)
  }

  /**
   * Update booking status with state machine validation
   *
   * Validates:
   * 1. Status string is valid
   * 2. Booking exists
   * 3. Transition is allowed by state machine
   * 4. Actor has permission (customers can only cancel)
   */
  async updateStatus(
    dto: UpdateStatusDTO
  ): Promise<Result<BookingWithRelations, BookingError>> {
    // 1. Validate new status string
    const newStatusResult = BookingStatus.create(dto.newStatus)
    if (newStatusResult.isFailure) {
      return Result.fail({
        type: 'INVALID_STATUS_TRANSITION',
        message: newStatusResult.error,
        from: 'unknown',
        to: dto.newStatus,
      })
    }

    // 2. Fetch booking for current status
    const booking = await this.deps.bookingRepository.findById(dto.bookingId)
    if (!booking) {
      return Result.fail({ type: 'BOOKING_NOT_FOUND' })
    }

    // 3. Validate state machine transition
    const currentStatusResult = BookingStatus.create(booking.status)
    if (currentStatusResult.isFailure) {
      // Current status in DB is invalid -- should not happen but handle gracefully
      return Result.fail({
        type: 'INVALID_STATUS_TRANSITION',
        message: `Bokningens nuvarande status "${booking.status}" är ogiltig`,
        from: booking.status,
        to: dto.newStatus,
      })
    }

    const transitionResult = currentStatusResult.value.transitionTo(newStatusResult.value)
    if (transitionResult.isFailure) {
      return Result.fail({
        type: 'INVALID_STATUS_TRANSITION',
        message: transitionResult.error,
        from: booking.status,
        to: dto.newStatus,
      })
    }

    // 4. Authorization: customers can only cancel, not confirm/complete
    if (dto.customerId && PROVIDER_ONLY_STATUSES.includes(dto.newStatus)) {
      return Result.fail({
        type: 'INVALID_STATUS_TRANSITION',
        message: `Kunder kan inte ändra status till "${dto.newStatus}". Bara leverantörer kan bekräfta och slutföra bokningar.`,
        from: booking.status,
        to: dto.newStatus,
      })
    }

    // 5. Delegate to repository (preserves IDOR protection via WHERE clause)
    const authContext: { providerId?: string; customerId?: string } = {}
    if (dto.providerId) authContext.providerId = dto.providerId
    if (dto.customerId) authContext.customerId = dto.customerId

    const updated = await this.deps.bookingRepository.updateStatusWithAuth(
      dto.bookingId,
      dto.newStatus as 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show',
      authContext,
      dto.cancellationMessage
    )

    if (!updated) {
      return Result.fail({ type: 'BOOKING_NOT_FOUND' })
    }

    return Result.ok(updated)
  }

  /**
   * Create a manual booking (provider creates on behalf of a customer)
   *
   * Key differences from createBooking():
   * - No self-booking check
   * - No travel time validation
   * - Initial status is "confirmed" (not "pending")
   * - Can create ghost user if no customerId provided
   * - Sets isManualBooking and createdByProviderId
   */
  async createManualBooking(
    dto: CreateManualBookingDTO
  ): Promise<Result<BookingWithRelations, BookingError>> {
    // 1. Validate customer data
    if (!dto.customerId && !dto.customerName) {
      return Result.fail({
        type: 'INVALID_CUSTOMER_DATA',
        message: 'Ange antingen kund-ID eller kundnamn',
      })
    }

    // 2. Get and validate service
    const service = await this.deps.getService(dto.serviceId)
    if (!service || !service.isActive) {
      return Result.fail({ type: 'INACTIVE_SERVICE' })
    }
    if (service.providerId !== dto.providerId) {
      return Result.fail({ type: 'SERVICE_PROVIDER_MISMATCH' })
    }

    // 3. Get and validate provider
    const provider = await this.deps.getProvider(dto.providerId)
    if (!provider || !provider.isActive) {
      return Result.fail({ type: 'INACTIVE_PROVIDER' })
    }

    // 4. Check if provider has closed this day
    const closedDayCheck = await this.validateClosedDay(dto.providerId, dto.bookingDate)
    if (closedDayCheck.isFailure) {
      return Result.fail(closedDayCheck.error)
    }

    // 5. Resolve customer ID (existing or ghost user)
    let customerId = dto.customerId
    if (!customerId && dto.customerName && this.deps.createGhostUser) {
      try {
        customerId = await this.deps.createGhostUser({
          name: dto.customerName,
          phone: dto.customerPhone,
          email: dto.customerEmail,
        })
      } catch {
        return Result.fail({
          type: 'GHOST_USER_CREATION_FAILED',
          message: 'Kunde inte skapa kundprofil',
        })
      }
    }

    if (!customerId) {
      return Result.fail({
        type: 'INVALID_CUSTOMER_DATA',
        message: 'Kunde inte skapa kundprofil',
      })
    }

    // 5. Calculate end time if not provided
    const endTime = dto.endTime || this.calculateEndTime(dto.startTime, service.durationMinutes)

    // 6. Validate times
    const timeSlotResult = TimeSlot.create(dto.startTime, endTime)
    if (timeSlotResult.isFailure) {
      return Result.fail({ type: 'INVALID_TIMES', message: timeSlotResult.error })
    }

    // 7. Create booking with atomic overlap check
    const bookingData: CreateBookingData = {
      customerId,
      providerId: dto.providerId,
      serviceId: dto.serviceId,
      bookingDate: dto.bookingDate,
      startTime: timeSlotResult.value.startTime,
      endTime: timeSlotResult.value.endTime,
      horseId: dto.horseId,
      horseName: dto.horseName,
      horseInfo: dto.horseInfo,
      customerNotes: dto.customerNotes,
      isManualBooking: true,
      createdByProviderId: dto.providerId,
      status: 'confirmed',
    }

    const booking = await this.deps.bookingRepository.createWithOverlapCheck(bookingData)
    if (!booking) {
      return Result.fail({
        type: 'OVERLAP',
        message: 'Leverantören är redan bokad under den valda tiden',
      })
    }

    return Result.ok(booking)
  }

  /**
   * Reschedule a booking to a new date/time
   *
   * Validates:
   * 1. Booking exists and belongs to the customer
   * 2. Status is pending or confirmed (not terminal)
   * 3. Provider has rescheduleEnabled = true
   * 4. Current time >= rescheduleWindowHours before booking
   * 5. rescheduleCount < maxReschedules
   * 6. New time is in the future
   * 7. TimeSlot validation (valid format, start < end)
   * 8. Service still active (for durationMinutes)
   * 9. No overlap (excluding current booking)
   * 10. Availability check (not a closed day)
   */
  async rescheduleBooking(
    dto: RescheduleBookingDTO
  ): Promise<Result<BookingWithRelations, BookingError>> {
    // 1. Fetch the booking
    const booking = await this.deps.bookingRepository.findById(dto.bookingId)
    if (!booking) {
      return Result.fail({ type: 'BOOKING_NOT_FOUND' })
    }

    // 2. Verify ownership
    if (booking.customerId !== dto.customerId) {
      return Result.fail({ type: 'BOOKING_NOT_FOUND' })
    }

    // 3. Check status is reschedulable
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return Result.fail({
        type: 'INVALID_STATUS_TRANSITION',
        message: 'Bara bokningar med status väntande eller bekräftad kan bokas om',
        from: booking.status,
        to: booking.status,
      })
    }

    // 4. Get provider reschedule settings
    if (!this.deps.getProviderRescheduleSettings) {
      return Result.fail({ type: 'RESCHEDULE_DISABLED' })
    }
    const rescheduleSettings = await this.deps.getProviderRescheduleSettings(booking.providerId)
    if (!rescheduleSettings || !rescheduleSettings.rescheduleEnabled) {
      return Result.fail({ type: 'RESCHEDULE_DISABLED' })
    }

    // 5. Check reschedule window
    const now = new Date()
    const bookingDateTime = new Date(booking.bookingDate)
    const [bookingHours, bookingMinutes] = booking.startTime.split(':').map(Number)
    bookingDateTime.setHours(bookingHours, bookingMinutes, 0, 0)
    const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (hoursUntilBooking < rescheduleSettings.rescheduleWindowHours) {
      return Result.fail({
        type: 'RESCHEDULE_WINDOW_PASSED',
        hoursRequired: rescheduleSettings.rescheduleWindowHours,
      })
    }

    // 6. Check max reschedules
    if (booking.rescheduleCount >= rescheduleSettings.maxReschedules) {
      return Result.fail({
        type: 'MAX_RESCHEDULES_REACHED',
        max: rescheduleSettings.maxReschedules,
      })
    }

    // 7. Get service for duration calculation
    const service = await this.deps.getService(booking.serviceId)
    if (!service || !service.isActive) {
      return Result.fail({ type: 'INACTIVE_SERVICE_FOR_RESCHEDULE' })
    }

    // 8. Calculate end time
    const newEndTime = this.calculateEndTime(dto.newStartTime, service.durationMinutes)

    // 9. Validate new time slot
    const timeSlotResult = TimeSlot.create(dto.newStartTime, newEndTime)
    if (timeSlotResult.isFailure) {
      return Result.fail({ type: 'INVALID_TIMES', message: timeSlotResult.error })
    }

    // 10. New date must be in the future
    const newBookingDate = new Date(dto.newBookingDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (newBookingDate < today) {
      return Result.fail({ type: 'INVALID_TIMES', message: 'Nytt datum måste vara i framtiden' })
    }

    // 11. Check closed day
    const closedDayCheck = await this.validateClosedDay(booking.providerId, newBookingDate)
    if (closedDayCheck.isFailure) {
      return Result.fail(closedDayCheck.error)
    }

    // 12. Determine new status
    let newStatus: 'pending' | 'confirmed' | undefined
    if (rescheduleSettings.rescheduleRequiresApproval && booking.status === 'confirmed') {
      newStatus = 'pending'
    }

    // 13. Reschedule with atomic overlap check
    const updated = await this.deps.bookingRepository.rescheduleWithOverlapCheck(
      dto.bookingId,
      dto.customerId,
      {
        bookingDate: newBookingDate,
        startTime: timeSlotResult.value.startTime,
        endTime: timeSlotResult.value.endTime,
        providerId: booking.providerId,
        newStatus,
      }
    )

    if (!updated) {
      return Result.fail({
        type: 'OVERLAP',
        message: 'Leverantören är redan bokad under den valda tiden',
      })
    }

    return Result.ok(updated)
  }

  /**
   * Calculate end time from start time and duration
   */
  private calculateEndTime(startTime: string, durationMinutes: number): string {
    const [hours, minutes] = startTime.split(':').map(Number)
    const startMinutes = hours * 60 + minutes
    const endMinutes = startMinutes + durationMinutes

    const endHours = Math.floor(endMinutes / 60)
    const endMins = endMinutes % 60

    return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`
  }

  /**
   * Validate that the provider has not closed the day via AvailabilityException
   */
  private async validateClosedDay(
    providerId: string,
    bookingDate: Date
  ): Promise<Result<void, BookingError>> {
    if (!this.deps.getAvailabilityException) {
      return Result.ok(undefined)
    }

    const exception = await this.deps.getAvailabilityException(providerId, bookingDate)

    if (!exception) {
      return Result.ok(undefined)
    }

    if (exception.isClosed) {
      const message = exception.reason
        ? `Leverantören är stängd detta datum: ${exception.reason}`
        : 'Leverantören är stängd detta datum'
      return Result.fail({ type: 'PROVIDER_CLOSED', message })
    }

    // Exception exists but isClosed=false means alternative hours -- allow booking
    return Result.ok(undefined)
  }

  /**
   * Validate route order for booking
   */
  private async validateRouteOrder(
    routeOrderId: string,
    providerId: string,
    bookingDate: Date
  ): Promise<Result<void, BookingError>> {
    if (!this.deps.getRouteOrder) {
      return Result.ok(undefined)
    }

    const routeOrder = await this.deps.getRouteOrder(routeOrderId)

    if (!routeOrder) {
      return Result.fail({
        type: 'INVALID_ROUTE_ORDER',
        message: 'RouteOrder hittades inte',
      })
    }

    if (routeOrder.status !== 'open') {
      return Result.fail({
        type: 'INVALID_ROUTE_ORDER',
        message: 'Rutten är inte längre öppen för bokningar',
      })
    }

    if (bookingDate < routeOrder.dateFrom || bookingDate > routeOrder.dateTo) {
      return Result.fail({
        type: 'INVALID_ROUTE_ORDER',
        message: 'Bokningsdatum måste vara inom ruttens datum-spann',
      })
    }

    if (providerId !== routeOrder.providerId) {
      return Result.fail({
        type: 'INVALID_ROUTE_ORDER',
        message: 'Provider matchar inte rutt-annonsen',
      })
    }

    return Result.ok(undefined)
  }

  /**
   * Validate travel time for a new booking
   *
   * Checks that there's enough time to travel between existing bookings
   * and the new booking based on geographic locations.
   *
   * @returns Travel time in minutes if valid, or error if insufficient time
   */
  private async validateTravelTime(
    customerId: string,
    providerId: string,
    bookingDate: Date,
    startTime: string,
    endTime: string,
    provider: ProviderInfo
  ): Promise<Result<number | undefined, BookingError>> {
    // Check if travel time validation is configured
    if (!this.deps.travelTimeService || !this.deps.getCustomerLocation) {
      return Result.ok(undefined)
    }

    // Get customer location
    const customerLocation = await this.deps.getCustomerLocation(customerId)

    // Resolve location for the new booking (customer location or provider fallback)
    const newBookingLocation = this.resolveBookingLocation(
      customerLocation,
      provider
    )

    // Get existing bookings with their customer locations
    const existingBookingsData = await this.deps.bookingRepository.findByProviderAndDateWithLocation(
      providerId,
      bookingDate
    )

    // Convert to BookingWithLocation format
    const existingBookings: BookingWithLocation[] = existingBookingsData.map(
      (booking: BookingWithCustomerLocation) => ({
        id: booking.id,
        startTime: booking.startTime,
        endTime: booking.endTime,
        location: this.resolveBookingLocationFromCustomer(booking.customer, provider),
      })
    )

    // Create new booking data for validation
    const newBooking: BookingWithLocation = {
      id: 'new-booking',
      startTime,
      endTime,
      location: newBookingLocation,
    }

    // Validate travel time
    const result = this.deps.travelTimeService.hasEnoughTravelTime(
      newBooking,
      existingBookings
    )

    if (!result.valid) {
      return Result.fail({
        type: 'INSUFFICIENT_TRAVEL_TIME',
        message: result.error || 'Otillräcklig restid mellan bokningar',
        requiredMinutes: result.requiredGapMinutes || 0,
        actualMinutes: result.actualGapMinutes || 0,
      })
    }

    return Result.ok(result.travelTimeMinutes)
  }

  /**
   * Resolve location for a booking based on customer location or provider fallback
   */
  private resolveBookingLocation(
    customerLocation: CustomerLocationInfo | null,
    provider: ProviderInfo
  ): Location | undefined {
    // Priority 1: Customer's saved address
    if (customerLocation?.latitude && customerLocation?.longitude) {
      const result = Location.create(
        customerLocation.latitude,
        customerLocation.longitude,
        customerLocation.address || undefined
      )
      if (result.isSuccess) {
        return result.value
      }
    }

    // Priority 2: Provider's home address (fallback)
    if (provider.latitude && provider.longitude) {
      const result = Location.create(provider.latitude, provider.longitude)
      if (result.isSuccess) {
        return result.value
      }
    }

    // No location available - will use default buffer
    return undefined
  }

  /**
   * Resolve location from existing booking's customer data
   */
  private resolveBookingLocationFromCustomer(
    customer: { latitude: number | null; longitude: number | null; address: string | null },
    provider: ProviderInfo
  ): Location | undefined {
    // Priority 1: Customer's location from the booking
    if (customer.latitude && customer.longitude) {
      const result = Location.create(
        customer.latitude,
        customer.longitude,
        customer.address || undefined
      )
      if (result.isSuccess) {
        return result.value
      }
    }

    // Priority 2: Provider's home address (fallback)
    if (provider.latitude && provider.longitude) {
      const result = Location.create(provider.latitude, provider.longitude)
      if (result.isSuccess) {
        return result.value
      }
    }

    return undefined
  }
}

/**
 * Factory function for creating BookingService with production dependencies
 *
 * Follows the same pattern as createGroupBookingService().
 * Centralizes DI wiring so routes can use a single function call.
 */
export function createBookingService(): BookingService {
  return new BookingService({
    bookingRepository: new PrismaBookingRepository(),
    getService: async (id) => {
      return prisma.service.findUnique({
        where: { id },
        select: {
          id: true,
          providerId: true,
          durationMinutes: true,
          isActive: true,
        },
      })
    },
    getProvider: async (id) => {
      return prisma.provider.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          isActive: true,
          acceptingNewCustomers: true,
          latitude: true,
          longitude: true,
        },
      })
    },
    getAvailabilityException: async (providerId, date) => {
      return prisma.availabilityException.findUnique({
        where: { providerId_date: { providerId, date } },
        select: {
          isClosed: true,
          reason: true,
          startTime: true,
          endTime: true,
        },
      })
    },
    getRouteOrder: async (id) => {
      const routeOrder = await prisma.routeOrder.findUnique({
        where: { id },
        select: {
          dateFrom: true,
          dateTo: true,
          status: true,
          providerId: true,
        },
      })
      if (!routeOrder || !routeOrder.providerId) {
        return null
      }
      return {
        dateFrom: routeOrder.dateFrom,
        dateTo: routeOrder.dateTo,
        status: routeOrder.status,
        providerId: routeOrder.providerId,
      }
    },
    getCustomerLocation: async (customerId) => {
      return prisma.user.findUnique({
        where: { id: customerId },
        select: {
          latitude: true,
          longitude: true,
          address: true,
        },
      })
    },
    hasCompletedBookingWith: async (providerId, customerId) => {
      const count = await prisma.booking.count({
        where: { providerId, customerId, status: 'completed' },
      })
      return count > 0
    },
    getProviderRescheduleSettings: async (providerId) => {
      return prisma.provider.findUnique({
        where: { id: providerId },
        select: {
          rescheduleEnabled: true,
          rescheduleWindowHours: true,
          maxReschedules: true,
          rescheduleRequiresApproval: true,
        },
      })
    },
    travelTimeService: new TravelTimeService(),
    createGhostUser: async (data) => {
      const parts = data.name.trim().split(/\s+/)
      const firstName = parts[0]
      const lastName = parts.slice(1).join(' ') || ''

      const { createGhostUser } = await import('@/lib/ghost-user')
      return createGhostUser({
        firstName,
        lastName,
        phone: data.phone,
        email: data.email,
      })
    },
  })
}
