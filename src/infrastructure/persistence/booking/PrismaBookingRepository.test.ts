/**
 * Unit tests for the conditional writes in PrismaBookingRepository.
 *
 * Prisma is mocked: these tests verify the WHERE clauses that make the
 * BR-BOOK-001 check and the status write atomic. Row locking itself is
 * PostgreSQL behaviour and is not exercised here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

const { mockBooking } = vi.hoisted(() => ({
  mockBooking: {
    update: vi.fn(),
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    booking: mockBooking,
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({ booking: mockBooking })),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { PrismaBookingRepository } from './PrismaBookingRepository'

const BOOKING_ID = 'booking-1'
const bookingDate = new Date('2026-11-10T00:00:00.000Z')

function notFoundError() {
  return new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025',
    clientVersion: 'test',
  })
}

describe('PrismaBookingRepository – villkorade skrivningar', () => {
  let repo: PrismaBookingRepository

  beforeEach(() => {
    vi.clearAllMocks()
    mockBooking.findMany.mockResolvedValue([])
    repo = new PrismaBookingRepository()
  })

  describe('updateStatusWithAuth', () => {
    it('lägger kontrollerade värden i samma WHERE som id och ägare', async () => {
      mockBooking.update.mockResolvedValue({ id: BOOKING_ID, status: 'completed' })

      await repo.updateStatusWithAuth(BOOKING_ID, 'completed', { providerId: 'provider-1' }, undefined, {
        status: 'confirmed',
        bookingDate,
        endTime: '11:00',
        timezone: 'Europe/Stockholm',
      })

      expect(mockBooking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: BOOKING_ID,
            providerId: 'provider-1',
            status: 'confirmed',
            bookingDate,
            endTime: '11:00',
            timezone: 'Europe/Stockholm',
          },
        })
      )
    })

    it('utan villkor används bara id och ägare (oförändrat beteende)', async () => {
      mockBooking.update.mockResolvedValue({ id: BOOKING_ID, status: 'confirmed' })

      await repo.updateStatusWithAuth(BOOKING_ID, 'confirmed', { providerId: 'provider-1' })

      expect(mockBooking.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: BOOKING_ID, providerId: 'provider-1' } })
      )
    })

    it('ingen rad matchar villkoren (P2025) ger null', async () => {
      mockBooking.update.mockRejectedValue(notFoundError())

      const result = await repo.updateStatusWithAuth(
        BOOKING_ID,
        'completed',
        { providerId: 'provider-1' },
        undefined,
        { status: 'confirmed', bookingDate, endTime: '11:00', timezone: 'Europe/Stockholm' }
      )

      expect(result).toBeNull()
    })
  })

  describe('ombokning skriver inte över en utförd bokning', () => {
    const newSlot = { bookingDate, startTime: '14:00', endTime: '15:00' }

    it('kundens ombokning villkoras på status pending/confirmed', async () => {
      mockBooking.update.mockResolvedValue({ id: BOOKING_ID })

      await repo.rescheduleWithOverlapCheck(BOOKING_ID, 'customer-1', { ...newSlot, providerId: 'provider-1' })

      expect(mockBooking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BOOKING_ID, customerId: 'customer-1', status: { in: ['pending', 'confirmed'] } },
        })
      )
    })

    it('leverantörens ombokning villkoras på status pending/confirmed', async () => {
      mockBooking.update.mockResolvedValue({ id: BOOKING_ID })

      await repo.providerRescheduleWithOverlapCheck(BOOKING_ID, 'provider-1', newSlot)

      expect(mockBooking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BOOKING_ID, providerId: 'provider-1', status: { in: ['pending', 'confirmed'] } },
        })
      )
    })
  })
})
