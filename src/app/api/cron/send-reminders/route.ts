import { NextRequest, NextResponse } from "next/server"
import { ReminderService } from "@/domain/reminder/ReminderService"
import { logger } from "@/lib/logger"
import { verifyCronAuth } from "@/lib/cron-auth"

/**
 * Cron endpoint: Process rebooking reminders
 *
 * Called daily by Vercel Cron (vercel.json).
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
