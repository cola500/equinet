/**
 * FollowServiceFactory - Creates FollowService with production dependencies
 */
import { FollowService } from "./FollowService"
import { FollowRepository } from "@/infrastructure/persistence/follow/FollowRepository"
import { prisma } from "@/lib/prisma"

export function createFollowService(): FollowService {
  return new FollowService(new FollowRepository(), {
    findProvider: async (id: string) => {
      return prisma.provider.findUnique({
        where: { id },
        select: { isActive: true },
      })
    },
  })
}
