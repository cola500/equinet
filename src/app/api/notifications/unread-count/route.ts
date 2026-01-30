import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { notificationService } from "@/domain/notification/NotificationService"
import { logger } from "@/lib/logger"

// GET - Return unread notification count for badge display
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    const count = await notificationService.getUnreadCount(session.user.id)

    return NextResponse.json({ count })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    logger.error("Error fetching unread count", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte hämta antal olästa" },
      { status: 500 }
    )
  }
}
