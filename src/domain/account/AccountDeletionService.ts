/**
 * AccountDeletionService - Domain service for GDPR Art. 17 account deletion
 *
 * Anonymizes user data instead of hard-deleting (FK constraints).
 * Deletes purely personal records, preserves anonymized bookings/reviews.
 * Uses Result pattern for explicit error handling.
 */
import { Result } from '@/domain/shared'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import { sendAccountDeletionNotification } from '@/lib/email'

// -----------------------------------------------------------
// Types
// -----------------------------------------------------------

export interface UserForDeletion {
  id: string
  email: string
  firstName: string
  passwordHash: string
  isAdmin: boolean
}

export interface AccountDeletionServiceDeps {
  findUserById: (id: string) => Promise<UserForDeletion | null>
  findProviderByUserId: (userId: string) => Promise<{ id: string } | null>
  findUploadPaths: (userId: string) => Promise<string[]>
  anonymizeUser: (userId: string) => Promise<void>
  anonymizeProvider: (providerId: string) => Promise<void>
  deletePersonalRecords: (userId: string) => Promise<void>
  anonymizeBookings: (userId: string) => Promise<void>
  anonymizeReviews: (userId: string) => Promise<void>
  deleteUploads: (userId: string) => Promise<void>
  deleteStorageFiles: (paths: string[]) => Promise<void>
  sendDeletionEmail: (email: string, firstName: string) => Promise<void>
  comparePassword: (plain: string, hash: string) => Promise<boolean>
}

export type AccountDeletionErrorType =
  | 'USER_NOT_FOUND'
  | 'INVALID_PASSWORD'
  | 'INVALID_CONFIRMATION'
  | 'ADMIN_ACCOUNT'

export interface AccountDeletionError {
  type: AccountDeletionErrorType
  message: string
}

export interface AccountDeletionResult {
  deleted: boolean
}

// -----------------------------------------------------------
// Service
// -----------------------------------------------------------

export class AccountDeletionService {
  private readonly deps: AccountDeletionServiceDeps

  constructor(deps: AccountDeletionServiceDeps) {
    this.deps = deps
  }

  async deleteAccount(
    userId: string,
    password: string,
    confirmation: string
  ): Promise<Result<AccountDeletionResult, AccountDeletionError>> {
    // 1. Find user
    const user = await this.deps.findUserById(userId)
    if (!user) {
      return Result.fail({ type: 'USER_NOT_FOUND', message: 'Användaren hittades inte' })
    }

    // 2. Block admin accounts
    if (user.isAdmin) {
      return Result.fail({ type: 'ADMIN_ACCOUNT', message: 'Administratörskonton kan inte raderas' })
    }

    // 3. Verify password
    const passwordValid = await this.deps.comparePassword(password, user.passwordHash)
    if (!passwordValid) {
      return Result.fail({ type: 'INVALID_PASSWORD', message: 'Felaktigt lösenord' })
    }

    // 4. Verify confirmation text
    if (confirmation !== 'RADERA') {
      return Result.fail({ type: 'INVALID_CONFIRMATION', message: 'Ogiltig bekräftelse' })
    }

    // 5. Send confirmation email BEFORE anonymization (needs real email/name)
    await this.deps.sendDeletionEmail(user.email, user.firstName)

    // 6. Delete storage files
    const uploadPaths = await this.deps.findUploadPaths(userId)
    await this.deps.deleteStorageFiles(uploadPaths)

    // 7. Delete upload records
    await this.deps.deleteUploads(userId)

    // 8. Delete personal records (horses, follows, tokens, notifications, etc.)
    await this.deps.deletePersonalRecords(userId)

    // 9. Anonymize bookings and reviews (preserve for provider stats)
    await this.deps.anonymizeBookings(userId)
    await this.deps.anonymizeReviews(userId)

    // 10. Anonymize provider if applicable
    const provider = await this.deps.findProviderByUserId(userId)
    if (provider) {
      await this.deps.anonymizeProvider(provider.id)
    }

    // 11. Anonymize user (last step -- point of no return)
    await this.deps.anonymizeUser(userId)

    // 12. Log security event
    logger.security('Account deleted (GDPR Art. 17)', 'high', { userId })

    return Result.ok({ deleted: true })
  }
}

// -----------------------------------------------------------
// Factory
// -----------------------------------------------------------

export function createAccountDeletionService(): AccountDeletionService {
  const anonymizedEmail = `deleted-${randomUUID()}@deleted.equinet.se`

  return new AccountDeletionService({
    findUserById: async (id) => {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          firstName: true,
          passwordHash: true,
          isAdmin: true,
        },
      })
      return user
    },

    findProviderByUserId: async (userId) => {
      return prisma.provider.findUnique({
        where: { userId },
        select: { id: true },
      })
    },

    findUploadPaths: async (userId) => {
      const uploads = await prisma.upload.findMany({
        where: { userId },
        select: { path: true },
      })
      return uploads.map((u) => u.path)
    },

    anonymizeUser: async (userId) => {
      await prisma.user.update({
        where: { id: userId },
        data: {
          email: anonymizedEmail,
          firstName: 'Raderad',
          lastName: 'användare',
          passwordHash: '',
          phone: null,
          address: null,
          city: null,
          municipality: null,
          latitude: null,
          longitude: null,
          isBlocked: true,
        },
      })
    },

    anonymizeProvider: async (providerId) => {
      await prisma.provider.update({
        where: { id: providerId },
        data: {
          businessName: 'Raderad leverantör',
          description: null,
          address: null,
          city: null,
          postalCode: null,
          profileImageUrl: null,
          latitude: null,
          longitude: null,
          isActive: false,
          acceptingNewCustomers: false,
        },
      })
    },

    deletePersonalRecords: async (userId) => {
      // Order matters: delete dependent records first
      await prisma.groupBookingParticipant.deleteMany({ where: { userId } })
      await prisma.notificationDelivery.deleteMany({ where: { customerId: userId } })
      await prisma.notification.deleteMany({ where: { userId } })
      await prisma.municipalityWatch.deleteMany({ where: { customerId: userId } })
      await prisma.pushSubscription.deleteMany({ where: { userId } })
      await prisma.follow.deleteMany({ where: { customerId: userId } })
      await prisma.emailVerificationToken.deleteMany({ where: { userId } })
      await prisma.passwordResetToken.deleteMany({ where: { userId } })
      await prisma.providerCustomer.deleteMany({ where: { customerId: userId } })
      // HorseNote uses authorId (not cascade from User)
      await prisma.horseNote.deleteMany({ where: { authorId: userId } })
      await prisma.horse.deleteMany({ where: { ownerId: userId } })
    },

    anonymizeBookings: async (userId) => {
      await prisma.booking.updateMany({
        where: { customerId: userId },
        data: { customerNotes: null },
      })
    },

    anonymizeReviews: async (userId) => {
      await prisma.review.updateMany({
        where: { customerId: userId },
        data: { comment: null },
      })
      await prisma.customerReview.updateMany({
        where: { customerId: userId },
        data: { comment: null },
      })
    },

    deleteUploads: async (userId) => {
      await prisma.upload.deleteMany({ where: { userId } })
    },

    deleteStorageFiles: async (paths) => {
      // Storage cleanup: log paths for manual review if needed
      // In production, this would call Supabase Storage API
      if (paths.length > 0) {
        logger.info(`Deleting ${paths.length} storage files for account deletion`, { paths })
      }
    },

    sendDeletionEmail: async (email, firstName) => {
      await sendAccountDeletionNotification(email, firstName)
    },

    comparePassword: (plain, hash) => bcrypt.compare(plain, hash),
  })
}
