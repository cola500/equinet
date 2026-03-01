/**
 * PrismaInviteRepository - Prisma implementation for invite tokens
 *
 * All queries use `select` (never `include`) to prevent data leaks.
 * acceptInvite uses $transaction for atomicity.
 */
import { prisma } from '@/lib/prisma'
import type {
  IInviteRepository,
  CreateInviteTokenData,
  InviteTokenWithUser,
} from './IInviteRepository'

export class PrismaInviteRepository implements IInviteRepository {
  async createInviteToken(data: CreateInviteTokenData): Promise<void> {
    await prisma.customerInviteToken.create({
      data: {
        token: data.token,
        userId: data.userId,
        invitedByProviderId: data.invitedByProviderId,
        expiresAt: data.expiresAt,
      },
    })
  }

  async findInviteToken(token: string): Promise<InviteTokenWithUser | null> {
    const result = await prisma.customerInviteToken.findUnique({
      where: { token },
      select: {
        id: true,
        token: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
        user: {
          select: {
            email: true,
            firstName: true,
            isManualCustomer: true,
          },
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
      isManualCustomer: result.user.isManualCustomer,
    }
  }

  async invalidatePendingInvites(userId: string): Promise<void> {
    await prisma.customerInviteToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    })
  }

  async acceptInvite(tokenId: string, userId: string, passwordHash: string): Promise<void> {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
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
