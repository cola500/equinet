/**
 * PrismaBookingRepository - Prisma implementation of IBookingRepository
 */
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { BaseRepository } from '../BaseRepository'
import {
  IBookingRepository,
  Booking,
  BookingWithRelations,
  BookingWithQuickNoteContext,
  CreateBookingData,
  BookingWithCustomerLocation,
} from './IBookingRepository'
import { BookingMapper } from './BookingMapper'
import { logger } from '@/lib/logger'

// --- Named select blocks for consistent field selection ---
// See CLAUDE.md: "Nytt fält på modell: kontrollera ALLA select-block"

/** Service relation: name, price, duration. Used in all booking-with-relations queries. */
const SERVICE_SELECT = {
  select: { name: true, price: true, durationMinutes: true },
} as const

/** Provider relation (basic): businessName + user name. Used in most booking responses. */
const PROVIDER_SELECT = {
  select: {
    businessName: true,
    user: { select: { firstName: true, lastName: true } },
  },
} as const

/** Customer relation (full): name + contact. Used in provider-facing queries. */
const CUSTOMER_CONTACT_SELECT = {
  select: { firstName: true, lastName: true, email: true, phone: true },
} as const

/** Customer relation (minimal): name + email. Used in status change notifications. */
const CUSTOMER_EMAIL_SELECT = {
  select: { firstName: true, lastName: true, email: true },
} as const

/** Horse relation (full): id, name, breed, gender. Used in create/reschedule/notes. */
const HORSE_FULL_SELECT = {
  select: { id: true, name: true, breed: true, gender: true },
} as const

/** Horse relation (basic): id, name, breed. Used in list queries. */
const HORSE_BASIC_SELECT = {
  select: { id: true, name: true, breed: true },
} as const

export class PrismaBookingRepository
  extends BaseRepository<Booking>
  implements IBookingRepository
{
  private mapper: BookingMapper

  constructor() {
    super()
    this.mapper = new BookingMapper()
  }

  async findById(id: string): Promise<Booking | null> {
    const booking = await prisma.booking.findUnique({
      where: { id },
    })

    return booking ? this.mapper.toDomain(booking) : null
  }

  async findMany(criteria?: Record<string, unknown>): Promise<Booking[]> {
    const bookings = await prisma.booking.findMany({
      where: criteria,
      orderBy: { bookingDate: 'desc' },
    })

    return this.mapper.toDomainList(bookings)
  }

  async save(entity: Booking): Promise<Booking> {
    const data = this.mapper.toPersistence(entity)

    const saved = await prisma.booking.upsert({
      where: { id: entity.id },
      create: data,
      update: data,
    })

    return this.mapper.toDomain(saved)
  }

  async delete(id: string): Promise<void> {
    await prisma.booking.delete({
      where: { id },
    })
  }

  // ==========================================
  // AUTH-AWARE READ METHODS
  // ==========================================

  /**
   * Find booking by ID with atomic provider ownership check
   *
   * Uses findFirst with WHERE { id, providerId } for IDOR prevention.
   * Returns null if booking not found or provider doesn't own it.
   */
  async findByIdForProvider(
    id: string,
    providerId: string
  ): Promise<BookingWithQuickNoteContext | null> {
    const booking = await prisma.booking.findFirst({
      where: { id, providerId },
      select: {
        id: true,
        providerId: true,
        status: true,
        horseId: true,
        customer: { select: { firstName: true, lastName: true } },
        service: { select: { name: true } },
        horse: { select: { name: true, breed: true, specialNeeds: true } },
      },
    })

    return booking as BookingWithQuickNoteContext | null
  }

  /**
   * Find booking by ID with atomic customer ownership check
   *
   * Uses findFirst with WHERE { id, customerId } for IDOR prevention.
   * Returns null if booking not found or customer doesn't own it.
   */
  async findByIdForCustomer(
    id: string,
    customerId: string
  ): Promise<Booking | null> {
    const booking = await prisma.booking.findFirst({
      where: { id, customerId },
    })

    return booking ? this.mapper.toDomain(booking) : null
  }

  async findByCustomerId(customerId: string): Promise<Booking[]> {
    const bookings = await prisma.booking.findMany({
      where: { customerId },
      orderBy: { bookingDate: 'desc' },
    })

    return this.mapper.toDomainList(bookings)
  }

  async findByProviderId(providerId: string): Promise<Booking[]> {
    const bookings = await prisma.booking.findMany({
      where: { providerId },
      orderBy: { bookingDate: 'desc' },
    })

    return this.mapper.toDomainList(bookings)
  }

  async findOverlapping(
    providerId: string,
    date: Date,
    startTime: string,
    endTime: string
  ): Promise<Booking[]> {
    // Find bookings for the same provider on the same date
    const bookings = await prisma.booking.findMany({
      where: {
        providerId,
        bookingDate: date,
        status: {
          in: ['pending', 'confirmed'], // Only active bookings
        },
      },
    })

    // Filter for time overlap in application layer
    // (More complex time comparison logic can be added here)
    const overlapping = bookings.filter((booking: { startTime: string; endTime: string }) => {
      const bookingStart = this.parseTime(booking.startTime)
      const bookingEnd = this.parseTime(booking.endTime)
      const requestStart = this.parseTime(startTime)
      const requestEnd = this.parseTime(endTime)

      // Check for overlap: start1 < end2 && start2 < end1
      return bookingStart < requestEnd && requestStart < bookingEnd
    })

    return this.mapper.toDomainList(overlapping)
  }

  async findByStatus(status: Booking['status']): Promise<Booking[]> {
    const bookings = await prisma.booking.findMany({
      where: { status },
      orderBy: { bookingDate: 'desc' },
    })

    return this.mapper.toDomainList(bookings)
  }

  async findByProviderAndDate(providerId: string, date: Date): Promise<Booking[]> {
    const bookings = await prisma.booking.findMany({
      where: {
        providerId,
        bookingDate: date,
      },
      orderBy: { startTime: 'asc' },
    })

    return this.mapper.toDomainList(bookings)
  }

  /**
   * Find bookings for a provider on a specific date with customer location data
   *
   * Used for travel time validation between bookings.
   * Only returns active bookings (pending, confirmed).
   */
  async findByProviderAndDateWithLocation(
    providerId: string,
    date: Date
  ): Promise<BookingWithCustomerLocation[]> {
    const bookings = await prisma.booking.findMany({
      where: {
        providerId,
        bookingDate: date,
        status: {
          in: ['pending', 'confirmed'], // Only active bookings
        },
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        status: true,
        customer: {
          select: {
            latitude: true,
            longitude: true,
            address: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    })

    return bookings as BookingWithCustomerLocation[]
  }

  /**
   * Create booking with atomic overlap check (Serializable transaction)
   *
   * Uses database-level isolation to prevent race conditions where
   * two requests check for overlaps simultaneously and both succeed.
   *
   * @param data - Booking data to create
   * @returns Created booking with relations, or null if overlap detected
   */
  async createWithOverlapCheck(data: CreateBookingData): Promise<BookingWithRelations | null> {
    try {
      // Use Serializable isolation level for strongest consistency guarantee
      // This prevents phantom reads and ensures the overlap check is atomic
      // @ts-expect-error - Prisma transaction callback type inference issue
      const booking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Check for overlapping bookings within the transaction
        const overlappingBookings = await tx.booking.findMany({
          where: {
            providerId: data.providerId,
            bookingDate: data.bookingDate,
            status: {
              in: ['pending', 'confirmed'], // Only check active bookings
            },
            // Check for time overlap using OR conditions
            OR: [
              // New booking starts during an existing booking
              {
                AND: [
                  { startTime: { lte: data.startTime } },
                  { endTime: { gt: data.startTime } },
                ],
              },
              // New booking ends during an existing booking
              {
                AND: [
                  { startTime: { lt: data.endTime } },
                  { endTime: { gte: data.endTime } },
                ],
              },
              // New booking completely contains an existing booking
              {
                AND: [
                  { startTime: { gte: data.startTime } },
                  { endTime: { lte: data.endTime } },
                ],
              },
            ],
          },
        })

        if (overlappingBookings.length > 0) {
          // Signal overlap by throwing (will be caught below)
          throw new Error('BOOKING_OVERLAP')
        }

        // Create the booking atomically
        return await tx.booking.create({
          data: {
            customerId: data.customerId,
            providerId: data.providerId,
            serviceId: data.serviceId,
            routeOrderId: data.routeOrderId,
            bookingDate: data.bookingDate,
            startTime: data.startTime,
            endTime: data.endTime,
            horseId: data.horseId,
            horseName: data.horseName,
            horseInfo: data.horseInfo,
            customerNotes: data.customerNotes,
            travelTimeMinutes: data.travelTimeMinutes,
            isManualBooking: data.isManualBooking ?? false,
            createdByProviderId: data.createdByProviderId,
            bookingSeriesId: data.bookingSeriesId,
            status: data.status || 'pending',
          },
          select: {
            // Core booking fields
            id: true,
            customerId: true,
            providerId: true,
            serviceId: true,
            bookingDate: true,
            startTime: true,
            endTime: true,
            status: true,
            horseId: true,
            horseName: true,
            horseInfo: true,
            customerNotes: true,
            providerNotes: true,
            rescheduleCount: true,
            bookingSeriesId: true,
            isManualBooking: true,
            createdByProviderId: true,
            createdAt: true,
            updatedAt: true,

            // Relations for response
            customer: CUSTOMER_CONTACT_SELECT,
            service: SERVICE_SELECT,
            provider: PROVIDER_SELECT,
            horse: HORSE_FULL_SELECT,
          },
        })
      }, {
        timeout: 15000, // 15 second timeout
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })

      return booking as unknown as BookingWithRelations
    } catch (error) {
      // Handle overlap signal
      if (error instanceof Error && error.message === 'BOOKING_OVERLAP') {
        return null
      }

      // Re-throw other errors
      logger.error('Failed to create booking with overlap check', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  /**
   * Parse time string "HH:MM" to minutes since midnight
   */
  private parseTime(time: string): number {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  // ==========================================
  // QUERY METHODS (CQRS Query Side)
  // ==========================================

  /**
   * Find bookings for a provider with customer + service details
   *
   * Provider view - includes customer contact info (email, phone)
   * Uses `select` (not `include`) for security and performance
   */
  async findByProviderIdWithDetails(
    providerId: string
  ): Promise<BookingWithRelations[]> {
    const bookings = await prisma.booking.findMany({
      where: { providerId },
      select: {
        // Core booking fields
        id: true,
        customerId: true,
        providerId: true,
        serviceId: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        status: true,
        horseId: true,
        horseName: true,
        horseInfo: true,
        customerNotes: true,
        providerNotes: true,
        cancellationMessage: true,
        rescheduleCount: true,
        bookingSeriesId: true,
        routeOrderId: true,
        isManualBooking: true,
        createdByProviderId: true,

        // Relations - minimal data needed for provider view
        customer: CUSTOMER_CONTACT_SELECT,
        service: SERVICE_SELECT,
        horse: HORSE_BASIC_SELECT,
        // Payment information for provider view
        payment: {
          select: {
            id: true,
            status: true,
            amount: true,
            currency: true,
            paidAt: true,
            invoiceNumber: true,
          },
        },
        // Customer review (provider → customer) for provider view
        customerReview: {
          select: {
            id: true,
            rating: true,
            comment: true,
          },
        },
      },
      orderBy: { bookingDate: 'desc' },
    })

    return bookings as BookingWithRelations[]
  }

  /**
   * Find bookings for a customer with provider + service details
   *
   * Customer view - excludes provider contact info (email, phone)
   * Uses `select` (not `include`) for security and performance
   */
  async findByCustomerIdWithDetails(
    customerId: string
  ): Promise<BookingWithRelations[]> {
    const bookings = await prisma.booking.findMany({
      where: { customerId },
      select: {
        // Core booking fields
        id: true,
        customerId: true,
        providerId: true,
        serviceId: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        status: true,
        horseId: true,
        horseName: true,
        horseInfo: true,
        customerNotes: true,
        cancellationMessage: true,
        rescheduleCount: true,
        bookingSeriesId: true,
        routeOrderId: true,
        createdAt: true,
        updatedAt: true,

        // Relations - minimal data needed for customer view
        provider: {
          select: {
            businessName: true,
            rescheduleEnabled: true,
            rescheduleWindowHours: true,
            maxReschedules: true,
            rescheduleRequiresApproval: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        service: SERVICE_SELECT,
        horse: HORSE_BASIC_SELECT,
        // Payment information for customer view
        payment: {
          select: {
            id: true,
            status: true,
            amount: true,
            currency: true,
            paidAt: true,
            invoiceNumber: true,
            invoiceUrl: true,
          },
        },
        // Review for customer view (so they can see/edit their review + see provider reply)
        review: {
          select: {
            id: true,
            rating: true,
            comment: true,
            reply: true,
            repliedAt: true,
          },
        },
      },
      orderBy: { bookingDate: 'desc' },
    })

    return bookings as BookingWithRelations[]
  }

  // ==========================================
  // AUTH-AWARE COMMAND METHODS
  // ==========================================

  /**
   * Update booking status with atomic authorization check
   *
   * Uses WHERE clause with both id AND owner for IDOR prevention.
   * Returns null if booking not found or user not authorized.
   */
  async updateStatusWithAuth(
    id: string,
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show',
    authContext: { providerId?: string; customerId?: string },
    cancellationMessage?: string
  ): Promise<BookingWithRelations | null> {
    // Build atomic WHERE clause
    const whereClause: { id: string; providerId?: string; customerId?: string } = { id }

    if (authContext.providerId) {
      whereClause.providerId = authContext.providerId
    } else if (authContext.customerId) {
      whereClause.customerId = authContext.customerId
    } else {
      // No valid auth context provided
      return null
    }

    try {
      const updated = await prisma.booking.update({
        where: whereClause,
        data: {
          status,
          ...(cancellationMessage !== undefined && { cancellationMessage }),
        },
        select: {
          // Core booking fields
          id: true,
          customerId: true,
          providerId: true,
          serviceId: true,
          bookingDate: true,
          startTime: true,
          endTime: true,
          status: true,
          horseName: true,
          horseInfo: true,
          customerNotes: true,
          providerNotes: true,
          cancellationMessage: true,
          rescheduleCount: true,
          bookingSeriesId: true,
          createdAt: true,
          updatedAt: true,

          // Relations for email notification
          customer: CUSTOMER_EMAIL_SELECT,
          service: SERVICE_SELECT,
          provider: PROVIDER_SELECT,
        },
      })

      return updated as BookingWithRelations
    } catch (error) {
      // P2025: Record not found (booking doesn't exist or user doesn't own it)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      logger.error("Failed to update booking", error instanceof Error ? error : new Error(String(error)), { bookingId: id })
      throw error
    }
  }

  /**
   * Update provider notes with atomic authorization check
   *
   * Uses WHERE clause with both id AND providerId for IDOR prevention.
   * Returns null if booking not found or user not authorized.
   */
  async updateProviderNotesWithAuth(
    id: string,
    providerNotes: string | null,
    providerId: string
  ): Promise<BookingWithRelations | null> {
    try {
      const updated = await prisma.booking.update({
        where: { id, providerId },
        data: { providerNotes },
        select: {
          id: true,
          customerId: true,
          providerId: true,
          serviceId: true,
          bookingDate: true,
          startTime: true,
          endTime: true,
          status: true,
          horseId: true,
          horseName: true,
          horseInfo: true,
          customerNotes: true,
          providerNotes: true,
          cancellationMessage: true,
          rescheduleCount: true,
          bookingSeriesId: true,
          isManualBooking: true,
          createdByProviderId: true,
          createdAt: true,
          updatedAt: true,
          customer: CUSTOMER_CONTACT_SELECT,
          service: SERVICE_SELECT,
          horse: HORSE_FULL_SELECT,
        },
      })

      return updated as BookingWithRelations
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      throw error
    }
  }

  /**
   * Reschedule a booking with atomic overlap check
   *
   * Updates booking date/time and increments rescheduleCount in a serializable transaction.
   * Excludes the current booking from overlap detection.
   *
   * @returns Updated booking with relations, or null if overlap detected
   */
  async rescheduleWithOverlapCheck(
    bookingId: string,
    customerId: string,
    data: {
      bookingDate: Date
      startTime: string
      endTime: string
      providerId: string
      newStatus?: 'pending' | 'confirmed'
    }
  ): Promise<BookingWithRelations | null> {
    try {
      // @ts-expect-error - Prisma transaction callback type inference issue
      const booking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Check for overlapping bookings (excluding the current booking)
        const overlappingBookings = await tx.booking.findMany({
          where: {
            providerId: data.providerId,
            bookingDate: data.bookingDate,
            id: { not: bookingId }, // Exclude current booking
            status: { in: ['pending', 'confirmed'] },
            OR: [
              {
                AND: [
                  { startTime: { lte: data.startTime } },
                  { endTime: { gt: data.startTime } },
                ],
              },
              {
                AND: [
                  { startTime: { lt: data.endTime } },
                  { endTime: { gte: data.endTime } },
                ],
              },
              {
                AND: [
                  { startTime: { gte: data.startTime } },
                  { endTime: { lte: data.endTime } },
                ],
              },
            ],
          },
        })

        if (overlappingBookings.length > 0) {
          throw new Error('BOOKING_OVERLAP')
        }

        // Update the booking atomically
        return await tx.booking.update({
          where: { id: bookingId, customerId },
          data: {
            bookingDate: data.bookingDate,
            startTime: data.startTime,
            endTime: data.endTime,
            rescheduleCount: { increment: 1 },
            ...(data.newStatus && { status: data.newStatus }),
          },
          select: {
            id: true,
            customerId: true,
            providerId: true,
            serviceId: true,
            bookingDate: true,
            startTime: true,
            endTime: true,
            status: true,
            horseId: true,
            horseName: true,
            horseInfo: true,
            customerNotes: true,
            providerNotes: true,
            cancellationMessage: true,
            rescheduleCount: true,
            bookingSeriesId: true,
            isManualBooking: true,
            createdByProviderId: true,
            createdAt: true,
            updatedAt: true,
            customer: CUSTOMER_CONTACT_SELECT,
            service: SERVICE_SELECT,
            provider: PROVIDER_SELECT,
            horse: HORSE_FULL_SELECT,
          },
        })
      }, {
        timeout: 15000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })

      return booking as unknown as BookingWithRelations
    } catch (error) {
      if (error instanceof Error && error.message === 'BOOKING_OVERLAP') {
        return null
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      throw error
    }
  }

  /**
   * Reschedule a booking as provider with atomic overlap check
   *
   * Provider variant — uses providerId in WHERE clause instead of customerId.
   * No window/maxReschedule checks (those are customer-facing constraints).
   */
  async providerRescheduleWithOverlapCheck(
    bookingId: string,
    providerId: string,
    data: {
      bookingDate: Date
      startTime: string
      endTime: string
    }
  ): Promise<BookingWithRelations | null> {
    try {
      // @ts-expect-error - Prisma transaction callback type inference issue
      const booking = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const overlappingBookings = await tx.booking.findMany({
          where: {
            providerId,
            bookingDate: data.bookingDate,
            id: { not: bookingId },
            status: { in: ['pending', 'confirmed'] },
            OR: [
              {
                AND: [
                  { startTime: { lte: data.startTime } },
                  { endTime: { gt: data.startTime } },
                ],
              },
              {
                AND: [
                  { startTime: { lt: data.endTime } },
                  { endTime: { gte: data.endTime } },
                ],
              },
              {
                AND: [
                  { startTime: { gte: data.startTime } },
                  { endTime: { lte: data.endTime } },
                ],
              },
            ],
          },
        })

        if (overlappingBookings.length > 0) {
          throw new Error('BOOKING_OVERLAP')
        }

        return await tx.booking.update({
          where: { id: bookingId, providerId },
          data: {
            bookingDate: data.bookingDate,
            startTime: data.startTime,
            endTime: data.endTime,
          },
          select: {
            id: true,
            customerId: true,
            providerId: true,
            serviceId: true,
            bookingDate: true,
            startTime: true,
            endTime: true,
            status: true,
            horseId: true,
            horseName: true,
            horseInfo: true,
            customerNotes: true,
            providerNotes: true,
            cancellationMessage: true,
            rescheduleCount: true,
            bookingSeriesId: true,
            isManualBooking: true,
            createdByProviderId: true,
            createdAt: true,
            updatedAt: true,
            customer: CUSTOMER_CONTACT_SELECT,
            service: SERVICE_SELECT,
            provider: PROVIDER_SELECT,
            horse: HORSE_FULL_SELECT,
          },
        })
      }, {
        timeout: 15000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })

      return booking as unknown as BookingWithRelations
    } catch (error) {
      if (error instanceof Error && error.message === 'BOOKING_OVERLAP') {
        return null
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      throw error
    }
  }

  /**
   * Delete booking with atomic authorization check
   *
   * Uses WHERE clause with both id AND owner for IDOR prevention.
   * Returns false if booking not found or user not authorized.
   */
  async deleteWithAuth(
    id: string,
    authContext: { providerId?: string; customerId?: string }
  ): Promise<boolean> {
    // Build atomic WHERE clause
    const whereClause: { id: string; providerId?: string; customerId?: string } = { id }

    if (authContext.providerId) {
      whereClause.providerId = authContext.providerId
    } else if (authContext.customerId) {
      whereClause.customerId = authContext.customerId
    } else {
      // No valid auth context provided
      return false
    }

    try {
      await prisma.booking.delete({
        where: whereClause,
      })
      return true
    } catch (error) {
      // P2025: Record not found (booking doesn't exist or user doesn't own it)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return false
      }
      logger.error("Failed to delete booking", error instanceof Error ? error : new Error(String(error)), { bookingId: id })
      throw error
    }
  }
}
