import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { rateLimiters } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { createGroupBookingService } from "@/domain/group-booking/GroupBookingService"
import { mapGroupBookingErrorToStatus } from "@/domain/group-booking/mapGroupBookingErrorToStatus"

const joinSchema = z.object({
  inviteCode: z.string().min(1, "Inbjudningskod krävs").max(20),
  numberOfHorses: z.number().int().min(1).max(10).optional(),
  horseId: z.string().uuid().optional(),
  horseName: z.string().max(100).optional(),
  horseInfo: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    // Rate limiting
    const rateLimitKey = `booking:${session.user.id}`
    try {
      const isAllowed = await rateLimiters.booking(rateLimitKey)
      if (!isAllowed) {
        return NextResponse.json(
          { error: "För många förfrågningar. Försök igen senare." },
          { status: 429 }
        )
      }
    } catch (rateLimitError) {
      logger.error("Rate limiter error", rateLimitError instanceof Error ? rateLimitError : new Error(String(rateLimitError)))
    }

    // Parse JSON
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Ogiltig JSON" },
        { status: 400 }
      )
    }

    const validated = joinSchema.parse(body)

    const service = createGroupBookingService()
    const result = await service.joinByInviteCode({
      userId: session.user.id,
      inviteCode: validated.inviteCode,
      numberOfHorses: validated.numberOfHorses,
      horseId: validated.horseId,
      horseName: validated.horseName,
      horseInfo: validated.horseInfo,
      notes: validated.notes,
    })

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapGroupBookingErrorToStatus(result.error) }
      )
    }

    return NextResponse.json(result.value, { status: 201 })
  } catch (err: unknown) {
    if (err instanceof Response) {
      return err
    }

    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Valideringsfel", details: err.issues },
        { status: 400 }
      )
    }

    logger.error("Failed to join group booking", err instanceof Error ? err : new Error(String(err)))
    return NextResponse.json(
      { error: "Kunde inte gå med i gruppbokning" },
      { status: 500 }
    )
  }
}
