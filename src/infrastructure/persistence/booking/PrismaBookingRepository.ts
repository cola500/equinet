/**
 * PrismaBookingRepository - Prisma implementation of IBookingRepository
 */
import { prisma } from '@/lib/prisma'
import { BaseRepository } from '../BaseRepository'
import { IBookingRepository, Booking } from './IBookingRepository'
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
}
