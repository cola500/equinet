import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { requireAuth } from "@/lib/roles"
import { notificationService } from "@/domain/notification/NotificationService"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"

// GET - List notifications for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const { userId } = requireAuth(await auth())

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    const limitParam = request.nextUrl.searchParams.get("limit")
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 50) : 20

    const [notifications, unreadCount] = await Promise.all([
      notificationService.getForUser(userId, { limit }),
      notificationService.getUnreadCount(userId),
    ])

    return NextResponse.json({ notifications, unreadCount })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Error fetching notifications", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte hämta notifikationer" },
      { status: 500 }
    )
  }
}

// POST - Mark all notifications as read
export async function POST(_request: NextRequest) {
  try {
    const { userId } = requireAuth(await auth())

    const clientIp = getClientIP(_request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    const result = await notificationService.markAllAsRead(userId)

    return NextResponse.json({ markedAsRead: result.count })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Error marking notifications as read", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte markera notifikationer som lästa" },
      { status: 500 }
    )
  }
}
