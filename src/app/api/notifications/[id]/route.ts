import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { notificationService } from "@/domain/notification/NotificationService"
import { logger } from "@/lib/logger"

// PUT - Mark a single notification as read
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()

    const notification = await notificationService.markAsRead(id, session.user.id)

    return NextResponse.json(notification)
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    // Prisma P2025: Record not found (wrong id or wrong userId)
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return NextResponse.json(
        { error: "Notifikation hittades inte" },
        { status: 404 }
      )
    }

    logger.error("Error marking notification as read", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Kunde inte uppdatera notifikation" },
      { status: 500 }
    )
  }
}
