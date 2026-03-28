import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth-server"
import { requireCustomer, requireAuth } from "@/lib/roles"
import { logger } from "@/lib/logger"
import { rateLimiters, getClientIP } from "@/lib/rate-limit"
import { isFeatureEnabled } from "@/lib/feature-flags"
import { createFollowService } from "@/domain/follow/FollowServiceFactory"

type RouteContext = {
  params: Promise<{ providerId: string }>
}

// DELETE /api/follows/:providerId - Unfollow a provider
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = requireCustomer(await auth())

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    if (!(await isFeatureEnabled("follow_provider"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const { providerId } = await context.params

    const service = createFollowService()
    await service.unfollow(userId, providerId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error("Error unfollowing", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}

// GET /api/follows/:providerId - Check follow status
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId, userType } = requireAuth(await auth())

    const clientIp = getClientIP(request)
    const isAllowed = await rateLimiters.api(clientIp)
    if (!isAllowed) {
      return NextResponse.json({ error: "För många förfrågningar" }, { status: 429 })
    }

    if (!(await isFeatureEnabled("follow_provider"))) {
      return NextResponse.json({ error: "Ej tillgänglig" }, { status: 404 })
    }

    const { providerId } = await context.params

    const service = createFollowService()
    const [isFollowing, followerCount] = await Promise.all([
      userType === "customer"
        ? service.isFollowing(userId, providerId)
        : false,
      service.getFollowerCount(providerId),
    ])

    return NextResponse.json({ isFollowing, followerCount })
  } catch (error) {
    if (error instanceof Response) return error

    logger.error("Error checking follow status", error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json(
      { error: "Internt serverfel" },
      { status: 500 }
    )
  }
}
