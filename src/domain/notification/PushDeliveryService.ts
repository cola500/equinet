import { prisma } from "@/lib/prisma"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { logger } from "@/lib/logger"

export interface PushPayload {
  title: string
  body: string
  url?: string // Deep link path, e.g. "/provider/bookings"
  category?: string // UNNotificationCategory, e.g. "BOOKING_REQUEST"
  bookingId?: string // For actionable notifications
  badge?: number
}

/**
 * Send push notifications to user devices via APNs.
 *
 * Fire-and-forget: logs errors, never throws.
 * APNs sending requires env vars: APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_P8, APNS_BUNDLE_ID
 */
export class PushDeliveryService {
  /**
   * Send push notification to all devices for a user.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    try {
      if (!(await isFeatureEnabled("push_notifications"))) return

      const tokens = await prisma.deviceToken.findMany({
        where: { userId },
        select: { token: true, platform: true },
      })

      if (tokens.length === 0) return

      const iosTokens = tokens.filter((t) => t.platform === "ios")
      if (iosTokens.length === 0) return

      await Promise.allSettled(
        iosTokens.map((t) => this.sendAPNs(t.token, payload))
      )
    } catch (error) {
      logger.error(
        "Push delivery failed",
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Send push to multiple users in parallel.
   */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    await Promise.allSettled(
      userIds.map((uid) => this.sendToUser(uid, payload))
    )
  }

  /**
   * Send a single push notification via APNs HTTP/2.
   *
   * Requires env vars: APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_P8, APNS_BUNDLE_ID
   * When credentials are not configured, logs a warning and skips.
   * On 410 Gone (invalid token), removes the token from the database.
   */
  private async sendAPNs(
    deviceToken: string,
    payload: PushPayload
  ): Promise<void> {
    const keyId = process.env.APNS_KEY_ID
    const teamId = process.env.APNS_TEAM_ID
    const keyP8 = process.env.APNS_KEY_P8
    const bundleId = process.env.APNS_BUNDLE_ID || "com.equinet.app"
    const isProduction = process.env.APNS_PRODUCTION === "true"

    if (!keyId || !teamId || !keyP8) {
      logger.warn("APNs credentials not configured, skipping push delivery", {
        deviceToken: deviceToken.substring(0, 8) + "...",
      })
      return
    }

    try {
      // Dynamic import to avoid loading apns2 when not needed
      const { ApnsClient, Notification } = await import("apns2")

      const client = new ApnsClient({
        team: teamId,
        keyId: keyId,
        signingKey: keyP8.replace(/\\n/g, "\n"),
        defaultTopic: bundleId,
        host: isProduction
          ? "api.push.apple.com"
          : "api.sandbox.push.apple.com",
      })

      const notification = new Notification(deviceToken, {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        badge: payload.badge,
        sound: "default",
        data: {
          ...(payload.url ? { url: payload.url } : {}),
          ...(payload.bookingId ? { bookingId: payload.bookingId } : {}),
          ...(payload.category
            ? { aps: { category: payload.category } }
            : {}),
        },
      })

      await client.send(notification)

      logger.info("Push notification sent", {
        deviceToken: deviceToken.substring(0, 8) + "...",
        title: payload.title,
      })
    } catch (error) {
      // APNs returns 410 when device token is no longer valid
      if (error instanceof Error && error.message?.includes("410")) {
        logger.info("Removing invalid device token (410 Gone)", {
          deviceToken: deviceToken.substring(0, 8) + "...",
        })
        await prisma.deviceToken.deleteMany({
          where: { token: deviceToken },
        })
        return
      }

      logger.error(
        "APNs send failed",
        error instanceof Error ? error : new Error(String(error)),
        { deviceToken: deviceToken.substring(0, 8) + "..." }
      )
    }
  }
}

export const pushDeliveryService = new PushDeliveryService()
