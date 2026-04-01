import { NextRequest, NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { logger } from "@/lib/logger"
import { createHorseService } from "@/domain/horse/HorseService"
import { mapHorseErrorToStatus } from "@/domain/horse/mapHorseErrorToStatus"

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/horses/[id]/profile - Create a shareable profile link
export async function POST(request: NextRequest, context: RouteContext) {
  return withApiHandler(
    { auth: "any" },
    async ({ request: req, user }) => {
      const { id: horseId } = await context.params

      const service = createHorseService()
      const result = await service.createProfileToken(horseId, user.userId)

      if (result.isFailure) {
        return NextResponse.json(
          { error: result.error.message },
          { status: mapHorseErrorToStatus(result.error) }
        )
      }

      // Build the public URL
      const baseUrl = req.headers.get("x-forwarded-host")
        ? `https://${req.headers.get("x-forwarded-host")}`
        : new URL(req.url).origin
      const url = `${baseUrl}/profile/${result.value.token}`

      logger.info("Profile token created", {
        horseId,
        userId: user.userId,
        expiresAt: result.value.expiresAt.toISOString(),
      })

      return NextResponse.json(
        {
          token: result.value.token,
          url,
          expiresAt: result.value.expiresAt.toISOString(),
        },
        { status: 201 }
      )
    },
  )(request)
}
