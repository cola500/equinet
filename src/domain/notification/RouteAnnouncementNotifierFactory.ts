/**
 * Factory for creating RouteAnnouncementNotifier with production dependencies
 */
import { RouteAnnouncementNotifier } from "./RouteAnnouncementNotifier"
import { notificationService } from "./NotificationService"
import { followRepository } from "@/infrastructure/persistence/follow/FollowRepository"
import { emailService } from "@/lib/email/email-service"
import { prisma } from "@/lib/prisma"

export function createRouteAnnouncementNotifier(): RouteAnnouncementNotifier {
  return new RouteAnnouncementNotifier({
    followRepo: followRepository,
    notificationService,
    emailService,
    routeOrderLookup: {
      findById: async (id: string) => {
        const result = await prisma.routeOrder.findUnique({
          where: { id },
          select: {
            id: true,
            municipality: true,
            dateFrom: true,
            dateTo: true,
            provider: {
              select: {
                id: true,
                businessName: true,
              },
            },
            services: {
              select: { name: true },
            },
          },
        })
        // Route announcements always have a provider, but schema allows null
        if (!result || !result.provider) return null
        return { ...result, provider: result.provider }
      },
    },
    deliveryStore: {
      exists: async (routeOrderId: string, customerId: string, channel: string) => {
        const count = await prisma.notificationDelivery.count({
          where: { routeOrderId, customerId, channel },
        })
        return count > 0
      },
      create: async (routeOrderId: string, customerId: string, channel: string) => {
        await prisma.notificationDelivery.create({
          data: { routeOrderId, customerId, channel },
        })
      },
    },
  })
}
