import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { notificationService } from "@/domain/notification/NotificationService"
import { logger } from "@/lib/logger"

// GET - List notifications for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    const limitParam = request.nextUrl.searchParams.get("limit")
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 50) : 20

    const [notifications, unreadCount] = await Promise.all([
      notificationService.getForUser(session.user.id, { limit }),
      notificationService.getUnreadCount(session.user.id),
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
    const session = await auth()

    const result = await notificationService.markAllAsRead(session.user.id)

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
