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
import {
  IBookingRepository,
  BookingWithRelations,
  CreateBookingData,
} from '@/infrastructure/persistence/booking/IBookingRepository'

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
}

/**
 * Booking errors - explicit error types for clear error handling
 */
export type BookingError =
  | { type: 'INVALID_TIMES'; message: string }
  | { type: 'OVERLAP'; message: string }
  | { type: 'INACTIVE_SERVICE' }
  | { type: 'INACTIVE_PROVIDER' }
  | { type: 'SELF_BOOKING' }
  | { type: 'SERVICE_PROVIDER_MISMATCH' }
  | { type: 'INVALID_ROUTE_ORDER'; message: string }

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
 * Dependencies for BookingService
 *
 * Using interfaces for dependency injection and testability.
 */
export interface BookingServiceDeps {
  bookingRepository: IBookingRepository
  getService: (id: string) => Promise<ServiceInfo | null>
  getProvider: (id: string) => Promise<ProviderInfo | null>
  getRouteOrder?: (id: string) => Promise<RouteOrderInfo | null>
}

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

    // 4. Calculate end time if not provided
    const endTime = dto.endTime || this.calculateEndTime(dto.startTime, service.durationMinutes)

    // 5. Validate times using TimeSlot value object
    const timeSlotResult = TimeSlot.create(dto.startTime, endTime)

    if (timeSlotResult.isFailure) {
      return Result.fail({ type: 'INVALID_TIMES', message: timeSlotResult.error })
    }

    // 6. Validate route order if provided
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

    // 7. Create booking with atomic overlap check
    const bookingData: CreateBookingData = {
      customerId: dto.customerId,
      providerId: dto.providerId,
      serviceId: dto.serviceId,
      bookingDate: dto.bookingDate,
      startTime: timeSlotResult.value.startTime,
      endTime: timeSlotResult.value.endTime,
      routeOrderId: dto.routeOrderId,
      horseName: dto.horseName,
      horseInfo: dto.horseInfo,
      customerNotes: dto.customerNotes,
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
}

/**
 * Map BookingError to HTTP status code
 */
export function mapBookingErrorToStatus(error: BookingError): number {
  switch (error.type) {
    case 'INVALID_TIMES':
    case 'INACTIVE_SERVICE':
    case 'INACTIVE_PROVIDER':
    case 'SELF_BOOKING':
    case 'SERVICE_PROVIDER_MISMATCH':
    case 'INVALID_ROUTE_ORDER':
      return 400
    case 'OVERLAP':
      return 409
    default:
      return 500
  }
}

/**
 * Map BookingError to user-friendly message
 */
export function mapBookingErrorToMessage(error: BookingError): string {
  switch (error.type) {
    case 'INVALID_TIMES':
      return error.message
    case 'OVERLAP':
      return error.message
    case 'INACTIVE_SERVICE':
      return 'Tjänsten är inte längre tillgänglig'
    case 'INACTIVE_PROVIDER':
      return 'Leverantören är för närvarande inte tillgänglig'
    case 'SELF_BOOKING':
      return 'Du kan inte boka din egen tjänst'
    case 'SERVICE_PROVIDER_MISMATCH':
      return 'Ogiltig tjänst'
    case 'INVALID_ROUTE_ORDER':
      return error.message
    default:
      return 'Ett fel uppstod vid bokning'
  }
}
