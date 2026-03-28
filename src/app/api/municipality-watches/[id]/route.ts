import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { createMunicipalityWatchService } from "@/domain/municipality-watch/MunicipalityWatchServiceFactory"

// DELETE /api/municipality-watches/:id - Remove a municipality watch
export const DELETE = withApiHandler(
  { auth: "customer", featureFlag: "municipality_watch" },
  async ({ user, request }) => {
    const id = request.nextUrl.pathname.split("/").pop()!

    const service = createMunicipalityWatchService()
    const deleted = await service.removeWatch(id, user.userId)

    if (!deleted) {
      return NextResponse.json({ error: "Bevakning hittades inte" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  },
)
