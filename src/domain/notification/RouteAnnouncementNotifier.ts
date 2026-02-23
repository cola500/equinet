/**
 * RouteAnnouncementNotifier - Notifies followers when a provider
 * creates a new route announcement in their municipality.
 *
 * If dueForServiceLookup is provided, followers with overdue horses
 * get a personalized notification mentioning their horse by name.
 *
 * Channels: in-app notification + email. Push is stub (schema only).
 * Dedup via NotificationDelivery table.
 */
import { logger } from "@/lib/logger"
import type { IFollowRepository } from "@/infrastructure/persistence/follow/IFollowRepository"
import type { NotificationService, NotificationTypeValue } from "./NotificationService"
import { NotificationType } from "./NotificationService"
import type {
  DueForServiceLookup,
  OverdueHorseInfo,
} from "@/domain/due-for-service/DueForServiceLookup"

interface RouteOrderData {
  id: string
  municipality: string | null
  dateFrom: Date
  dateTo: Date
  provider: {
    id: string
    businessName: string
  }
  services: { name: string }[]
}

interface RouteOrderLookup {
  findById(id: string): Promise<RouteOrderData | null>
}

interface DeliveryStore {
  exists(routeOrderId: string, customerId: string, channel: string): Promise<boolean>
  create(routeOrderId: string, customerId: string, channel: string): Promise<void>
}

interface EmailService {
  send(options: { to: string; subject: string; html: string; text?: string }): Promise<{ success: boolean }>
}

interface NotifierDeps {
  followRepo: IFollowRepository
  notificationService: NotificationService
  emailService: EmailService
  routeOrderLookup: RouteOrderLookup
  deliveryStore: DeliveryStore
  dueForServiceLookup?: DueForServiceLookup
}

export function formatDaysAgo(days: number): string {
  if (days === 0) return "idag"
  if (days < 7) return days === 1 ? "1 dag sedan" : `${days} dagar sedan`
  const weeks = Math.floor(days / 7)
  return weeks === 1 ? "1 vecka sedan" : `${weeks} veckor sedan`
}

export class RouteAnnouncementNotifier {
  private followRepo: IFollowRepository
  private notificationService: NotificationService
  private emailService: EmailService
  private routeOrderLookup: RouteOrderLookup
  private deliveryStore: DeliveryStore
  private dueForServiceLookup?: DueForServiceLookup

  constructor(deps: NotifierDeps) {
    this.followRepo = deps.followRepo
    this.notificationService = deps.notificationService
    this.emailService = deps.emailService
    this.routeOrderLookup = deps.routeOrderLookup
    this.deliveryStore = deps.deliveryStore
    this.dueForServiceLookup = deps.dueForServiceLookup
  }

  async notifyFollowersOfNewRoute(routeOrderId: string): Promise<void> {
    const routeOrder = await this.routeOrderLookup.findById(routeOrderId)
    if (!routeOrder) {
      logger.warn("RouteAnnouncementNotifier: route order not found", { routeOrderId })
      return
    }

    if (!routeOrder.municipality) {
      logger.info("RouteAnnouncementNotifier: no municipality, skipping", { routeOrderId })
      return
    }

    const followers = await this.followRepo.findFollowersInMunicipality(
      routeOrder.provider.id,
      routeOrder.municipality
    )

    if (followers.length === 0) {
      logger.info("RouteAnnouncementNotifier: no followers in municipality", {
        routeOrderId,
        municipality: routeOrder.municipality,
      })
      return
    }

    // Batch-fetch overdue horses for all followers (if lookup available)
    let overdueByCustomer: Map<string, OverdueHorseInfo[]> | undefined
    if (this.dueForServiceLookup) {
      try {
        const customerIds = followers.map((f) => f.userId)
        overdueByCustomer =
          await this.dueForServiceLookup.getOverdueHorsesForCustomers(customerIds)
      } catch (error) {
        logger.error(
          "RouteAnnouncementNotifier: due-for-service lookup failed, falling back to standard",
          error instanceof Error ? error : new Error(String(error))
        )
        // Fall through: overdueByCustomer remains undefined -> all get standard
      }
    }

    let notified = 0
    let skipped = 0

    for (const follower of followers) {
      // Dedup check: already notified for this route order?
      const alreadyDelivered = await this.deliveryStore.exists(
        routeOrderId,
        follower.userId,
        "in_app"
      )
      if (alreadyDelivered) {
        skipped++
        continue
      }

      const serviceNames = routeOrder.services.map(s => s.name).join(", ")
      const dateStr = formatDateRange(routeOrder.dateFrom, routeOrder.dateTo)

      // Check for overdue horses for this follower
      const overdueHorses = overdueByCustomer?.get(follower.userId)
      const topOverdue = overdueHorses?.[0] // most overdue (pre-sorted)

      let message: string
      let notificationType: NotificationTypeValue
      let metadata: Record<string, string>
      let emailSubject: string
      let overdueForEmail: { horseName: string; serviceName: string; timeAgo: string } | undefined

      if (topOverdue) {
        const timeAgo = formatDaysAgo(topOverdue.daysOverdue)
        message = `${topOverdue.horseName} behövde ${topOverdue.serviceName.toLowerCase()} för ${timeAgo}. ${routeOrder.provider.businessName} har lediga tider i ${routeOrder.municipality} (${dateStr}).`
        notificationType = NotificationType.ROUTE_ANNOUNCEMENT_DUE_HORSE
        metadata = {
          routeOrderId,
          providerId: routeOrder.provider.id,
          municipality: routeOrder.municipality,
          overdueHorseName: topOverdue.horseName,
        }
        emailSubject = `${topOverdue.horseName} behöver service - ${routeOrder.provider.businessName} i ${routeOrder.municipality}`
        overdueForEmail = {
          horseName: topOverdue.horseName,
          serviceName: topOverdue.serviceName,
          timeAgo,
        }
      } else {
        message = `${routeOrder.provider.businessName} har annonserat nya tider i ${routeOrder.municipality} (${dateStr}). Tjänster: ${serviceNames}`
        notificationType = NotificationType.ROUTE_ANNOUNCEMENT_NEW
        metadata = {
          routeOrderId,
          providerId: routeOrder.provider.id,
          municipality: routeOrder.municipality,
        }
        emailSubject = `Ny ruttannons i ${routeOrder.municipality} - ${routeOrder.provider.businessName}`
      }

      // In-app notification
      await this.notificationService.createAsync({
        userId: follower.userId,
        type: notificationType,
        message,
        linkUrl: "/customer/announcements",
        metadata,
      })
      await this.deliveryStore.create(routeOrderId, follower.userId, "in_app")

      // Email (fire-and-forget, errors don't block)
      try {
        const { html, text } = routeAnnouncementEmail({
          firstName: follower.firstName,
          businessName: routeOrder.provider.businessName,
          municipality: routeOrder.municipality,
          dateRange: dateStr,
          serviceNames,
          announcementUrl: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/customer/announcements`,
          overdueHorse: overdueForEmail,
        })

        await this.emailService.send({
          to: follower.email,
          subject: emailSubject,
          html,
          text,
        })
        await this.deliveryStore.create(routeOrderId, follower.userId, "email")
      } catch (error) {
        logger.error(
          "RouteAnnouncementNotifier: email failed",
          error instanceof Error ? error : new Error(String(error))
        )
      }

      notified++
    }

    logger.info("RouteAnnouncementNotifier: done", {
      routeOrderId,
      municipality: routeOrder.municipality,
      notified,
      skipped,
    })
  }
}

function formatDateRange(from: Date, to: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
  const fromStr = from.toLocaleDateString("sv-SE", opts)
  const toStr = to.toLocaleDateString("sv-SE", opts)
  return fromStr === toStr ? fromStr : `${fromStr} - ${toStr}`
}

// Email template
interface RouteAnnouncementEmailData {
  firstName: string
  businessName: string
  municipality: string
  dateRange: string
  serviceNames: string
  announcementUrl: string
  overdueHorse?: {
    horseName: string
    serviceName: string
    timeAgo: string
  }
}

function routeAnnouncementEmail(data: RouteAnnouncementEmailData): { html: string; text: string } {
  const isEnhanced = !!data.overdueHorse
  const headerBg = isEnhanced ? "#d97706" : "#16a34a"
  const headerText = isEnhanced ? "Din häst behöver service" : "Ny ruttannons"
  const buttonBg = isEnhanced ? "#d97706" : "#16a34a"

  const baseStyles = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${headerBg}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 8px 8px; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .label { color: #6b7280; }
    .value { font-weight: 600; }
    .button { display: inline-block; background: ${buttonBg}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
    .overdue-banner { background: #fffbeb; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px; margin-bottom: 15px; }
  `

  const overdueBanner = data.overdueHorse
    ? `
    <div class="overdue-banner">
      <strong>${data.overdueHorse.horseName}</strong> behövde ${data.overdueHorse.serviceName.toLowerCase()} för <strong>${data.overdueHorse.timeAgo}</strong>.
    </div>`
    : ""

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="header">
    <h1>${headerText}</h1>
  </div>
  <div class="content">
    <p>Hej ${data.firstName}!</p>
    ${overdueBanner}
    <p><strong>${data.businessName}</strong> har annonserat nya tider i <strong>${data.municipality}</strong>.</p>

    <div class="detail-row">
      <span class="label">Datum:</span>
      <span class="value">${data.dateRange}</span>
    </div>
    <div class="detail-row">
      <span class="label">Tjänster:</span>
      <span class="value">${data.serviceNames}</span>
    </div>

    <div style="text-align: center; margin: 20px 0;">
      <a href="${data.announcementUrl}" class="button">Se annonsering</a>
    </div>
  </div>
  <div class="footer">
    <p>Equinet - Din plattform för hästtjänster</p>
    <p>Du får detta mail för att du följer ${data.businessName}.</p>
  </div>
</body>
</html>
`

  const overdueText = data.overdueHorse
    ? `\n${data.overdueHorse.horseName} behövde ${data.overdueHorse.serviceName.toLowerCase()} för ${data.overdueHorse.timeAgo}.\n`
    : ""

  const text = `
${headerText}

Hej ${data.firstName}!
${overdueText}
${data.businessName} har annonserat nya tider i ${data.municipality}.

Datum: ${data.dateRange}
Tjänster: ${data.serviceNames}

Se annonsering: ${data.announcementUrl}

--
Equinet - Din plattform för hästtjänster
Du får detta mail för att du följer ${data.businessName}.
`

  return { html, text }
}
