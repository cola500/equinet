import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { notificationService } from "@/domain/notification/NotificationService"

// GET - List notifications for the authenticated user
export const GET = withApiHandler(
  { auth: "any" },
  async ({ user, request }) => {
    const limitParam = request.nextUrl.searchParams.get("limit")
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 50) : 20

    const [notifications, unreadCount] = await Promise.all([
      notificationService.getForUser(user.userId, { limit }),
      notificationService.getUnreadCount(user.userId),
    ])

    return NextResponse.json({ notifications, unreadCount })
  },
)

// POST - Mark all notifications as read
export const POST = withApiHandler(
  { auth: "any" },
  async ({ user }) => {
    const result = await notificationService.markAllAsRead(user.userId)
    return NextResponse.json({ markedAsRead: result.count })
  },
)
