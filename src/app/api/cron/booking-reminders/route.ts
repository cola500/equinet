import { NextRequest, NextResponse } from "next/server"
import { BookingReminderService } from "@/domain/reminder/BookingReminderService"
import { logger } from "@/lib/logger"

/**
 * Cron endpoint: Process booking reminders (24h before)
 *
 * Called daily at 06:00 UTC by Vercel Cron (vercel.json).
 * Protected by CRON_SECRET to prevent unauthorized access.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
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
