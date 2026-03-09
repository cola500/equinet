/**
 * PrismaStableInviteRepository - Prisma implementation for stable invite tokens
 *
 * All queries use `select` (never `include`) to prevent data leaks.
 */
import { prisma } from "@/lib/prisma"
import type {
  IStableInviteRepository,
  CreateStableInviteData,
  StableInviteTokenWithStable,
  StableInviteListItem,
} from "./IStableInviteRepository"

export class PrismaStableInviteRepository implements IStableInviteRepository {
  async create(data: CreateStableInviteData): Promise<void> {
    await prisma.stableInviteToken.create({
      data: {
        token: data.token,
        email: data.email,
        stableId: data.stableId,
        expiresAt: data.expiresAt,
      },
    })
  }

  async findByToken(token: string): Promise<StableInviteTokenWithStable | null> {
    const result = await prisma.stableInviteToken.findUnique({
      where: { token },
      select: {
        id: true,
        token: true,
        email: true,
        stableId: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
        stable: {
          select: {
            name: true,
            municipality: true,
          },
        },
      },
    })

    if (!result) return null

    return {
      id: result.id,
      token: result.token,
      email: result.email,
      stableId: result.stableId,
      expiresAt: result.expiresAt,
      usedAt: result.usedAt,
      createdAt: result.createdAt,
      stableName: result.stable.name,
      stableMunicipality: result.stable.municipality,
    }
  }

  async findByStableId(stableId: string): Promise<StableInviteListItem[]> {
    return prisma.stableInviteToken.findMany({
      where: { stableId },
      select: {
        id: true,
        token: true,
        email: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })
  }

  async invalidatePending(email: string, stableId: string): Promise<void> {
    await prisma.stableInviteToken.updateMany({
      where: { email, stableId, usedAt: null },
      data: { usedAt: new Date() },
    })
  }

  async markUsed(tokenId: string): Promise<void> {
    await prisma.stableInviteToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    })
  }

  async revoke(id: string, stableId: string): Promise<boolean> {
    const result = await prisma.stableInviteToken.updateMany({
      where: { id, stableId, usedAt: null },
      data: { usedAt: new Date() },
    })
    return result.count > 0
  }
}
