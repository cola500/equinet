/**
 * BookingSeriesService - Domain service for recurring booking series
 *
 * Creates N bookings at regular intervals. Skips dates that conflict (overlap/closed).
 * BookingSeries is a support domain (like AvailabilityException) -- no separate repository.
 */
import { Result } from '@/domain/shared/types/Result'
import {
  IBookingRepository,
  BookingWithRelations,
} from '@/infrastructure/persistence/booking/IBookingRepository'
import { BookingService, BookingError } from './BookingService'
import { logger } from '@/lib/logger'

// --- DTOs ---

export interface CreateSeriesDTO {
  customerId: string
  providerId: string
  serviceId: string
  firstBookingDate: Date
  startTime: string
  intervalWeeks: number      // 1-52
  totalOccurrences: number   // 2-max
  horseId?: string
  horseName?: string
  horseInfo?: string
  customerNotes?: string
  isManualBooking?: boolean
  createdByProviderId?: string
}

export interface CancelSeriesDTO {
  seriesId: string
  actorCustomerId?: string
  actorProviderId?: string
  cancellationMessage?: string
}

export interface CreateSeriesResult {
  series: {
    id: string
    intervalWeeks: number
    totalOccurrences: number
    createdCount: number
    status: string
  }
  createdBookings: BookingWithRelations[]
  skippedDates: { date: string; reason: string }[]
}

export interface CancelSeriesResult {
  cancelledCount: number
}

export type SeriesError =
  | { type: 'RECURRING_FEATURE_OFF' }
  | { type: 'RECURRING_DISABLED' }
  | { type: 'INVALID_INTERVAL'; message: string }
  | { type: 'INVALID_OCCURRENCES'; message: string; max: number }
  | { type: 'NO_BOOKINGS_CREATED'; message: string }
  | { type: 'SERIES_NOT_FOUND' }
  | { type: 'NOT_OWNER' }

// --- Provider info for recurring settings ---

export interface ProviderRecurringInfo {
  id: string
  userId: string
  isActive: boolean
  recurringEnabled: boolean
  maxSeriesOccurrences: number
}

// --- Prisma delegate shapes (narrowed from `any` to match actual usage) ---

interface BookingSeriesRecord {
  id: string
  customerId: string
  providerId: string
  [key: string]: unknown
}

interface BookingRecord {
  id: string
  providerId: string
  customerId: string
  [key: string]: unknown
}

// --- Dependencies ---

export interface BookingSeriesServiceDeps {
  bookingRepository: IBookingRepository
  prisma: {
    bookingSeries: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: (args: any) => Promise<BookingSeriesRecord>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: (args: any) => Promise<BookingSeriesRecord>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete: (args: any) => Promise<BookingSeriesRecord>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findUnique: (args: any) => Promise<BookingSeriesRecord | null>
    }
    booking: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findMany: (args: any) => Promise<BookingRecord[]>
    }
  }
  isFeatureEnabled: (key: string) => Promise<boolean>
  getProvider: (id: string) => Promise<ProviderRecurringInfo | null>
  getService: (id: string) => Promise<{ id: string; providerId: string; durationMinutes: number; isActive: boolean } | null>
  bookingService: BookingService
}

// Skippable error types -- these mean the date is unavailable but the series should continue
const SKIPPABLE_ERRORS: BookingError['type'][] = [
  'OVERLAP',
  'PROVIDER_CLOSED',
  'INSUFFICIENT_TRAVEL_TIME',
]

export class BookingSeriesService {
  constructor(private readonly deps: BookingSeriesServiceDeps) {}

  async createSeries(
    dto: CreateSeriesDTO
  ): Promise<Result<CreateSeriesResult, SeriesError>> {
    // 1. Check feature flag
    const featureEnabled = await this.deps.isFeatureEnabled('recurring_bookings')
    if (!featureEnabled) {
      return Result.fail({ type: 'RECURRING_FEATURE_OFF' })
    }

    // 2. Get provider and check recurringEnabled
    const provider = await this.deps.getProvider(dto.providerId)
    if (!provider || !provider.recurringEnabled) {
      return Result.fail({ type: 'RECURRING_DISABLED' })
    }

    // 3. Validate interval (1-52)
    if (dto.intervalWeeks < 1 || dto.intervalWeeks > 52) {
      return Result.fail({
        type: 'INVALID_INTERVAL',
        message: `Intervall måste vara mellan 1 och 52 veckor (fick ${dto.intervalWeeks})`,
      })
    }

    // 4. Validate occurrences (2 - maxSeriesOccurrences)
    if (dto.totalOccurrences < 2) {
      return Result.fail({
        type: 'INVALID_OCCURRENCES',
        message: 'Antal tillfällen måste vara minst 2',
        max: provider.maxSeriesOccurrences,
      })
    }
    if (dto.totalOccurrences > provider.maxSeriesOccurrences) {
      return Result.fail({
        type: 'INVALID_OCCURRENCES',
        message: `Antal tillfällen får inte överstiga ${provider.maxSeriesOccurrences}`,
        max: provider.maxSeriesOccurrences,
      })
    }

    // 5. Create BookingSeries record
    const series = await this.deps.prisma.bookingSeries.create({
      data: {
        customerId: dto.customerId,
        providerId: dto.providerId,
        serviceId: dto.serviceId,
        horseId: dto.horseId || null,
        intervalWeeks: dto.intervalWeeks,
        totalOccurrences: dto.totalOccurrences,
        createdCount: 0,
        startTime: dto.startTime,
        status: 'active',
      },
    })

    // 6. Loop N times, create each booking
    const createdBookings: BookingWithRelations[] = []
    const skippedDates: { date: string; reason: string }[] = []

    for (let i = 0; i < dto.totalOccurrences; i++) {
      const bookingDate = new Date(dto.firstBookingDate)
      bookingDate.setDate(bookingDate.getDate() + i * dto.intervalWeeks * 7)

      const dateStr = bookingDate.toISOString().split('T')[0]

      try {
        let result: Result<BookingWithRelations, BookingError>

        if (dto.isManualBooking) {
          result = await this.deps.bookingService.createManualBooking({
            providerId: dto.providerId,
            serviceId: dto.serviceId,
            bookingDate,
            startTime: dto.startTime,
            customerId: dto.customerId,
            horseId: dto.horseId,
            horseName: dto.horseName,
            horseInfo: dto.horseInfo,
            customerNotes: dto.customerNotes,
          })
        } else {
          result = await this.deps.bookingService.createBooking({
            customerId: dto.customerId,
            providerId: dto.providerId,
            serviceId: dto.serviceId,
            bookingDate,
            startTime: dto.startTime,
            horseId: dto.horseId,
            horseName: dto.horseName,
            horseInfo: dto.horseInfo,
            customerNotes: dto.customerNotes,
          })
        }

        if (result.isSuccess) {
          createdBookings.push(result.value)
        } else {
          // Skippable errors -- continue with the series
          if (SKIPPABLE_ERRORS.includes(result.error.type)) {
            const message = 'message' in result.error ? result.error.message : result.error.type
            skippedDates.push({ date: dateStr, reason: message })
          } else {
            // Non-skippable error -- log and skip
            logger.warn(`Booking series: unexpected error for date ${dateStr}`, {
              error: result.error,
              seriesId: series.id,
            })
            skippedDates.push({ date: dateStr, reason: result.error.type })
          }
        }
      } catch (err) {
        logger.error(`Booking series: exception creating booking for ${dateStr}`, { err, seriesId: series.id })
        skippedDates.push({ date: dateStr, reason: 'Oväntat fel' })
      }
    }

    // 7. If no bookings created, delete the series
    if (createdBookings.length === 0) {
      await this.deps.prisma.bookingSeries.delete({
        where: { id: series.id },
      })
      return Result.fail({
        type: 'NO_BOOKINGS_CREATED',
        message: 'Inga bokningar kunde skapas. Alla datum var redan upptagna eller otillgängliga.',
      })
    }

    // 8. Update createdCount
    await this.deps.prisma.bookingSeries.update({
      where: { id: series.id },
      data: { createdCount: createdBookings.length },
    })

    return Result.ok({
      series: {
        id: series.id,
        intervalWeeks: dto.intervalWeeks,
        totalOccurrences: dto.totalOccurrences,
        createdCount: createdBookings.length,
        status: 'active',
      },
      createdBookings,
      skippedDates,
    })
  }

  async cancelSeries(
    dto: CancelSeriesDTO
  ): Promise<Result<CancelSeriesResult, SeriesError>> {
    // 1. Fetch series
    const series = await this.deps.prisma.bookingSeries.findUnique({
      where: { id: dto.seriesId },
    })

    if (!series) {
      return Result.fail({ type: 'SERIES_NOT_FOUND' })
    }

    // 2. Verify ownership
    const isCustomer = dto.actorCustomerId && series.customerId === dto.actorCustomerId
    const isProvider = dto.actorProviderId && series.providerId === dto.actorProviderId
    if (!isCustomer && !isProvider) {
      return Result.fail({ type: 'NOT_OWNER' })
    }

    // 3. Get future bookings in this series that are cancellable
    const now = new Date()
    const bookings = await this.deps.prisma.booking.findMany({
      where: {
        bookingSeriesId: dto.seriesId,
        bookingDate: { gte: now },
        status: { in: ['pending', 'confirmed'] },
      },
      select: {
        id: true,
        providerId: true,
        customerId: true,
      },
    })

    // 4. Cancel each future booking via BookingService
    let cancelledCount = 0
    for (const booking of bookings) {
      try {
        const authContext: { providerId?: string; customerId?: string } = {}
        if (dto.actorProviderId) authContext.providerId = dto.actorProviderId
        if (dto.actorCustomerId) authContext.customerId = dto.actorCustomerId

        const result = await this.deps.bookingService.updateStatus({
          bookingId: booking.id,
          newStatus: 'cancelled',
          ...authContext,
          cancellationMessage: dto.cancellationMessage || 'Serie avbruten',
        })

        if (result.isSuccess) {
          cancelledCount++
        }
      } catch (err) {
        logger.error(`Failed to cancel booking ${booking.id} in series ${dto.seriesId}`, { err })
      }
    }

    // 5. Update series status
    await this.deps.prisma.bookingSeries.update({
      where: { id: dto.seriesId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    })

    return Result.ok({ cancelledCount })
  }
}
