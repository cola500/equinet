import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { createMunicipalityWatchService } from "@/domain/municipality-watch/MunicipalityWatchServiceFactory"

type RouteContext = {
  params: Promise<{ id: string }>
}

// DELETE /api/municipality-watches/:id - Remove a municipality watch
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (session.user.userType !== "customer") {
      return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 })
    }

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    if (!(await isFeatureEnabled("municipality_watch"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const { id } = await context.params

    const service = createMunicipalityWatchService()
    const deleted = await service.removeWatch(id, session.user.id)

    if (!deleted) {
      return NextResponse.json({ error: "Bevakning hittades inte" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error("Error deleting municipality watch", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
