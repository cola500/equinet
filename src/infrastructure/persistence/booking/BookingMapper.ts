/**
 * BookingMapper - Maps between Booking domain entity and Prisma model
 */
import { IMapper } from '../BaseRepository'
import { Booking } from './IBookingRepository'
import type { Booking as PrismaBooking } from '@prisma/client'

export class BookingMapper implements IMapper<Booking, PrismaBooking> {
  toDomain(prisma: PrismaBooking): Booking {
    return {
      id: prisma.id,
      customerId: prisma.customerId,
      providerId: prisma.providerId,
      serviceId: prisma.serviceId,
      routeOrderId: prisma.routeOrderId ?? undefined,
      bookingDate: prisma.bookingDate,
      startTime: prisma.startTime,
      endTime: prisma.endTime,
      timezone: prisma.timezone,
      status: prisma.status as Booking['status'],
      horseId: prisma.horseId ?? undefined,
      horseName: prisma.horseName ?? undefined,
      horseInfo: prisma.horseInfo ?? undefined,
      notes: prisma.customerNotes ?? undefined,
      travelTimeMinutes: prisma.travelTimeMinutes ?? undefined,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    }
  }

  toPersistence(domain: Booking): PrismaBooking {
    return {
      id: domain.id,
      customerId: domain.customerId,
      providerId: domain.providerId,
      serviceId: domain.serviceId,
      routeOrderId: domain.routeOrderId ?? null,
      bookingDate: domain.bookingDate,
      startTime: domain.startTime,
      endTime: domain.endTime,
      timezone: domain.timezone,
      status: domain.status,
      horseId: domain.horseId ?? null,
      horseName: domain.horseName ?? null,
      horseInfo: domain.horseInfo ?? null,
      customerNotes: domain.notes ?? null,
      travelTimeMinutes: domain.travelTimeMinutes ?? null,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
    }
  }

  toDomainList(prisma: PrismaBooking[]): Booking[] {
    return prisma.map((p) => this.toDomain(p))
  }

  toPersistenceList(domain: Booking[]): PrismaBooking[] {
    return domain.map((d) => this.toPersistence(d))
  }
}
