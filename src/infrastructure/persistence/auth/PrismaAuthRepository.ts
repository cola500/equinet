/**
 * PrismaAuthRepository - Prisma implementation for Auth domain
 *
 * All queries use `select` (never `include`) to prevent data leaks.
 * Passwords are handled by Supabase Auth -- not stored in public.User.
 * verifyEmail uses $transaction for atomicity.
 */
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type {
  IAuthRepository,
  AuthUser,
  UserForResend,
  VerificationTokenWithUser,
  PasswordResetTokenWithUser,
  CustomerInviteTokenWithUser,
  CreateUserData,
  CreateProviderData,
  CreateVerificationTokenData,
  CreatePasswordResetTokenData,
  UpgradeGhostUserData,
} from './IAuthRepository'

const authUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  userType: true,
} satisfies Prisma.UserSelect

const resendSelect = {
  id: true,
  firstName: true,
  email: true,
  emailVerified: true,
} satisfies Prisma.UserSelect

// Verification token select (with user email via select, not include)
const verificationTokenSelect = {
  id: true,
  token: true,
  userId: true,
  expiresAt: true,
  usedAt: true,
  user: {
    select: { email: true },
  },
} satisfies Prisma.EmailVerificationTokenSelect

export class PrismaAuthRepository implements IAuthRepository {
  async findUserByEmail(email: string): Promise<{ id: string; isManualCustomer: boolean } | null> {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true, isManualCustomer: true },
    })
  }

  async upgradeGhostUser(data: UpgradeGhostUserData): Promise<AuthUser> {
    return prisma.user.update({
      where: { id: data.userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        isManualCustomer: false,
      },
      select: authUserSelect,
    })
  }

  async findUserForResend(email: string): Promise<UserForResend | null> {
    return prisma.user.findUnique({
      where: { email },
      select: resendSelect,
    })
  }

  async createUser(data: CreateUserData): Promise<AuthUser> {
    return prisma.user.create({
      data: {
        ...(data.id ? { id: data.id } : {}),
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        userType: data.userType,
      },
      select: authUserSelect,
    })
  }

  async createProvider(data: CreateProviderData): Promise<void> {
    await prisma.provider.create({
      data: {
        userId: data.userId,
        businessName: data.businessName,
        description: data.description,
        city: data.city,
      },
    })
  }

  async createVerificationToken(data: CreateVerificationTokenData): Promise<void> {
    await prisma.emailVerificationToken.create({
      data: {
        token: data.token,
        userId: data.userId,
        expiresAt: data.expiresAt,
      },
    })
  }

  async findVerificationToken(token: string): Promise<VerificationTokenWithUser | null> {
    const result = await prisma.emailVerificationToken.findUnique({
      where: { token },
      select: verificationTokenSelect,
    })

    if (!result) return null

    return {
      id: result.id,
      token: result.token,
      userId: result.userId,
      expiresAt: result.expiresAt,
      usedAt: result.usedAt,
      userEmail: result.user.email,
    }
  }

  async verifyEmail(userId: string, tokenId: string): Promise<void> {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.emailVerificationToken.update({
        where: { id: tokenId },
        data: { usedAt: new Date() },
      }),
    ])
  }

  // -----------------------------------------------------------
  // Password reset
  // -----------------------------------------------------------

  async createPasswordResetToken(data: CreatePasswordResetTokenData): Promise<void> {
    await prisma.passwordResetToken.create({
      data: {
        token: data.token,
        userId: data.userId,
        expiresAt: data.expiresAt,
      },
    })
  }

  async findPasswordResetToken(token: string): Promise<PasswordResetTokenWithUser | null> {
    const result = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: {
        id: true,
        token: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        user: {
          select: { email: true, firstName: true },
        },
      },
    })

    if (!result) return null

    return {
      id: result.id,
      token: result.token,
      userId: result.userId,
      expiresAt: result.expiresAt,
      usedAt: result.usedAt,
      userEmail: result.user.email,
      userFirstName: result.user.firstName,
    }
  }

  async invalidatePasswordResetTokens(userId: string): Promise<void> {
    await prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    })
  }

  async markResetTokenUsed(tokenId: string): Promise<void> {
    await prisma.passwordResetToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    })
  }

  async updateUserType(userId: string, userType: 'customer' | 'provider'): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { userType },
    })
  }

  // -----------------------------------------------------------
  // Customer invite
  // -----------------------------------------------------------

  async findCustomerInviteToken(token: string): Promise<CustomerInviteTokenWithUser | null> {
    const result = await prisma.customerInviteToken.findUnique({
      where: { token },
      select: {
        id: true,
        token: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        user: {
          select: { email: true, firstName: true },
        },
      },
    })

    if (!result) return null

    return {
      id: result.id,
      token: result.token,
      userId: result.userId,
      expiresAt: result.expiresAt,
      usedAt: result.usedAt,
      userEmail: result.user.email,
      userFirstName: result.user.firstName,
    }
  }

  async acceptInvite(userId: string, tokenId: string): Promise<void> {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          isManualCustomer: false,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.customerInviteToken.update({
        where: { id: tokenId },
        data: { usedAt: new Date() },
      }),
    ])
  }

  async executeMergeTransaction(ghostUserId: string, realUserId: string, requestingProviderId: string): Promise<void> {
    // @ts-expect-error - Prisma transaction callback type inference issue
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Redirect bookings
      await tx.booking.updateMany({ where: { customerId: ghostUserId }, data: { customerId: realUserId } })

      // 2. Redirect booking series
      await tx.bookingSeries.updateMany({ where: { customerId: ghostUserId }, data: { customerId: realUserId } })

      // 3. Redirect reviews
      await tx.review.updateMany({ where: { customerId: ghostUserId }, data: { customerId: realUserId } })

      // 4. Redirect customer reviews
      await tx.customerReview.updateMany({ where: { customerId: ghostUserId }, data: { customerId: realUserId } })

      // 5. Redirect horses
      await tx.horse.updateMany({ where: { ownerId: ghostUserId }, data: { ownerId: realUserId } })

      // 6. Handle ProviderCustomer (unique constraint) — migrate ALL providers, not just the requesting one
      const ghostLinks = await tx.providerCustomer.findMany({ where: { customerId: ghostUserId } })
      await tx.providerCustomer.deleteMany({ where: { customerId: ghostUserId } })
      for (const link of ghostLinks) {
        const existingLink = await tx.providerCustomer.findUnique({
          where: { providerId_customerId: { providerId: link.providerId, customerId: realUserId } },
        })
        if (!existingLink) {
          await tx.providerCustomer.create({ data: { providerId: link.providerId, customerId: realUserId } })
        }
      }

      // 7. Handle Follow (unique constraint)
      const ghostFollows = await tx.follow.findMany({ where: { customerId: ghostUserId } })
      for (const follow of ghostFollows) {
        const existingFollow = await tx.follow.findUnique({
          where: { customerId_providerId: { customerId: realUserId, providerId: follow.providerId } },
        })
        if (!existingFollow) {
          await tx.follow.update({ where: { id: follow.id }, data: { customerId: realUserId } })
        } else {
          await tx.follow.delete({ where: { id: follow.id } })
        }
      }

      // 8. Delete ghost's notification deliveries
      await tx.notificationDelivery.deleteMany({ where: { customerId: ghostUserId } })

      // 8b. Delete ghost's notifications (no cascade in schema)
      await tx.notification.deleteMany({ where: { userId: ghostUserId } })

      // 9. Delete ghost's municipality watches
      await tx.municipalityWatch.deleteMany({ where: { customerId: ghostUserId } })

      // 10. Redirect provider customer notes
      await tx.providerCustomerNote.updateMany({ where: { customerId: ghostUserId }, data: { customerId: realUserId } })

      // 11. Delete ghost user (cascades: tokens, push subscriptions)
      await tx.user.delete({ where: { id: ghostUserId } })
    })
  }
}
