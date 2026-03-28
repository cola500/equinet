import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { z } from "zod"
import { createFollowService } from "@/domain/follow/FollowServiceFactory"

const followSchema = z.object({
  providerId: z.string().uuid("Ogiltigt leverantörs-ID"),
}).strict()

// POST /api/follows - Follow a provider
export const POST = withApiHandler(
  { auth: "customer", featureFlag: "follow_provider", schema: followSchema },
  async ({ user, body }) => {
    const service = createFollowService()
    const result = await service.follow(user.userId, body.providerId)

    if (!result.ok) {
      if (result.error === "PROVIDER_NOT_FOUND") {
        return NextResponse.json({ error: "Leverantör hittades inte" }, { status: 404 })
      }
      if (result.error === "PROVIDER_INACTIVE") {
        return NextResponse.json({ error: "Leverantören är inte aktiv" }, { status: 400 })
      }
    }

    if (result.ok) {
      return NextResponse.json(result.value, { status: 201 })
    }

    return NextResponse.json({ error: "Internt serverfel" }, { status: 500 })
  },
)

// GET /api/follows - List followed providers
export const GET = withApiHandler(
  { auth: "customer", featureFlag: "follow_provider" },
  async ({ user }) => {
    const service = createFollowService()
    const follows = await service.getFollowedProviders(user.userId)

    return NextResponse.json(follows)
  },
)
