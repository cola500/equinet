/**
 * PrismaMobileTokenRepository - Prisma implementation
 */
import { prisma } from "@/lib/prisma"
import type {
  IMobileTokenRepository,
  MobileToken,
  CreateMobileTokenData,
} from "./IMobileTokenRepository"

export class PrismaMobileTokenRepository implements IMobileTokenRepository {
  async create(data: CreateMobileTokenData): Promise<MobileToken> {
    return prisma.mobileToken.create({
      data: {
        token: data.token,
        userId: data.userId,
        deviceName: data.deviceName,
        expiresAt: data.expiresAt,
      },
      select: {
        id: true,
        token: true,
        userId: true,
        deviceName: true,
        lastUsedAt: true,
        revokedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    })
  }

  async findByTokenHash(tokenHash: string): Promise<MobileToken | null> {
    return prisma.mobileToken.findUnique({
      where: { token: tokenHash },
      select: {
        id: true,
        token: true,
        userId: true,
        deviceName: true,
        lastUsedAt: true,
        revokedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    })
  }

  async findById(id: string): Promise<MobileToken | null> {
    return prisma.mobileToken.findUnique({
      where: { id },
      select: {
        id: true,
        token: true,
        userId: true,
        deviceName: true,
        lastUsedAt: true,
        revokedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    })
  }

  async updateLastUsedAt(id: string): Promise<void> {
    await prisma.mobileToken.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    })
  }

  async revoke(id: string): Promise<void> {
    await prisma.mobileToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    })
  }

  async revokeAndCreate(
    revokeId: string,
    data: CreateMobileTokenData
  ): Promise<MobileToken> {
    const [, created] = await prisma.$transaction([
      prisma.mobileToken.update({
        where: { id: revokeId },
        data: { revokedAt: new Date() },
      }),
      prisma.mobileToken.create({
        data: {
          token: data.token,
          userId: data.userId,
          deviceName: data.deviceName,
          expiresAt: data.expiresAt,
        },
        select: {
          id: true,
          token: true,
          userId: true,
          deviceName: true,
          lastUsedAt: true,
          revokedAt: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
    ])
    return created
  }

  async countActiveForUser(userId: string): Promise<number> {
    return prisma.mobileToken.count({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    })
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await prisma.mobileToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return result.count
  }
}

// Singleton
export const mobileTokenRepository = new PrismaMobileTokenRepository()
