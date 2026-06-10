/**
 * Ghost user creation -- shared utility for creating manual customers
 *
 * Used by BookingService (manual bookings) and provider/customers (add customer).
 * A "ghost user" is a placeholder User that cannot log in, created by a provider
 * on behalf of a customer who doesn't have an account.
 * No password is set -- ghost users have no Supabase Auth entry.
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
 * Thrown when a provider attempts to add a customer with an email that
 * belongs to a registered user. Reusing such an account would let the
 * provider rewrite the victim's profile and intercept password resets.
 * See fixes.txt finding C1.
 */
export class GhostUserError extends Error {
  constructor(public readonly code: 'EMAIL_BELONGS_TO_REGISTERED_USER') {
    super('E-postadressen tillhör en registrerad användare')
    this.name = 'GhostUserError'
  }
}

/**
 * Create a ghost user or return existing user ID if email matches.
 *
 * Reuse is only permitted when the existing row is itself a manual customer
 * (isManualCustomer === true). Registered users are off-limits — see
 * GhostUserError above.
 *
 * @returns The user ID (new or existing manual customer)
 * @throws {GhostUserError} when email belongs to a registered (non-manual) user
 */
export async function createGhostUser(data: CreateGhostUserData): Promise<string> {
  const { randomUUID } = await import('crypto')

  const email = data.email || `manual-${randomUUID()}@ghost.equinet.se`

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isManualCustomer: true },
  })
  if (existing) {
    if (!existing.isManualCustomer) {
      logger.security(
        'Ghost user creation blocked: email belongs to registered user',
        'high',
        { existingUserId: existing.id }
      )
      throw new GhostUserError('EMAIL_BELONGS_TO_REGISTERED_USER')
    }
    logger.info("Reusing existing manual customer", {
      existingUserId: existing.id,
    })
    return existing.id
  }

  const user = await prisma.user.create({
    data: {
      email,
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
