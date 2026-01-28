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
            // ❌ NEVER: passwordHash, role, userType
          },
        },
        service: {
          select: {
            name: true,
            price: true,
            durationMinutes: true,
            // ❌ NOT: isActive, createdAt, updatedAt (not needed for booking list)
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
            // ❌ NOT: invoiceUrl (provider doesn't need download link)
          },
        },
        // ❌ NO provider relation (provider already knows their own data)
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
                // ❌ NEVER: email, phone (prevents spam/unsolicited contact)
              },
            },
          },
        },
        service: {
          select: {
            name: true,
            price: true,
            durationMinutes: true,
            // ❌ NOT: isActive, createdAt, updatedAt
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
            // ❌ NOT: provider, providerPaymentId (internal details)
          },
        },
        // ❌ NO customer relation (customer already knows their own data)
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
