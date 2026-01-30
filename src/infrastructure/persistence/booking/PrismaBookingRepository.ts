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
  CreateBookingData,
  BookingWithCustomerLocation,
} from './IBookingRepository'
import { BookingMapper } from './BookingMapper'

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

  async findMany(criteria?: Record<string, any>): Promise<Booking[]> {
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
            status: 'pending',
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
            createdAt: true,
            updatedAt: true,

            // Relations for response
            customer: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            service: {
              select: {
                name: true,
                price: true,
                durationMinutes: true,
              },
            },
            provider: {
              select: {
                businessName: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            horse: {
              select: {
                id: true,
                name: true,
                breed: true,
                gender: true,
              },
            },
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
      console.error('Failed to create booking with overlap check:', error)
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
        createdAt: true,
        updatedAt: true,

        // Relations - minimal data needed for provider view
        customer: {
          select: {
            firstName: true,
            lastName: true,
            email: true, // Provider CAN see customer contact
            phone: true, // Provider needs to contact customer
          },
        },
        service: {
          select: {
            name: true,
            price: true,
            durationMinutes: true,
          },
        },
        horse: {
          select: {
            id: true,
            name: true,
            breed: true,
            gender: true,
          },
        },
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
        createdAt: true,
        updatedAt: true,

        // Relations - minimal data needed for customer view
        provider: {
          select: {
            businessName: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        service: {
          select: {
            name: true,
            price: true,
            durationMinutes: true,
          },
        },
        horse: {
          select: {
            id: true,
            name: true,
            breed: true,
            gender: true,
          },
        },
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
        // Review for customer view (so they can see/edit their review)
        review: {
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
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed',
    authContext: { providerId?: string; customerId?: string }
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
        data: { status },
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
          createdAt: true,
          updatedAt: true,

          // Relations for email notification
          customer: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          service: {
            select: {
              name: true,
              price: true,
              durationMinutes: true,
            },
          },
          provider: {
            select: {
              businessName: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      })

      return updated as BookingWithRelations
    } catch (error) {
      // P2025: Record not found (booking doesn't exist or user doesn't own it)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null
      }
      console.error(`Failed to update booking ${id}:`, error)
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
      console.error(`Failed to delete booking ${id}:`, error)
      throw error
    }
  }
}
