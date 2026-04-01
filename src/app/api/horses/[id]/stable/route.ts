import { NextRequest, NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { logger } from "@/lib/logger"
import { z } from "zod"
import { createHorseService } from "@/domain/horse/HorseService"
import { mapHorseErrorToStatus } from "@/domain/horse/mapHorseErrorToStatus"

type RouteContext = { params: Promise<{ id: string }> }

const setStableSchema = z
  .object({
    stableId: z.string().min(1).nullable(),
  })
  .strict()

// PATCH - Set or remove stable link for a horse
export async function PATCH(request: NextRequest, context: RouteContext) {
  return withApiHandler(
    { auth: "any", schema: setStableSchema, featureFlag: "stable_profiles" },
    async ({ user, body }) => {
      const { id } = await context.params

      const service = createHorseService()
      const result = await service.setStable(id, body.stableId, user.userId)

      if (result.isFailure) {
        return NextResponse.json(
          { error: result.error.message },
          { status: mapHorseErrorToStatus(result.error) }
        )
      }

      logger.info("Horse stable updated", {
        horseId: id,
        stableId: body.stableId,
        ownerId: user.userId,
      })

      return NextResponse.json(result.value)
    },
  )(request)
}
