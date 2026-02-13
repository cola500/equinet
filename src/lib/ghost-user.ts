/**
 * Ghost user creation -- shared utility for creating manual customers
 *
 * Used by BookingService (manual bookings) and provider/customers (add customer).
 * A "ghost user" is a placeholder User that cannot log in, created by a provider
 * on behalf of a customer who doesn't have an account.
 */
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export interface CreateGhostUserData {
  firstName: string
  lastName?: string
  phone?: string
  email?: string
}

/**
 * Create a ghost user or return existing user ID if email matches.
 *
 * @returns The user ID (new or existing)
 */
export async function createGhostUser(data: CreateGhostUserData): Promise<string> {
  const { randomUUID } = await import('crypto')
  const bcrypt = await import('bcrypt')

  const email = data.email || `manual-${randomUUID()}@ghost.equinet.se`

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    logger.info("Reusing existing user for manual customer", {
      existingUserId: existing.id,
    })
    return existing.id
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(randomUUID(), 10),
      userType: 'customer',
      firstName: data.firstName,
      lastName: data.lastName || '',
      phone: data.phone,
      isManualCustomer: true,
      emailVerified: false,
    },
  })

  logger.security("Ghost user created", "low", {
    ghostUserId: user.id,
    emailType: data.email ? 'real' : 'sentinel',
    hasPhone: !!data.phone,
  })

  return user.id
}
