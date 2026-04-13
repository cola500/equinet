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
}
