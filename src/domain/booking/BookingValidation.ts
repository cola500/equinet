/**
 * @domain booking
 *
 * BookingValidation - Extracted validation logic from BookingService
 *
 * Contains all validation helpers used by createBooking, createManualBooking,
 * and rescheduleBooking. Keeps BookingService focused on orchestration.
 */
import { Result } from '@/domain/shared/types/Result'
import { TimeSlot } from '@/domain/shared/TimeSlot'
import { Location } from '@/domain/shared/Location'
import { BookingWithLocation } from './TravelTimeService'
import type {
  BookingError,
  BookingServiceDeps,
  ServiceInfo,
  ProviderInfo,
  CustomerLocationInfo,
} from './BookingService'
import type { BookingWithCustomerLocation } from '@/infrastructure/persistence/booking/IBookingRepository'

export class BookingValidation {
  constructor(private readonly deps: BookingServiceDeps) {}

  /**
   * Validate that a service exists, is active, and belongs to the given provider.
   */
  async validateService(
    serviceId: string,
    providerId: string
  ): Promise<Result<ServiceInfo, BookingError>> {
    const service = await this.deps.getService(serviceId)

    if (!service || !service.isActive) {
      return Result.fail({ type: 'INACTIVE_SERVICE' })
    }

    if (service.providerId !== providerId) {
      return Result.fail({ type: 'SERVICE_PROVIDER_MISMATCH' })
    }

    return Result.ok(service)
  }

  /**
   * Validate that a provider exists and is active.
   */
  async validateProvider(
    providerId: string
  ): Promise<Result<ProviderInfo, BookingError>> {
    const provider = await this.deps.getProvider(providerId)

    if (!provider || !provider.isActive) {
      return Result.fail({ type: 'INACTIVE_PROVIDER' })
    }

    return Result.ok(provider)
  }

  /**
   * Calculate end time (if needed) and validate as TimeSlot.
   */
  validateTimeSlot(
    startTime: string,
    endTime: string | undefined,
    durationMinutes: number
  ): Result<{ startTime: string; endTime: string }, BookingError> {
    const resolvedEndTime = endTime || this.calculateEndTime(startTime, durationMinutes)
    const timeSlotResult = TimeSlot.create(startTime, resolvedEndTime)

    if (timeSlotResult.isFailure) {
      return Result.fail({ type: 'INVALID_TIMES', message: timeSlotResult.error })
    }

    return Result.ok({
      startTime: timeSlotResult.value.startTime,
      endTime: timeSlotResult.value.endTime,
    })
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
  async validateClosedDay(
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
  async validateRouteOrder(
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
  async validateTravelTime(
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
