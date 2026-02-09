import { NextRequest, NextResponse } from "next/server"
import { ReminderService } from "@/domain/reminder/ReminderService"
import { logger } from "@/lib/logger"

/**
 * Cron endpoint: Process rebooking reminders
 *
 * Called daily by Vercel Cron (vercel.json).
 * Protected by CRON_SECRET to prevent unauthorized access.
 *
 * Vercel sends Authorization: Bearer <CRON_SECRET> automatically.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const expectedSecret = process.env.CRON_SECRET

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Ej inloggad" }, { status: 401 })
  }

  try {
    const reminderService = new ReminderService()
    const remindersSent = await reminderService.processAll()

    logger.info("Cron: rebooking reminders processed", { remindersSent })

    return NextResponse.json({
      success: true,
      remindersSent,
      processedAt: new Date().toISOString(),
    })
  } catch (error) {
    logger.error(
      "Cron: failed to process reminders",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte bearbeta påminnelser" },
      { status: 500 }
    )
  }
}
