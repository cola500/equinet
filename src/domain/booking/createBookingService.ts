/**
 * @domain booking
 *
 * Factory function for creating BookingService with production dependencies.
 * Extracted from BookingService.ts to separate DI wiring from business logic.
 */
import { BookingService } from './BookingService'
import { PrismaBookingRepository } from '@/infrastructure/persistence/booking/PrismaBookingRepository'
import { TravelTimeService } from './TravelTimeService'
import { prisma } from '@/lib/prisma'

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
