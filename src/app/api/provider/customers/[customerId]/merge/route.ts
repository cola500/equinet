import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { requireProvider } from "@/lib/roles"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { createGhostMergeService } from "@/domain/auth/GhostMergeServiceFactory"
import type { MergeErrorType } from "@/domain/auth/GhostMergeService"

const mergeSchema = z.object({
  targetEmail: z.string().email("Ogiltig e-postadress"),
}).strict()

type RouteContext = { params: Promise<{ customerId: string }> }

function mapMergeErrorToStatus(type: MergeErrorType): number {
  switch (type) {
    case 'GHOST_NOT_IN_REGISTER': return 404
    case 'NOT_A_GHOST': return 409
    case 'TARGET_NOT_FOUND': return 404
    case 'TARGET_IS_GHOST': return 409
    case 'SAME_USER': return 400
  }
}

// POST /api/provider/customers/[customerId]/merge
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { providerId } = requireProvider(await auth())

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json(
        { error: "För många förfrågningar. Försök igen om en minut." },
        { status: 429 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 })
    }

    const parsed = mergeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valideringsfel", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { customerId } = await context.params
    const { targetEmail } = parsed.data

    const service = createGhostMergeService(providerId)
    const result = await service.merge(customerId, targetEmail, providerId)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapMergeErrorToStatus(result.error.type) }
      )
    }

    logger.security("Ghost user merged", "medium", {
      ghostUserId: customerId,
      mergedIntoUserId: result.value.mergedInto,
      requestedByProviderId: providerId,
    })

    return NextResponse.json({
      message: "Kunden har slagits ihop med det riktiga kontot",
      mergedInto: result.value.mergedInto,
    })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error(
      "Failed to merge ghost user",
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json(
      { error: "Kunde inte slå ihop kunden" },
      { status: 500 }
    )
  }
}
