import { NextRequest, NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { createFollowService } from "@/domain/follow/FollowServiceFactory"

type RouteContext = {
  params: Promise<{ providerId: string }>
}

// DELETE /api/follows/:providerId - Unfollow a provider
export async function DELETE(request: NextRequest, context: RouteContext) {
  return withApiHandler(
    { auth: "customer", featureFlag: "follow_provider" },
    async ({ user }) => {
      const { providerId } = await context.params

      const service = createFollowService()
      await service.unfollow(user.userId, providerId)

      return NextResponse.json({ success: true })
    },
  )(request)
}

// GET /api/follows/:providerId - Check follow status
export async function GET(request: NextRequest, context: RouteContext) {
  return withApiHandler(
    { auth: "any", featureFlag: "follow_provider" },
    async ({ user }) => {
      const { providerId } = await context.params

      const service = createFollowService()
      const [isFollowing, followerCount] = await Promise.all([
        user.userType === "customer"
          ? service.isFollowing(user.userId, providerId)
          : false,
        service.getFollowerCount(providerId),
      ])

      return NextResponse.json({ isFollowing, followerCount })
    },
  )(request)
}
