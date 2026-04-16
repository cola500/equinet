import { NextRequest, NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron-auth"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { createDataRetentionService } from "@/domain/data-retention/DataRetentionService"
import { logger } from "@/lib/logger"

/**
 * Cron endpoint: GDPR data retention -- process inactive accounts
 *
 * Called monthly (1st of month, 06:00 UTC) by Vercel Cron.
 * Protected by CRON_SECRET (Bearer + HMAC signature).
 * Gated by feature flag: data_retention (default off).
 *
 * Flow:
 * 1. Find users inactive 2+ years (via Supabase Auth last_sign_in_at)
 * 2. Not yet notified -> send 30-day warning email
 * 3. Notified 30+ days ago -> delete/anonymize account
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

  if (!(await isFeatureEnabled("data_retention"))) {
    return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
  }

  try {
    const service = createDataRetentionService()
    const result = await service.processRetention()

    logger.info("Cron: data retention processed", { ...result })

    return NextResponse.json({
      success: true,
      ...result,
      processedAt: new Date().toISOString(),
    })
  } catch (error) {
    logger.error(
      "Cron: failed to process data retention",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte bearbeta datalagring" },
      { status: 500 }
    )
  }
}
