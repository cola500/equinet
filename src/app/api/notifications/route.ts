import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { notificationService } from "@/domain/notification/NotificationService"
import { logger } from "@/lib/logger"

// GET - List notifications for the authenticated user
// Uses Supabase client with RLS -- notification_user_read policy filters by userId in JWT
export const GET = withApiHandler(
  { auth: "any" },
  async ({ request, user }) => {
    const limitParam = request.nextUrl.searchParams.get("limit")
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 50) : 20

    const supabase = await createSupabaseServerClient()

    const [listResult, countResult] = await Promise.all([
      supabase
        .from("Notification")
        .select("id, type, message, isRead, linkUrl, createdAt")
        .eq("userId", user.userId)
        .order("createdAt", { ascending: false })
        .limit(limit),
      supabase
        .from("Notification")
        .select("*", { count: "exact", head: true })
        .eq("userId", user.userId)
        .eq("isRead", false),
    ])

    if (listResult.error) {
      logger.error("Failed to fetch notifications via Supabase", new Error(listResult.error.message))
      return NextResponse.json({ error: "Kunde inte hämta notifikationer" }, { status: 500 })
    }

    return NextResponse.json({
      notifications: listResult.data,
      unreadCount: countResult.count ?? 0,
    })
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
