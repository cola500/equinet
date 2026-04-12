import { NextRequest, NextResponse } from "next/server"
import { BookingReminderService } from "@/domain/reminder/BookingReminderService"
import { logger } from "@/lib/logger"
import { verifyCronAuth } from "@/lib/cron-auth"

/**
 * Cron endpoint: Process booking reminders (24h before)
 *
 * Called daily at 06:00 UTC by Vercel Cron (vercel.json).
 * Protected by CRON_SECRET (Bearer + HMAC signature).
 */
export async function GET(request: NextRequest) {
  const auth = verifyCronAuth(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
    request.headers.get("x-vercel-signature")
  )

  if (!auth.ok) {
    return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
  }

  try {
    const reminderService = new BookingReminderService()
    const remindersSent = await reminderService.processAll()

    logger.info("Cron: booking reminders processed", { remindersSent })

    return NextResponse.json({
      success: true,
      remindersSent,
      processedAt: new Date().toISOString(),
    })
  } catch (error) {
    logger.error(
      "Cron: failed to process booking reminders",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte bearbeta bokningspåminnelser" },
      { status: 500 }
    )
  }
}
