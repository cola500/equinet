import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { DueForServiceService } from "@/domain/due-for-service/DueForServiceService"
import { logger } from "@/lib/logger"
import { z } from "zod"

const horseIdSchema = z.string().uuid()

// GET /api/customer/due-for-service
// GET /api/customer/due-for-service?horseId=xxx
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (session.user.userType !== "customer") {
      return NextResponse.json(
        { error: "Bara kunder har tillgang" },
        { status: 403 }
      )
    }

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "For manga forfragningar" },
        { status: 429 }
      )
    }

    const enabled = await isFeatureEnabled("due_for_service")
    if (!enabled) {
      return NextResponse.json({ items: [] })
    }

    const service = new DueForServiceService()
    const horseIdParam = request.nextUrl.searchParams.get("horseId")

    if (horseIdParam) {
      const parsed = horseIdSchema.safeParse(horseIdParam)
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Ogiltigt hast-ID" },
          { status: 400 }
        )
      }

      const items = await service.getForHorse(parsed.data, session.user.id)
      if (items === null) {
        return NextResponse.json(
          { error: "Hasten hittades inte" },
          { status: 404 }
        )
      }

      return NextResponse.json({ items })
    }

    const items = await service.getForCustomer(session.user.id)
    return NextResponse.json({ items })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error(
      "Failed to fetch customer due-for-service",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte hamta serviceplanering" },
      { status: 500 }
    )
  }
}
