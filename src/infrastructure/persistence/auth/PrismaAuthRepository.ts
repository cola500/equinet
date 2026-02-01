/**
 * PrismaAuthRepository - Prisma implementation for Auth domain
 *
 * All queries use `select` (never `include`) to prevent passwordHash leaks.
 * findUserWithCredentials is the ONLY method that returns passwordHash.
 * verifyEmail uses $transaction for atomicity.
 */
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type {
  IAuthRepository,
  AuthUser,
  AuthUserWithCredentials,
  UserForResend,
  VerificationTokenWithUser,
  CreateUserData,
  CreateProviderData,
  CreateVerificationTokenData,
} from './IAuthRepository'

// Safe user select (NEVER includes passwordHash)
const authUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  userType: true,
} satisfies Prisma.UserSelect

// Credentials select (ONLY used for login)
const credentialsSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  userType: true,
  passwordHash: true,
  emailVerified: true,
  provider: {
    select: { id: true },
  },
} satisfies Prisma.UserSelect

// Minimal select for resend-verification
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
  async findUserByEmail(email: string): Promise<{ id: string } | null> {
    return prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })
  }

  async findUserWithCredentials(email: string): Promise<AuthUserWithCredentials | null> {
    return prisma.user.findUnique({
      where: { email },
      select: credentialsSelect,
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
        email: data.email,
        passwordHash: data.passwordHash,
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
}
