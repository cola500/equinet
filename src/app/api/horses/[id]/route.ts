import { NextRequest, NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { logger } from "@/lib/logger"
import { createHorseService } from "@/domain/horse/HorseService"
import { mapHorseErrorToStatus } from "@/domain/horse/mapHorseErrorToStatus"
import { horseUpdateSchema } from "@/lib/schemas/horse"

type RouteContext = { params: Promise<{ id: string }> }

// GET - Get horse details with booking history
export async function GET(request: NextRequest, context: RouteContext) {
  return withApiHandler(
    { auth: "any" },
    async ({ user }) => {
      const { id } = await context.params
      const service = createHorseService()
      const result = await service.getHorse(id, user.userId)

      if (result.isFailure) {
        return NextResponse.json(
          { error: result.error.message },
          { status: mapHorseErrorToStatus(result.error) }
        )
      }

      return NextResponse.json(result.value)
    },
  )(request)
}

// PUT - Update horse
export async function PUT(request: NextRequest, context: RouteContext) {
  return withApiHandler(
    { auth: "any", schema: horseUpdateSchema },
    async ({ user, body }) => {
      const { id } = await context.params
      const service = createHorseService()
      const result = await service.updateHorse(id, body, user.userId)

      if (result.isFailure) {
        return NextResponse.json(
          { error: result.error.message },
          { status: mapHorseErrorToStatus(result.error) }
        )
      }

      logger.info("Horse updated", { horseId: id, ownerId: user.userId })
      return NextResponse.json(result.value)
    },
  )(request)
}

// DELETE - Soft delete horse (set isActive=false)
export async function DELETE(request: NextRequest, context: RouteContext) {
  return withApiHandler(
    { auth: "any" },
    async ({ user }) => {
      const { id } = await context.params
      const service = createHorseService()
      const result = await service.softDeleteHorse(id, user.userId)

      if (result.isFailure) {
        return NextResponse.json(
          { error: result.error.message },
          { status: mapHorseErrorToStatus(result.error) }
        )
      }

      logger.info("Horse soft-deleted", { horseId: id, ownerId: user.userId })
      return NextResponse.json({ message: "Hästen har tagits bort" })
    },
  )(request)
}
