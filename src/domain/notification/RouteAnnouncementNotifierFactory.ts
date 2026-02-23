/**
 * Factory for creating RouteAnnouncementNotifier with production dependencies.
 * Async because it checks the due_for_service feature flag.
 */
import { RouteAnnouncementNotifier } from "./RouteAnnouncementNotifier"
import { notificationService } from "./NotificationService"
import { followRepository } from "@/infrastructure/persistence/follow/FollowRepository"
import { emailService } from "@/lib/email/email-service"
import { prisma } from "@/lib/prisma"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { PrismaDueForServiceLookup } from "@/domain/due-for-service/DueForServiceLookup"

export async function createRouteAnnouncementNotifier(): Promise<RouteAnnouncementNotifier> {
  const dueForServiceEnabled = await isFeatureEnabled("due_for_service")

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
    dueForServiceLookup: dueForServiceEnabled
      ? new PrismaDueForServiceLookup()
      : undefined,
  })
}
