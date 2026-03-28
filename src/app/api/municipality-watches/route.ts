import { NextResponse } from "next/server"
import { withApiHandler } from "@/lib/api-handler"
import { z } from "zod"
import { createMunicipalityWatchService } from "@/domain/municipality-watch/MunicipalityWatchServiceFactory"

const watchSchema = z.object({
  municipality: z.string().min(1, "Kommun krävs"),
  serviceTypeName: z.string().min(1, "Tjänstetyp krävs").max(100),
}).strict()

// POST /api/municipality-watches - Create a new municipality watch
export const POST = withApiHandler(
  { auth: "customer", featureFlag: "municipality_watch", schema: watchSchema },
  async ({ user, body }) => {
    const service = createMunicipalityWatchService()
    const result = await service.addWatch(
      user.userId,
      body.municipality,
      body.serviceTypeName,
    )

    if (!result.ok) {
      const errorMessages: Record<string, string> = {
        INVALID_MUNICIPALITY: "Ogiltig kommun",
        INVALID_SERVICE_TYPE: "Ogiltig tjänstetyp",
        MAX_WATCHES_REACHED: "Max antal bevakningar uppnått (10)",
      }
      return NextResponse.json(
        { error: errorMessages[result.error] || "Valideringsfel" },
        { status: 400 },
      )
    }

    return NextResponse.json(result.value, { status: 201 })
  },
)

// GET /api/municipality-watches - List customer's watches
export const GET = withApiHandler(
  { auth: "customer", featureFlag: "municipality_watch" },
  async ({ user }) => {
    const service = createMunicipalityWatchService()
    const watches = await service.getWatches(user.userId)
    return NextResponse.json(watches)
  },
)
