import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { logger } from "@/lib/logger"
import { createHorseService } from "@/domain/horse/HorseService"
import { mapHorseErrorToStatus } from "@/domain/horse/mapHorseErrorToStatus"
import { horseCreateSchema } from "@/lib/schemas/horse"

// GET - List horses for authenticated user
export const GET = withApiHandler(
  { auth: "any" },
  async ({ user }) => {
    const service = createHorseService()

    const result = await service.listHorses(user.userId)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapHorseErrorToStatus(result.error) }
      )
    }

    return NextResponse.json(result.value)
  },
)

// POST - Create new horse
export const POST = withApiHandler(
  { auth: "any", schema: horseCreateSchema },
  async ({ user, body }) => {
    const service = createHorseService()
    const result = await service.createHorse(body, user.userId)

    if (result.isFailure) {
      return NextResponse.json(
        { error: result.error.message },
        { status: mapHorseErrorToStatus(result.error) }
      )
    }

    logger.info("Horse created", { horseId: result.value.id, ownerId: user.userId })

    return NextResponse.json(result.value, { status: 201 })
  },
)
